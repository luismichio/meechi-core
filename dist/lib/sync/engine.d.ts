import { GoogleDriveClient } from './google-drive';
import { StorageProvider } from '../storage/types';
export declare class SyncEngine {
    private drive;
    private storage;
    private syncing;
    constructor(drive: GoogleDriveClient, storage: StorageProvider);
    sync(onProgress?: (msg: string) => void): Promise<void>;
    private syncDown;
    private performInitialPull;
    private recursivePull;
    private handleRemoteDelete;
    private handleRemoteChange;
    private syncUp;
    private getName;
    private getRootFolderId;
    private resolveParentId;
}
