import { AIProvider, AIChatMessage, AITool, AICompletion } from "../types";
export declare class GeminiProvider implements AIProvider {
    id: string;
    name: string;
    chat(model: string, messages: AIChatMessage[], tools?: AITool[], apiKey?: string): Promise<AICompletion>;
}
