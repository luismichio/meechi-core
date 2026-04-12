type TranscriberPipeline = (audio: Float32Array | Float64Array, options?: any) => Promise<{
    text: string;
}>;
export declare class TranscriberService {
    private static instance;
    private static modelId;
    private static cloudKey;
    static setCloudProvider(apiKey: string | null): void;
    static getInstance(): Promise<TranscriberPipeline>;
    static transcribe(audio: Float32Array): Promise<string>;
    private static encodeWAV;
}
export {};
