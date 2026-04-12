import { DriveFile } from '../types';
export declare function handleConflict(driveFile: DriveFile, localFile: any, content: string | Blob | ArrayBuffer, path: string): Promise<{
    finalContent: string | Blob | ArrayBuffer;
    finalDirty: number;
    finalUpdatedAt: number;
    finalTags: string[];
    finalMetadata: any;
}>;
