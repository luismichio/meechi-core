import { db } from '../../storage/db';
import { StorageProvider } from '../../storage/types';
import { GoogleDriveClient } from '../google-drive';
import { extractTextFromPdf } from '../../pdf';
import { handlePdfExtract } from './handlePdfExtract';
import { handleConflict } from './handleConflict';
import { DriveFile } from '../types';

export async function handleRemoteChange(
    driveFile: DriveFile,
    drive: GoogleDriveClient,
    storage: StorageProvider,
    getRootFolderId: () => Promise<string>,
    onProgress?: (msg: string) => void
) {
    const isFolder = driveFile.mimeType === 'application/vnd.google-apps.folder';
    
    // 1. Determine Local Path & VERIFY SCOPE
    const parentId = driveFile.parents?.[0];
    let parentPath = '';
    const rootId = await getRootFolderId();

    if (parentId) {
        if (parentId === rootId) {
            // Direct child of Meechi Journal -> OK
            parentPath = ''; // Root relative
        } else {
            // Child of subfolder -> Check if we know the parent
            const parentRecord = await db.files.where('remoteId').equals(parentId).first();
            if (parentRecord) {
                parentPath = parentRecord.path;
            } else {
                // UNKNOWN PARENT -> IGNORE
                return;
            }
        }
    } else {
        // No parent? Ignore.
        return;
    }

    const path = parentPath ? `${parentPath}/${driveFile.name}` : driveFile.name;
    
    // 2. Download Content (if file)
    let content = '';
    if (!isFolder) {
        const isText = driveFile.mimeType.startsWith('text/') || 
                       driveFile.mimeType === 'application/json' || 
                       driveFile.mimeType === 'application/javascript';
        
        const isPdf = driveFile.mimeType === 'application/pdf';

        if (isText) {
             onProgress?.(`Downloading text ${path}...`);
             try {
                 content = await drive.downloadFile(driveFile.id);
             } catch (e) {
                 console.error(`Failed to download ${driveFile.name}`, e);
                 onProgress?.(`Error downloading ${driveFile.name}`);
                 return; 
             }
        } else if (isPdf) {
            try {
                const binary = await drive.downloadBinary(driveFile.id);
                await handlePdfExtract(driveFile, binary, path, storage, onProgress);
            } catch (e) {
                console.error(`Failed to download binary for PDF ${driveFile.name}`, e);
                onProgress?.(`Error downloading PDF ${driveFile.name}`);
            }
            return; // CRITICAL: Return here to avoid overwriting the PDF record below with empty 'content' string
        }
    } else {
        onProgress?.(`Syncing folder ${path}...`);
    }

    // 3. Determine Local Conflict / Movement
    const localFile = await db.files.where('remoteId').equals(driveFile.id).first();
    
    const conflictResult = await handleConflict(driveFile, localFile, content, path);
    const finalContent = conflictResult.finalContent;
    const finalDirty = conflictResult.finalDirty;
    const finalUpdatedAt = conflictResult.finalUpdatedAt;
    const finalTags = conflictResult.finalTags;
    const finalMetadata = conflictResult.finalMetadata;

    // 3. Update/Insert DB
    // Preserve existing tags/metadata if updating
    const existingRecord = await db.files.get(path);

    await db.files.put({
        path,
        remoteId: driveFile.id,
        type: isFolder ? 'folder' : 'file',
        content: finalContent,
        updatedAt: finalUpdatedAt,
        dirty: finalDirty,
        tags: finalTags,
        metadata: finalMetadata
    });

    // Trigger semantic indexing for incoming files
    if (typeof finalContent === 'string') {
        storage.indexFile(path, finalContent);
    }
}
