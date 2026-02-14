/**
 * NATIVE SERVER: LocalSyncNative
 *
 * Local Folder Synchronization capability.
 * Allows the browser-based IndexedDB to be mirrored to a local file system folder.
 *
 * This is a "capability" native - it exposes sync features rather than AI tools.
 */
export class LocalSyncNative {
    constructor() {
        this.id = "native-local-sync";
        this.name = "Native Local Folder Sync";
        this.description = "Mirrors your database to a local folder for backup and cross-browser sync.";
        this.isPermanent = false;
    }
    async getTools() {
        return [];
    }
    async executeTool(name, args) {
        throw new Error(`Tool ${name} not implemented in LocalSyncNative`);
    }
    // Capability check for Storage UI
    isSyncCapable() {
        return true;
    }
}
