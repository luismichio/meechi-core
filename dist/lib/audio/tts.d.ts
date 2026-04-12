export declare class SynthesizerService {
    private static tts;
    private static modelId;
    private static dtype;
    private static cloudKey;
    static setCloudProvider(apiKey: string | null): void;
    static init(): Promise<void>;
    static speak(text: string): Promise<{
        audio: Float32Array;
        sampling_rate: number;
    } | null>;
}
