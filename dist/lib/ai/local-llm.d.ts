import { AIChatMessage, AITool } from "./types";
export declare class WebLLMService {
    private engine;
    private loading;
    private currentModelId;
    private initPromise;
    private progressListeners;
    private worker;
    /**
     * Connect to or Initialize the Engine via Web Worker
     */
    initialize(modelId: string, progressCallback?: (text: string) => void, config?: {
        context_window?: number;
    }): Promise<void>;
    isInitialized(): boolean;
    chat(messages: AIChatMessage[], onUpdate: (chunk: string) => void, options?: {
        tools?: AITool[];
        temperature?: number;
        top_p?: number;
        stop?: string[];
    }): Promise<string>;
    isLoading(): boolean;
    getModelId(): string | null;
    interrupt(): Promise<void>;
    /**
     * Completely unload the engine and terminate the worker to free memory.
     */
    unload(): Promise<void>;
}
export declare const localLlmService: WebLLMService;
