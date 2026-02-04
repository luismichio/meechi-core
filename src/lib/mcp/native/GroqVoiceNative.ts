import { McpTool } from '../types';
import { McpConnector } from '../McpRegistry';

/**
 * NATIVE SERVER: GroqVoiceNative
 * 
 * Cloud Voice capability for Groq.
 * Enables high-speed voice interaction when a Groq key is available.
 * 
 * This is a "capability" native - it exposes UI features rather than AI tools.
 */
export class GroqVoiceNative implements McpConnector {
    id = "native-groq-voice";
    name = "Native Cloud Voice (Groq)";
    description = "High-speed cloud voice interaction via Groq. Requires a valid API key.";
    isPermanent = false;

    private apiKey?: string;

    constructor(apiKey?: string) {
        this.apiKey = apiKey;
    }

    async getTools(): Promise<McpTool[]> {
        // Voice doesn't necessarily expose tools to the AI, 
        // it exposes capabilities to the UI.
        return [];
    }

    async executeTool(name: string, args: any): Promise<any> {
        throw new Error(`Tool ${name} not implemented in GroqVoiceNative`);
    }

    // Custom capability for the UI to check
    isVoiceReady(): boolean {
        return !!this.apiKey;
    }
}
