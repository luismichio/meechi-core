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
export declare class McpClient {
    constructor();
    getTools(): Promise<any[]>;
    executeTool(name: string, args: any): Promise<any>;
}
export declare const mcpClient: McpClient;
export { mcpRegistry } from './McpRegistry';
export * from './types';
export * from './native';
