import { mcpRegistry } from './McpRegistry';
import { MeechiNativeCore, GroqVoiceNative, LocalVoiceNative, LocalSyncNative } from './native';

/**
 * McpClient - The MCP Host/Client for Meechi
 * 
 * This class initializes the MCP registry with native (built-in) servers.
 * It acts as the "host" that manages tool providers.
 * 
 * Architecture:
 * - Native servers: In-process TypeScript classes (MeechiNativeCore, etc.)
 * - External servers: Real MCP protocol via SDK (coming in future releases)
 */
export class McpClient {
    constructor() {
        // 1. Mandatory Core System (permanent)
        mcpRegistry.registerServer(new MeechiNativeCore());
        
        // 2. Pluggable Native Servers (can be activated/deactivated)
        mcpRegistry.registerServer(new GroqVoiceNative());
        mcpRegistry.registerServer(new LocalVoiceNative());
        mcpRegistry.registerServer(new LocalSyncNative());
    }

    async getTools(): Promise<any[]> {
        const tools = await mcpRegistry.getAllTools();
        return tools.map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema
            }
        }));
    }

    async executeTool(name: string, args: any): Promise<any> {
        return await mcpRegistry.executeTool(name, args);
    }
}

// Global instance for the app
export const mcpClient = new McpClient();

// Re-exports
export { mcpRegistry } from './McpRegistry';
export * from './types';
export * from './native';
