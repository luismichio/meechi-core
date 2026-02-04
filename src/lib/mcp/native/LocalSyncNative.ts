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
export class LocalSyncNative implements McpConnector {
    id = "native-local-sync";
    name = "Native Local Folder Sync";
    description = "Mirrors your database to a local folder for backup and cross-browser sync.";
    isPermanent = false;

    async getTools(): Promise<McpTool[]> {
        return [];
    }

    async executeTool(name: string, args: any): Promise<any> {
        throw new Error(`Tool ${name} not implemented in LocalSyncNative`);
    }

    // Capability check for Storage UI
    isSyncCapable(): boolean {
        return true;
    }
}
