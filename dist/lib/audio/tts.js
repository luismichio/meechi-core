// NOTE: KokoroTTS uses ONNX internally and @huggingface/transformers for env.
// We dynamically import from static vendor file to prevent SWC parse errors at build time.
export class SynthesizerService {
    static setCloudProvider(apiKey) {
        this.cloudKey = apiKey;
    }
    static async init() {
        // If we have an OpenAI Key (or cloud key), we don't strictly NEED to load local TTS immediately.
        // But we might want it as fallback.
        // Let's lazy load: If speak() fails on cloud, it initializes local.
        // So init() can be a no-op if cloud is ready, or run in background.
        const hasCloud = !!(this.cloudKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY);
        if (!hasCloud) {
            console.log("Initializing Local Kokoro TTS...");
            if (!this.tts) {
                // Dynamically import kokoro-js and configure env
                const { KokoroTTS } = await import('kokoro-js');
                // @ts-ignore - Load transformers from static vendor file
                let transformers = globalThis.transformers;
                if (!transformers) {
                    // @ts-ignore
                    transformers = await import(/* webpackIgnore: true */ '/vendor/transformers.js');
                }
                const { env } = transformers;
                env.allowLocalModels = false;
                env.useBrowserCache = true;
                this.tts = await KokoroTTS.from_pretrained(this.modelId, {
                    dtype: this.dtype,
                });
                console.log("Kokoro TTS Initialized");
            }
        }
        else {
            console.log("Cloud TTS Key detected. Local TTS deferred.");
        }
    }
    static async speak(text) {
        // 1. CLOUD TURBO MODE (OpenAI / Groq)
        // Check for specific keys in order: Injected -> OpenAI Env -> Groq Env
        const key = this.cloudKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
        if (key) {
            const isGroq = key.startsWith('gsk_');
            const url = isGroq
                ? "https://api.groq.com/openai/v1/audio/speech"
                : "https://api.openai.com/v1/audio/speech";
            // Groq requires specific model names.
            // 'playai-tts' is decommissioned. New default is 'canopylabs/orpheus-v1-english'.
            const model = isGroq ? "canopylabs/orpheus-v1-english" : "tts-1";
            console.log(`[TTS] Using Cloud TTS (${isGroq ? 'Groq' : 'OpenAI'})... Model: ${model}`);
            // Groq (Orpheus) supports specific voices: autumn, diana, hannah, austin, daniel, troy
            // OpenAI supports: alloy, echo, fable, etc.
            const voice = isGroq ? "diana" : "alloy";
            try {
                const res = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${key}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: model,
                        input: text,
                        voice: voice,
                        response_format: isGroq ? "wav" : "mp3",
                        speed: 1.15
                    })
                });
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`Cloud TTS Error (${res.status}): ${errText}`);
                }
                const blob = await res.blob();
                const arrayBuffer = await blob.arrayBuffer();
                // Decode MP3 to Float32
                const ctx = new AudioContext();
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                const pcm = audioBuffer.getChannelData(0); // Mono
                // Copy to new float array
                const pcmData = new Float32Array(pcm);
                const sampleRate = audioBuffer.sampleRate;
                ctx.close();
                return {
                    audio: pcmData,
                    sampling_rate: sampleRate
                };
            }
            catch (err) {
                console.warn("[TTS] Cloud failed, attempting local fallback:", err);
            }
        }
        // 2. LOCAL FALLBACK
        if (!this.tts) {
            console.log("Initializing Local Kokoro TTS (Fallback)...");
            // Dynamically import kokoro-js
            const { KokoroTTS } = await import('kokoro-js');
            // @ts-ignore - Load transformers from static vendor file
            let transformers = globalThis.transformers;
            if (!transformers) {
                // @ts-ignore
                transformers = await import(/* webpackIgnore: true */ '/vendor/transformers.js');
            }
            const { env } = transformers;
            env.allowLocalModels = false;
            env.useBrowserCache = true;
            this.tts = await KokoroTTS.from_pretrained(this.modelId, {
                dtype: this.dtype,
            });
        }
        if (!this.tts)
            return null;
        try {
            // Default voice: af_bella
            const audio = await this.tts.generate(text, {
                voice: "af_bella",
            });
            return audio;
        }
        catch (e) {
            console.error("TTS Synthesis Error:", e);
            return null;
        }
    }
}
SynthesizerService.tts = null; // KokoroTTS
SynthesizerService.modelId = "onnx-community/Kokoro-82M-ONNX";
SynthesizerService.dtype = "fp32";
// Cloud API Key (Optional)
SynthesizerService.cloudKey = null;
