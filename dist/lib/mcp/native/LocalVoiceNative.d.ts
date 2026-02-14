import { McpTool } from '../types';
import { McpConnector } from '../McpRegistry';
/**
 * NATIVE SERVER: LocalVoiceNative
 *
 * Experimental Local Voice capability.
 * Uses client-side ONNX models (Whisper/Kokoro) for private, offline interaction.
 *
 * This is a "capability" native - it exposes UI features rather than AI tools.
 */
export declare class LocalVoiceNative implements McpConnector {
    id: string;
    name: string;
    description: string;
    isPermanent: boolean;
    getTools(): Promise<McpTool[]>;
    executeTool(name: string, args: any): Promise<any>;
    isVoiceCapable(): boolean;
}
