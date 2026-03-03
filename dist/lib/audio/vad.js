let ort = null;
export class VADService {
    constructor() {
        this.session = null; // ort.InferenceSession
        this.h = null; // ort.Tensor
        this.c = null; // ort.Tensor
        this.sr = null; // ort.Tensor
        this.SAMPLE_RATE = 16000;
        this.WINDOW_SIZE_SAMPLES = 512; // 32ms at 16kHz
        // Thresholds
        this.THRESHOLD_START = 0.3; // Increased to avoid trigger on static
        this.THRESHOLD_END = 0.15;
        // State
        this.isSpeaking = false;
    }
    async init(modelPath = '/models/silero_vad.onnx') {
        try {
            // Dynamically import onnxruntime-web to prevent SWC from parsing it at build time.
            if (!ort) {
                ort = await import('onnxruntime-web');
                ort.env.logLevel = 'error'; // Silence benign warnings
            }
            // Initialize ONNX session
            this.session = await ort.InferenceSession.create(modelPath, {
                executionProviders: ['wasm'], // Force WASM for consistency
                logSeverityLevel: 3, // 0:Verbose, 1:Info, 2:Warning, 3:Error, 4:Fatal
            });
            // Initialize states (2, 1, 64) float32
            const dims = [2, 1, 64];
            const size = 128;
            this.h = new ort.Tensor('float32', new Float32Array(size).fill(0), dims);
            this.c = new ort.Tensor('float32', new Float32Array(size).fill(0), dims);
            // Sample rate tensor (Must be int64)
            this.sr = new ort.Tensor('int64', BigInt64Array.from([BigInt(this.SAMPLE_RATE)]), [1]);
            console.log("VADService initialized");
        }
        catch (e) {
            console.error("Failed to initialize VAD:", e);
            throw e;
        }
    }
    async process(audioFrame) {
        if (!this.session || !this.h || !this.c || !this.sr || !ort) {
            return { isSpeech: false, probability: 0 };
        }
        try {
            // Create Input Tensor: (1, N)
            const input = new ort.Tensor('float32', audioFrame, [1, audioFrame.length]);
            // Check input names to support both v4 and v5
            const inputNames = this.session.inputNames;
            const feeds = {
                input: input,
                sr: this.sr,
            };
            if (inputNames.includes('state')) {
                // Silero v5: Combined state [2, 1, 128]
                const targetShape = [2, 1, 128];
                const targetSize = 256;
                // 1. Validate 'h' existence and size
                if (!this.h || this.h.data.length !== targetSize) {
                    this.h = new ort.Tensor('float32', new Float32Array(targetSize).fill(0), targetShape);
                }
                // 2. Validate 'h' dimensions (Reshape if needed)
                else if (this.h.dims.length !== 3 || this.h.dims[0] !== 2 || this.h.dims[1] !== 1 || this.h.dims[2] !== 128) {
                    // Reshape keeping data
                    this.h = new ort.Tensor('float32', this.h.data, targetShape);
                }
                feeds['state'] = this.h;
            }
            else {
                // ... v4 logic ...
                feeds['h'] = this.h;
                feeds['c'] = this.c;
            }
            const results = await this.session.run(feeds);
            const probability = results.output.data[0];
            // Update states
            if (inputNames.includes('state')) {
                const rawState = results.stateN || results.state;
                // Bug Fix: Silero V5 might Output weird shapes (e.g. {1,1,1,128,8}) in some envs
                // We force reshape back to [2, 1, 128] for consistency in the next loop.
                if (rawState) {
                    const targetShape = [2, 1, 128];
                    if (rawState.dims.length !== 3 || rawState.dims[0] !== 2) {
                        this.h = new ort.Tensor('float32', rawState.data, targetShape);
                    }
                    else {
                        this.h = rawState;
                    }
                }
            }
            else {
                this.h = results.hn;
                this.c = results.cn;
            }
            // Trigger logic
            if (probability > this.THRESHOLD_START && !this.isSpeaking) {
                this.isSpeaking = true;
            }
            else if (probability < this.THRESHOLD_END && this.isSpeaking) {
                this.isSpeaking = false;
            }
            return { isSpeech: this.isSpeaking, probability };
        }
        catch (e) {
            console.error("VAD Inference Error:", e);
            return { isSpeech: false, probability: 0 };
        }
    }
    reset() {
        // Reset states
        // We set to null so they re-init on next process() call with correct v4/v5 logic
        this.h = null;
        this.c = null;
        this.isSpeaking = false;
    }
}
