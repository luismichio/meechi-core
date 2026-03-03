import { StorageProvider } from '../../storage/types';
import { DriveFile } from '../types';
export declare function handlePdfExtract(driveFile: DriveFile, binary: ArrayBuffer, path: string, storage: StorageProvider, onProgress?: (msg: string) => void): Promise<void>;
