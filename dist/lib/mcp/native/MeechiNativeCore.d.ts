import { McpTool } from '../types';
import { McpConnector } from '../McpRegistry';
/**
 * NATIVE SERVER: MeechiNativeCore
 *
 * The permanent, mandatory internal tool provider.
 * Contains core file management and knowledge tools.
 *
 * This is a "Native" server - an in-process TypeScript class that follows
 * the MCP interface pattern but does NOT use the actual MCP protocol
 * (no JSON-RPC, no IPC). It's part of the same runtime as the host.
 */
export declare class MeechiNativeCore implements McpConnector {
    id: string;
    name: string;
    description: string;
    isPermanent: boolean;
    private tools;
    private storage;
    constructor();
    private registerTools;
    private addTool;
    getTools(): Promise<McpTool[]>;
    executeTool(name: string, args: any): Promise<any>;
}
