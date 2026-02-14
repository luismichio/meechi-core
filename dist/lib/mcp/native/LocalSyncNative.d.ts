import { McpTool } from '../types';
import { McpConnector } from '../McpRegistry';
/**
 * NATIVE SERVER: LocalSyncNative
 *
 * Local Folder Synchronization capability.
 * Allows the browser-based IndexedDB to be mirrored to a local file system folder.
 *
 * This is a "capability" native - it exposes sync features rather than AI tools.
 */
export declare class LocalSyncNative implements McpConnector {
    id: string;
    name: string;
    description: string;
    isPermanent: boolean;
    getTools(): Promise<McpTool[]>;
    executeTool(name: string, args: any): Promise<any>;
    isSyncCapable(): boolean;
}
