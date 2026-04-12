export class AudioInputService {
    constructor() {
        this.audioContext = null;
        this.stream = null;
        this.processor = null; // Fallback or AudioWorklet
        this.source = null;
        this.analyser = null;
        // Whisper typically expects 16kHz
        this.SAMPLE_RATE = 16000;
    }
    getAnalyser() {
        return this.analyser;
    }
    async start(onAudioData) {
        if (this.stream)
            return;
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: this.SAMPLE_RATE
                }
            });
            this.audioContext = new AudioContext({ sampleRate: this.SAMPLE_RATE });
            console.log(`[AudioInput] AudioContext created. Requested: ${this.SAMPLE_RATE}, Actual: ${this.audioContext.sampleRate}`);
            await this.audioContext.resume(); // Ensure running
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            // Mute the monitoring to prevent feedback (Microphone -> Speaker loop)
            const muteNode = this.audioContext.createGain();
            muteNode.gain.value = 0;
            this.processor.connect(muteNode);
            muteNode.connect(this.audioContext.destination);
            let buffer = new Float32Array(0);
            const TARGET_CHUNK_SIZE = 512;
            this.processor.onaudioprocess = (e) => {
                let inputData = e.inputBuffer.getChannelData(0);
                // Software Gain (1.5x) - Reduced from 3x/5x to fix clipping/distortion
                const GAIN_FACTOR = 1.5;
                const amplified = new Float32Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    amplified[i] = inputData[i] * GAIN_FACTOR;
                }
                inputData = amplified;
                // DOWNSAMPLE if mismatch (e.g. 48k -> 16k)
                if (this.audioContext && this.audioContext.sampleRate !== this.SAMPLE_RATE) {
                    inputData = this.downsampleBuffer(inputData, this.audioContext.sampleRate, this.SAMPLE_RATE);
                }
                // Append
                const newBuffer = new Float32Array(buffer.length + inputData.length);
                newBuffer.set(buffer, 0);
                newBuffer.set(inputData, buffer.length);
                buffer = newBuffer;
                while (buffer.length >= TARGET_CHUNK_SIZE) {
                    const chunk = buffer.slice(0, TARGET_CHUNK_SIZE);
                    buffer = buffer.slice(TARGET_CHUNK_SIZE);
                    onAudioData(chunk);
                }
            };
            // Connect graph: Source -> Analyser -> Processor -> Destination
            this.source.connect(this.analyser);
            this.analyser.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            console.log("[AudioInput] Engine started successfully");
        }
        catch (err) {
            console.error("AudioInputService Error:", err);
            throw err;
        }
    }
    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
    // Helper: Simple Linear Interpolation Downsampler
    downsampleBuffer(buffer, sampleRate, outSampleRate) {
        if (outSampleRate === sampleRate)
            return buffer;
        if (outSampleRate > sampleRate) {
            console.warn("[AudioInput] Upsampling not supported, returning original");
            return buffer;
        }
        const sampleRateRatio = sampleRate / outSampleRate;
        const newLength = Math.round(buffer.length / sampleRateRatio);
        const result = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < result.length) {
            const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            // Average values in the range
            let accum = 0, count = 0;
            for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
            }
            result[offsetResult] = count > 0 ? accum / count : 0;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return result;
    }
}
