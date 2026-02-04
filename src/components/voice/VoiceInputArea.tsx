import { useState, useRef, useEffect } from 'react';
import { useVoiceLoop } from '../../lib/hooks/use-voice-loop';
import { TranscriberService } from '../../lib/audio/stt';
import { SynthesizerService } from '../../lib/audio/tts';
import { settingsManager } from '../../lib/settings';
import { Mic, Headphones, X, Square, ArrowUp } from 'lucide-react';
import { motion } from 'framer-motion';
import Icon from '../../components/Icon';
import styles from '../../app/app/page.module.css';

// We need to define the props interface clearly
interface VoiceInputAreaProps {
    meechi: any;
    chatInput: string;
    setChatInput: (val: string) => void;
    isDragOver: boolean;
    setIsDragOver: (val: boolean) => void;
    attachedFiles: any[];
    setAttachedFiles: (files: any[]) => void;
    handleChat: (e: any) => void;
    storage: any;
    processUserMessage: (text: string, onToken?: (chunk: string) => void) => Promise<string | void>;
}

export function VoiceInputArea({ 
    meechi, 
    chatInput, 
    setChatInput, 
    isDragOver, 
    setIsDragOver, 
    attachedFiles, 
    setAttachedFiles, 
    handleChat, 
    storage,
    processUserMessage 
}: VoiceInputAreaProps) {
    const { start, stop, stopPlayback, state, vadProb, transcript, getAnalyser, isPlaying } = useVoiceLoop(processUserMessage);
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        }
    }, [chatInput]);

    // Handle Voice Toggle
    const toggleVoice = () => {
        console.log("[VoiceInputArea] Toggle clicked. Current state:", isVoiceActive);
        if (isVoiceActive) {
            stop();
            stopPlayback(); // Cut speech immediately
            setIsVoiceActive(false);
        } else {
            console.log("[VoiceInputArea] Starting voice loop...");
            start().then(() => {
                console.log("[VoiceInputArea] Voice loop started successfully");
                setIsVoiceActive(true);
            }).catch(e => {
                console.error("[VoiceInputArea] Failed to start voice loop:", e);
            });
        }
    };

    useEffect(() => {
        console.log("[VoiceInputArea] Component Mounted - Preloading Models...");
        const preload = async () => {
             // 1. Configure Cloud STT if available
             const config = await settingsManager.getConfig();
             // Check Active Provider
             if (config.activeProviderId && config.activeProviderId !== 'local') {
                 const provider = config.providers.find(p => p.id === config.activeProviderId);
                 const key = provider?.apiKey || process.env.NEXT_PUBLIC_GROQ_API_KEY;
                 if (key) {
                     console.log("[VoiceInputArea] Enabling Cloud STT & TTS (Groq/Cloud)");
                     TranscriberService.setCloudProvider(key);
                     SynthesizerService.setCloudProvider(key);
                 }
             }
             
             // 2. Preload/Init TTS
             // If Cloud TTS is configured (via setCloudProvider above), init() will defer local model.
             SynthesizerService.init().catch(e => console.error("TTS Preload Failed", e));
        };
        setTimeout(preload, 1000); 
    }, []);
    
    // Stop voice if component unmounts
    useEffect(() => {
        return () => { stop(); };
    }, []);

    // Visualizer Data
    const [volume, setVolume] = useState(0);
    useEffect(() => {
        if (!isVoiceActive) return;
        let rafId: number;
        const animate = () => {
             const analyser = getAnalyser();
             if (analyser) {
                 const dataArray = new Uint8Array(analyser.frequencyBinCount);
                 analyser.getByteFrequencyData(dataArray);
                 let sum = 0;
                 for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
                 setVolume(sum / dataArray.length);
             }
             rafId = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(rafId);
    }, [isVoiceActive, getAnalyser]);

    const visualizerScale = 1 + (volume / 255) * 0.4 + (vadProb * 0.1);
    const visualizerColor = state === 'listening' ? 'var(--accent)' : 
                            state === 'processing' ? '#818cf8' :
                            state === 'speaking' ? '#34d399' : '#a8a29e';

    return (
        <form onSubmit={handleChat} className={styles.inputWrapper} style={{ flexDirection: 'column', alignItems: 'stretch', position: 'relative' }}>
             {/* Voice Overlay Effect on Input Box */}
             {isVoiceActive && (
                 <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className={styles.voiceOverlayInline}
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(255,255,255,0.85)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 20,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 8,
                        border: `1px solid ${visualizerColor}`
                    }}
                 >
                     {/* Visualizer Orb */}
                     <motion.div 
                        animate={{ scale: visualizerScale, backgroundColor: visualizerColor }}
                        style={{ width: 40, height: 40, borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                     />
                     <div style={{ fontSize: '0.85rem', color: '#555', fontStyle: 'italic' }}>
                        {state === 'idle' && "Listening..."}
                        {state === 'listening' && "Listening..."}
                        {state === 'processing' && "Thinking..."}
                        {state === 'speaking' && "Speaking..."}
                     </div>
                     {transcript && <div style={{ fontSize: '0.75rem', maxWidth: '80%', textAlign: 'center', opacity: 0.7 }}>"{transcript}"</div>}
                     
                     <button 
                        type="button" 
                        onClick={toggleVoice}
                        style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
                    >
                        <X size={16} />
                    </button>
                 </motion.div>
             )}

            {/* Drag & Drop Overlay */}
            {isDragOver && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '2px dashed #3b82f6',
                    borderRadius: 8,
                    pointerEvents: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#3b82f6', fontWeight: 600,
                    zIndex: 10
                }}>
                    Drop files here to attach
                </div>
            )}
            
            {/* Attached Files Preview */}
            {attachedFiles.length > 0 && (
                <div style={{ width: '100%', padding: '0 0.5rem 0.5rem 0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.5rem' }}>
                    {attachedFiles.map((f: any, i: number) => (
                        <div key={i} style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4 }}>
                            {f.name}
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', width: '100%', alignItems: 'flex-end', gap: '0.5rem', flexDirection: 'column' }}>
                
                {/* MODE SELECTOR (Generic - uses modes from hook) */}
                <div style={{ 
                    alignSelf: 'flex-start', 
                    display: 'flex', 
                    gap: '0.25rem', 
                    padding: '2px', 
                    background: 'var(--surface)', 
                    borderRadius: 8, 
                    marginBottom: 4,
                    border: '1px solid var(--border)' 
                }}>
                    {/* Default modes available in Core */}
                    {(['chat', 'research'] as const).filter(m => {
                        // In Core, only show 'chat' and 'research' if the mode is active
                        // The list of available modes can be extended by the parent application via props
                        return meechi.activeMemories?.includes(m) || m === 'chat';
                    }).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => meechi.setMode(m)}
                            style={{
                                background: meechi.mode === m ? 'var(--accent)' : 'transparent',
                                color: meechi.mode === m ? 'var(--background)' : 'var(--secondary)',
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', gap: 4
                            }}
                        >
                            <Icon name={m === 'chat' ? "MessageCircle" : "Search"} size={14} /> 
                            {m.charAt(0).toUpperCase() + m.slice(1)}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', width: '100%', alignItems: 'flex-end', gap: '0.5rem' }}>
                <textarea 
                    ref={textareaRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={
                        meechi.mode === 'log' ? "Write to your Ship's Log..." :
                        meechi.mode === 'research' ? "Ask a grounded question (Strict RAG)..." :
                        "Ask Meechi anything... (Creative)"
                    }
                    onDragEnter={() => setIsDragOver(true)}
                    onDragLeave={() => setIsDragOver(false)}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDrop={async (e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            const files = Array.from(e.dataTransfer.files);
                            for (const file of files) {
                                const safeName = file.name.replace(/[^a-zA-Z0-9.\-_ ()]/g, '').replace(/\s+/g, ' ').trim();
                                const path = `temp/${safeName}`;
                                if (file.type.startsWith('text/') || file.name.endsWith('.md')) {
                                    const text = await file.text();
                                    await storage.saveFile(path, text);
                                } else {
                                    const buffer = await file.arrayBuffer();
                                    await storage.saveFile(path, buffer);
                                }
                                setAttachedFiles([...attachedFiles, { name: safeName, path }]);
                            }
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleChat(e as any);
                        }
                    }}
                    className={styles.chatInput}
                    rows={1}
                    style={{ width: '100%' }}
                    disabled={isVoiceActive} // Disable text input when voice is active
                />
                
                {/* Voice Toggle Button (Moved inside input area) */}
                <button
                    type="button"
                    onClick={() => {
                        const hasVoiceMsg = meechi.activeMemories?.includes('groq-voice') || meechi.activeMemories?.includes('local-voice');
                        if (hasVoiceMsg) toggleVoice();
                    }}
                    style={{
                        background: isVoiceActive ? 'var(--accent)' : 'transparent',
                        color: isVoiceActive ? 'white' : 'var(--secondary)',
                        border: 'none',
                        cursor: (meechi.activeMemories?.includes('groq-voice') || meechi.activeMemories?.includes('local-voice')) ? 'pointer' : 'default',
                        padding: '8px',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: isVoiceActive ? 1 : (meechi.activeMemories?.includes('groq-voice') || meechi.activeMemories?.includes('local-voice') ? 0.6 : 0.4),
                        transition: 'all 0.2s ease',
                        pointerEvents: (meechi.activeMemories?.includes('groq-voice') || meechi.activeMemories?.includes('local-voice')) ? 'auto' : 'none'
                    }}
                    title={(meechi.activeMemories?.includes('groq-voice') || meechi.activeMemories?.includes('local-voice')) ? "Toggle Voice Mode" : "Voice MCP not active"}
                >
                   <Mic size={20} />
                </button>

                {/* Send / Stop Button */}
                {(meechi.localAIStatus?.includes('Generating') || meechi.localAIStatus?.includes('Thinking') || state === 'speaking' || isPlaying || (state === 'processing')) ? (
                    <button 
                        type="button" 
                        onClick={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation();
                            if (isVoiceActive) {
                                stopPlayback(); // Stop Audio
                            }
                            meechi.stop(); // Stop LLM
                        }} 
                        className={styles.sendBtn} 
                        style={{ 
                             background: 'var(--destructive)', color: 'white'
                        }}
                    >
                        <Square size={16} fill="currentColor" />
                    </button>
                ) : (
                    <button type="submit" className={styles.sendBtn} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ArrowUp size={20} />
                    </button>
                )}
                </div>
            </div>
        </form>
    );
}
