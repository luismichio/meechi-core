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
export declare class GroqVoiceNative implements McpConnector {
    id: string;
    name: string;
    description: string;
    isPermanent: boolean;
    private apiKey?;
    constructor(apiKey?: string);
    getTools(): Promise<McpTool[]>;
    executeTool(name: string, args: any): Promise<any>;
    isVoiceReady(): boolean;
}
