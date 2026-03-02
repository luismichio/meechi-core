import { db } from '../../storage/db';
import { StorageProvider } from '../../storage/types';
import { extractTextFromPdf } from '../../pdf';
import { DriveFile } from '../types';

export async function handlePdfExtract(
    driveFile: DriveFile,
    binary: ArrayBuffer,
    path: string,
    storage: StorageProvider,
    onProgress?: (msg: string) => void
) {
    onProgress?.(`Extracting PDF Source ${path}...`);
    try {
        // Clone binary for extraction to avoid detachment issues if PDF.js transfers it
        const extractedText = await extractTextFromPdf(binary.slice(0));
        
        // Create/Update the Shadow Source File record
        const sourcePath = `${path}.source.md`; // e.g. misc/paper.pdf.source.md
        
        const sourceContent = `## Source: ${driveFile.name}\n\n${extractedText}`;

        await db.files.put({
            path: sourcePath,
            content: sourceContent,
            type: 'file',
            updatedAt: Date.now(),
            dirty: 1, // Mark as dirty so it syncs back up to Cloud!
            deleted: 0,
            tags: [],
            metadata: { isSource: true }
        });
        
        // Trigger semantic indexing for the newly created source
        storage.indexFile(sourcePath, sourceContent);

        // Update the actual PDF record with BINARY content (Local-First)
        const existingPdf = await db.files.get(path);
        await db.files.put({
            path: path,
            content: binary,
            updatedAt: new Date(driveFile.modifiedTime || Date.now()).getTime(),
            type: 'file',
            remoteId: driveFile.id,
            dirty: 0,
            deleted: 0,
            tags: existingPdf?.tags || [],
            metadata: existingPdf?.metadata || {}
        });

    } catch (e) {
        console.error(`Failed to extra PDF ${driveFile.name}`, e);
        onProgress?.(`Error indexing PDF ${driveFile.name}`);
    }
}
