import { StorageProvider } from '../../storage/types';
import { GoogleDriveClient } from '../google-drive';
import { DriveFile } from '../types';
export declare function handleRemoteChange(driveFile: DriveFile, drive: GoogleDriveClient, storage: StorageProvider, getRootFolderId: () => Promise<string>, onProgress?: (msg: string) => void): Promise<void>;
