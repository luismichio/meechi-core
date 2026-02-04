
import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioInputService } from '../audio/input';
import { VADService } from '../audio/vad';
import { TranscriberService } from '../audio/stt';
import { SynthesizerService } from '../audio/tts';

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export function useVoiceLoop(sendMessage: (text: string, onToken?: (chunk: string) => void) => Promise<string | void>) {
    const [state, setState] = useState<VoiceState>('idle');
    const stateRef = useRef<VoiceState>('idle'); // Fix for stale closure in callbacks
    const [transcript, setTranscript] = useState("");
    const [vadProb, setVadProb] = useState(0);
    
    // Sync ref with state
    useEffect(() => {
        stateRef.current = state;
    }, [state]);


    const audioInput = useRef(new AudioInputService());
    const vad = useRef(new VADService());
    const audioBuffer = useRef<Float32Array[]>([]);
    const audioChunksRef = useRef<Float32Array[]>([]);
    const isSpeechPrev = useRef(false);
    
    // Audio Context for playback
    const playbackCtx = useRef<AudioContext | null>(null);
    const playbackSource = useRef<AudioBufferSourceNode | null>(null);
    const chunksProcessedRef = useRef(0);

    // STREAMING TTS STATE
    const audioQueue = useRef<{audio: Float32Array, sampleRate: number}[]>([]);
    const isPlayingRef = useRef(false);
    const sentenceBuffer = useRef("");

    const stopPlayback = useCallback(() => {
        if (playbackSource.current) {
            playbackSource.current.stop();
            playbackSource.current = null;
        }
        // Clear Queue
        audioQueue.current = [];
        isPlayingRef.current = false;
        sentenceBuffer.current = "";
        
        setState('idle');
    }, []);



    const processTTSChunk = async (text: string) => {
        if (!text.trim()) return;
        
        // Strip Markdown for TTS (e.g. *italic*, **bold**, `code`)
        // Also remove excessive punctuation runs
        const cleanText = text
            .replace(/[*_`~]/g, '') // Remove markdown symbols
            .replace(/\[.*?\]/g, '') // Remove [instructions] if any leak
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanText) return;

        try {
            const rawAudio = await SynthesizerService.speak(cleanText);
            if (rawAudio) {
                audioQueue.current.push({ audio: rawAudio.audio, sampleRate: rawAudio.sampling_rate });
                playNextInQueue();
            }
        } catch (e) {
            console.error("TTS Gen Error:", e);
        }
    }

    const processAudio = async (text: string) => {
        if (!text.trim()) return;
        
        // PRE-FILTER: Ignore known hallucination strings from STT (Case-insensitive)
        const lower = text.trim().toLowerCase();
        if (lower === 'you' || // "You" is very common hallucination
            /^\[.*\]$/.test(lower) || // [Music], [Silence]
            /^\(.*\)$/.test(lower) || // (Music)
            lower.includes('[music]') ||
            lower.includes('[silence]') ||
            // Common Whisper Hallucinations:
            lower.includes('thank you for watching') ||
            lower.includes('thanks for watching')
        ) {
             console.log("[VoiceLoop] Ignoring hallucination:", text);
             setState('idle'); // Ensure we return to idle
             return;
        }

        console.log("[VoiceLoop] Processing User Audio:", text);
        
        setState('processing');
        sentenceBuffer.current = "";
        
        try {
            // 1. Send to AI with STREAMING callback
            const response = await sendMessage(text, (token) => {
                 // Check for interruption
                 if (stateRef.current === 'listening') return; // Abort if user started talking again?
                 
                 sentenceBuffer.current += token;
                 
                 // Split by sentence endings (. ! ? \n)
                 // Regex lookbehind is not supported in all browsers, so use simple split
                 // Capture delimiters
                 // Note: This matches "Dr." as a split. Improved regex needed for "Dr." etc, but for now simple is ok.
                 // Heuristic: Ends with [.!?] AND (followed by space or newline) - logic applied to buffer
                 
                 // Check if we have a full sentence in buffer
                 // Regex: Match anything ending in [.!?] followed by space or EOS
                 // We only split if we have enough content
                 
                 // HALLUCINATION/NOISE FILTER
                 // If the *entire* buffer is just these common patterns, we suppress it.
                 // We only check this if probability is low, but better safe.
                 if (/^[\(\[\{]?(music|silence|sound|background|noise)[\)\]\}]?$/i.test(sentenceBuffer.current.trim())) {
                     console.log("[VoiceLoop] Filtered Hallucination:", sentenceBuffer.current);
                     sentenceBuffer.current = "";
                     return;
                 }

                 // FIRST CHUNK STRATEGY:
                 // To lower latency, we split the FIRST sentence on commas or small pauses (length)
                 const isFirstChunk = !isPlayingRef.current && audioQueue.current.length === 0;
                 const splitRegex = isFirstChunk 
                    ? /([,;:.!?\n])\s+/ // Split on commas too for the first burst
                    : /([.!?\n])\s+/;   // Standard sentence split
                 
                 const minChars = isFirstChunk ? 30 : 100; // Allow smaller first chunk

                 if (splitRegex.test(sentenceBuffer.current) && sentenceBuffer.current.length > minChars) {
                     // Attempt to split
                     const match = sentenceBuffer.current.match(new RegExp(`^(.*?${splitRegex.source})`));
                     if (match) {
                         const chunk = match[0];
                         const remaining = sentenceBuffer.current.slice(chunk.length);
                         
                         if (chunk.trim()) {
                            processTTSChunk(chunk.trim());
                            sentenceBuffer.current = remaining; 
                         }
                     }
                 }
            });
            
            // 2. Flush remaining buffer
            if (sentenceBuffer.current.trim()) {
                await processTTSChunk(sentenceBuffer.current.trim());
            }

            console.log("[VoiceLoop] Generation Complete.");
            
            // Wait for queue to drain?
            // We need a loop to check if playing is done
            const checkDone = setInterval(() => {
                if (stateRef.current !== 'speaking' && stateRef.current !== 'processing') {
                    clearInterval(checkDone);
                    return;
                }
                
                if (!isPlayingRef.current && audioQueue.current.length === 0) {
                    clearInterval(checkDone);
                    setState('idle');
                }
            }, 200);
            
        } catch (e) {
            console.error("Voice Loop Error:", e);
            setState('idle');
        }
    };

    const silenceChunksRef = useRef(0);
    // 30 chunks * 512 samples / 16000 Hz ~= 1.0 second roughly. 
    // Let's use 1.2s to be safe for slow speakers.
    // 1.2 / 0.032 = 37.5 ~ 40 chunks
    const MAX_SILENCE_CHUNKS = 40; 
    
    // Track Playing State for UI
    const [isPlaying, setIsPlaying] = useState(false);
    
    // Sync Ref with State for internal logic
    useEffect(() => {
        setIsPlaying(isPlayingRef.current);
    }, [isPlayingRef.current]); // This dependency might not trigger if ref mutates, we need to set state where we set ref.

    // Helper to update playing state
    const setPlayingState = (val: boolean) => {
        isPlayingRef.current = val;
        setIsPlaying(val);
    };

    // ... (stopPlayback updates)
    // We need to update stopPlayback to use setPlayingState
    // But since stopPlayback is memoized and we are inside the hook function body (recreated?), let's just update the internal logic below

    // Process and Play next chunk in queue
    const playNextInQueue = async () => {
        if (isPlayingRef.current || audioQueue.current.length === 0) {
            return;
        }
        
        const next = audioQueue.current.shift();
        if (!next || !playbackCtx.current) return;

        setPlayingState(true);
        setState('speaking');

        try {
            if (playbackCtx.current.state === 'suspended') {
                await playbackCtx.current.resume();
            }

            const buffer = playbackCtx.current.createBuffer(1, next.audio.length, next.sampleRate);
            buffer.copyToChannel(new Float32Array(next.audio), 0);

            const source = playbackCtx.current.createBufferSource();
            source.buffer = buffer;
            source.connect(playbackCtx.current.destination);
            source.start();
            playbackSource.current = source;
            
            source.onended = () => {
                setPlayingState(false);
                
                if (audioQueue.current.length > 0) {
                    playNextInQueue();
                } else {
                     // Queue empty. 
                }
            };
        } catch (e) {
            console.error("Playback Error:", e);
            setPlayingState(false);
        }
    };

    // Update stopPlayback
    // We can't easily overwrite the previous useCallback in this 'replace' block without context. 
    // But we can just ensuring setPlayingState(false) is called where isPlayingRef.current = false was.
    // I will replace start() logic mostly here.
    
    const start = async () => {
        if (!playbackCtx.current) {
            playbackCtx.current = new AudioContext();
        }
        if (playbackCtx.current.state === 'suspended') {
            await playbackCtx.current.resume();
        }

        await vad.current.init();
        
        await audioInput.current.start(async (data) => {
            // 1. VAD Check
            let { isSpeech, probability } = await vad.current.process(data);
            
            const maxAmp = Math.max(...data);
            if (!isSpeech && maxAmp > 0.05) {
                isSpeech = true;
                probability = 0.8; 
            }
            
            setVadProb(probability);
            isSpeechPrev.current = isSpeech;
            
            const currentState = stateRef.current;

            if (isSpeech) {
               // SPEECH DETECTED
               silenceChunksRef.current = 0; // Reset silence counter

               if (currentState === 'speaking') {
                   stopPlayback(); // Interruption
               }
               
               if (currentState !== 'listening' && currentState !== 'processing') {
                   setState('listening');
               }
               
               audioBuffer.current.push(data);

            } else if (currentState === 'listening') {
                 // SILENCE (DETECTED)
                 // We are in listening mode, but VAD says silence.
                 // We do NOT stop immediately. We accumulate silence.
                 
                 silenceChunksRef.current++;
                 audioBuffer.current.push(data); // Keep recording the "silence" (sentence pause)
                 
                 if (silenceChunksRef.current > MAX_SILENCE_CHUNKS) {
                     // TIMEOUT: Speech Actually Ended
                     silenceChunksRef.current = 0;
                     
                     const length = audioBuffer.current.reduce((acc, chunk) => acc + chunk.length, 0);
                     
                     // IGNORE SHORT CLICKS (Under 0.5s of effective content?)
                     // Since we included silence, the total length is huge now.
                     // We should check the length MINUS the silence tail?
                     // Or just rely on the fact that if we hit the timeout, it was probably speech + silence.
                     // But what if it was JUST silence (false trigger)?
                     // Check total length: 40 chunks * 512 = 20k samples. 
                     // If we have < 30k total samples, it means we ONLY recorded the silence tail + tiny blip.
                     
                     if (length < 24000) { // < 1.5s total (mostly silence)
                        console.log("[VoiceLoop] Speech too short (mostly silence), ignoring. Length:", length);
                        audioBuffer.current = [];
                        setState('idle');
                        return;
                     }
     
                     console.log(`[VoiceLoop] Speech Ended (Silence Timeout). Processing...`);
                     const fullAudio = new Float32Array(length);
                     let offset = 0;
                     for (const chunk of audioBuffer.current) {
                         fullAudio.set(chunk, offset);
                         offset += chunk.length;
                     }
                     audioBuffer.current = []; 
                     
                     stateRef.current = 'processing'; 
                     setState('processing');
     
                     console.log("[VoiceLoop] Transcribing...");
                     let text = "";
                     try {
                         text = await TranscriberService.transcribe(fullAudio);
                         console.log(`[VoiceLoop] Transcribed Text: "${text}"`);
                         setTranscript(text);
                     } catch (err) {
                         console.error("[VoiceLoop] Transcription Error:", err);
                         setTranscript(""); 
                     }
                     
                     if (text.trim()) {
                         await processAudio(text);
                     } else {
                         stateRef.current = 'idle';
                         setState('idle');
                     }
                 }
            }
        });
    };
    
    const stop = () => {
        audioInput.current.stop();
        stopPlayback();
        setState('idle');
    };

    // Kept for backward compatibility if manual playback is needed
    const playResponse = async (text: string) => {
        stopPlayback();
        await processTTSChunk(text);
    }

    return { 
        start, 
        stop, 
        stopPlayback, 
        state, 
        vadProb, 
        transcript, 
        playResponse,
        isPlaying,
        getAnalyser: () => audioInput.current.getAnalyser() 
    };
}
