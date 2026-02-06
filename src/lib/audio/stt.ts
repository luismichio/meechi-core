// NOTE: @xenova/transformers is imported dynamically to prevent SWC parse errors at build time.

// Define Types
type TranscriberPipeline = (audio: Float32Array | Float64Array, options?: any) => Promise<{ text: string }>;

export class TranscriberService {
    private static instance: TranscriberPipeline | null = null;
    // Upgrade to base.en for better accuracy/robustness than tiny
    private static modelId = 'Xenova/whisper-base.en'; 
    
    private static cloudKey: string | null = null;

    // Allow injecting key from outside (e.g. settings)
    static setCloudProvider(apiKey: string | null) {
        this.cloudKey = apiKey;
    }

    static async getInstance(): Promise<TranscriberPipeline> {
        if (!this.instance) {
            console.log(`Loading Metadata for ${this.modelId}...`);
            // Dynamically import @xenova/transformers
            const { pipeline, env } = await import('@xenova/transformers');
            env.allowLocalModels = false; 
            env.useBrowserCache = true;
            
            this.instance = await pipeline('automatic-speech-recognition', this.modelId, {
                // quantized: true, // Disable quantization to debug "empty text" issue
            }) as unknown as TranscriberPipeline;
            console.log("Transcriber Model Loaded");
        }
        return this.instance;
    }
    
    static async transcribe(audio: Float32Array): Promise<string> {
        if (audio.length === 0) return "";
        
        // Pass 1: Find Peak
        let max = 0;
        for(let i=0; i<audio.length; i++) {
            const abs = Math.abs(audio[i]);
            if (abs > max) max = abs;
        }

        // Pass 2: Normalize to 0.95 (Boost volume)
        const normalized = new Float32Array(audio.length);
        const scale = max > 0 ? 0.95 / max : 1;
        
        console.log(`[STT] Normalizing Audio. Peak: ${max.toFixed(4)} -> Scale: ${scale.toFixed(4)}`);
        
        for(let i=0; i<audio.length; i++) {
            normalized[i] = audio[i] * scale;
        }

        // CLOUD FAST PATH (GROQ)
        // If we have a cloud key, use Groq Whisper for 50x speedup
        if (this.cloudKey || process.env.NEXT_PUBLIC_GROQ_API_KEY) {
            const key = this.cloudKey || process.env.NEXT_PUBLIC_GROQ_API_KEY;
            console.log("[STT] Using Cloud Whisper (Groq) for speed...");
            try {
                // Convert Float32Array to WAV Blob
                const wavBlob = await this.encodeWAV(normalized);
                const formData = new FormData();
                formData.append('file', wavBlob, 'audio.wav');
                formData.append('model', 'whisper-large-v3'); // Groq supports large-v3
                formData.append('response_format', 'json');

                const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${key}`
                    },
                    body: formData
                });
                
                if (!res.ok) throw new Error(`Groq STT Error: ${res.status}`);
                const data = await res.json();
                console.log("[STT-Cloud] Result:", data.text);
                return data.text.trim();

            } catch (cloudErr) {
                 console.warn("[STT] Cloud failed, falling back to local:", cloudErr);
            }
        }

        // FALLBACK: Local Xenova
        try {
            const transcriber = await this.getInstance();
            // Simplified options to reduce potential conflicts
            const output = await transcriber(normalized, {
                 language: 'english', 
                 task: 'transcribe',
            });
            console.log("[STT-Local] Raw Output:", JSON.stringify(output, null, 2));
            return output.text.trim();
        } catch (e) {
            console.error("Transcription Error:", e);
            return "";
        }
    }

    // Helper: Encode Float32 to WAV for API upload
    private static encodeWAV(samples: Float32Array, sampleRate = 16000): Blob {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        const writeString = (view: DataView, offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        // RIFF chunk descriptor
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);

        // PCM Samples
        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s * 0x7FFF, true);
            offset += 2;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }
}
