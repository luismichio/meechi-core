export declare class VADService {
    private session;
    private h;
    private c;
    private sr;
    private readonly SAMPLE_RATE;
    private readonly WINDOW_SIZE_SAMPLES;
    private readonly THRESHOLD_START;
    private readonly THRESHOLD_END;
    private isSpeaking;
    constructor();
    init(modelPath?: string): Promise<void>;
    process(audioFrame: Float32Array): Promise<{
        isSpeech: boolean;
        probability: number;
    }>;
    reset(): void;
}
