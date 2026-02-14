export declare class AudioInputService {
    private audioContext;
    private stream;
    private processor;
    private source;
    private analyser;
    private readonly SAMPLE_RATE;
    constructor();
    getAnalyser(): AnalyserNode | null;
    start(onAudioData: (data: Float32Array) => void): Promise<void>;
    stop(): void;
    private downsampleBuffer;
}
