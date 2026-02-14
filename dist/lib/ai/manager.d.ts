import { AIChatMessage, AITool, AICompletion, AIProvider } from "./types";
export interface AIConfig {
    activeProviderId: string;
    providers: {
        id: string;
        apiKey?: string;
        model?: string;
    }[];
    identity?: {
        name: string;
        tone: string;
    };
}
export declare class AIManager {
    private providers;
    constructor();
    registerProvider(provider: AIProvider): void;
    chat(userMessage: string, systemContext: string, history: AIChatMessage[], config: AIConfig, tools?: AITool[]): Promise<AICompletion>;
}
export declare const aiManager: AIManager;
