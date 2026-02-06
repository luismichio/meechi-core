import { db, FileRecord } from '../storage/db';
import { GoogleDriveClient } from './google-drive';
import { extractTextFromPdf } from '../pdf';
import { StorageProvider } from '../storage/types';

const SYNC_TOKEN_KEY = 'drive_sync_token';
// Changing root folder name to break legacy links and force fresh start
const ROOT_FOLDER_NAME = 'Meechi-Core';

export class SyncEngine {
    private drive: GoogleDriveClient;
    private storage: StorageProvider;
    private syncing: boolean = false;

    constructor(drive: GoogleDriveClient, storage: StorageProvider) {
        this.drive = drive;
        this.storage = storage;
    }

    async sync(onProgress?: (msg: string) => void) {
        if (this.syncing) {
            console.log("Sync already in progress");
            return;
        }
        this.syncing = true;
        onProgress?.("Starting Sync...");
        console.log("Starting Sync...");

        try {
            // Attempt to pull changes first
            try {
                await this.syncDown(onProgress);
            } catch (downError) {
                console.error("SyncDown failed (continuing to SyncUp):", downError);
                onProgress?.("Pull failed. Taking only local changes...");
            }

            // Always try to push local changes afterwards
            await this.syncUp(onProgress);
            
            onProgress?.("Done");
            console.log("Sync Completed.");
        } catch (error) {
            console.error("Sync failed:", error);
            throw error; // Propagate to caller
        } finally {
            this.syncing = false;
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                                  SYNC DOWN                                 */
    /* -------------------------------------------------------------------------- */

    private async syncDown(onProgress?: (msg: string) => void) {
        onProgress?.("Checking Remote Changes...");
        // 1. Get saved sync token
        onProgress?.("DB: Reading Token...");
        const tokenRecord = await db.settings.get(SYNC_TOKEN_KEY);
        let pageToken = tokenRecord?.value;
        onProgress?.(`DB: Token = ${pageToken ? 'Found: ' + pageToken : 'Null'}`);

        // 2. If no token, perform full initial sync (or listFiles)
        if (!pageToken) {
            onProgress?.("Performing Initial Pull...");
            console.log("No sync token found. Performing initial list...");
            await this.performInitialPull(onProgress);
            // Get a token for next time
            pageToken = await this.drive.getStartPageToken();
            await db.settings.put({ key: SYNC_TOKEN_KEY, value: pageToken });
            return;
        }

        // 3. List changes since token
        let currentToken = pageToken;
        let pagesCount = 0;

        do {
            pagesCount++;
            const response = await this.drive.listChanges(currentToken);
            const changes = response.changes || [];
            
            console.log(`[SyncDown] Page ${pagesCount}: Received ${changes.length} changes.`);

            for (const change of changes) {
                if (change.removed) {
                    await this.handleRemoteDelete(change.fileId);
                } else if (change.file) {
                    await this.handleRemoteChange(change.file, onProgress);
                }
            }
            
            if (response.nextPageToken) {
                currentToken = response.nextPageToken;
            } else if (response.newStartPageToken) {
                // We are DONE. Save the new token for the next sync session.
                console.log(`[SyncDown] Finished. New start token: ${response.newStartPageToken}`);
                await db.settings.put({ key: SYNC_TOKEN_KEY, value: response.newStartPageToken });
                break;
            } else {
                console.warn("[SyncDown] No nextPageToken or newStartPageToken returned. Breaking.");
                break;
            }

            // Absolute safety break
            if (pagesCount > 100) break;

        } while (true);
    }

    private async performInitialPull(onProgress?: (msg: string) => void) {
        // Find our root folder ID first
        onProgress?.("Locating Root Folder...");
        const rootId = await this.getRootFolderId();
        
        onProgress?.("Rebuilding local database from Cloud...");
        console.log("Starting recursive initial pull from root:", rootId);

        const seenRemoteIds = new Set<string>();
        await this.recursivePull(rootId, seenRemoteIds, onProgress);
        
        // Clean up: Any local file that has a remoteId but WAS NOT seen in this pass
        // should be removed (as it no longer exists on Drive or moved out of scope).
        onProgress?.("Cleaning ghost files...");
        const localFiles = await db.files.toArray();
        let deletedCount = 0;
        for (const local of localFiles) {
            if (local.remoteId && !seenRemoteIds.has(local.remoteId) && !local.dirty) {
                console.log(`[SyncDown] Cleaning orphaned/deleted file: ${local.path}`);
                await db.files.delete(local.path);
                deletedCount++;
            }
        }
        console.log(`[SyncDown] Initial pull complete. Cleaned ${deletedCount} ghost files.`);
    }

    private async recursivePull(folderId: string, seenRemoteIds: Set<string>, onProgress?: (msg: string) => void) {
        const files = await this.drive.listFiles(`'${folderId}' in parents and trashed = false`);
        console.log(`[SyncDown] Recursive pull for folder ${folderId}: found ${files.length} children.`);
        
        for (const file of files) {
            seenRemoteIds.add(file.id);
            await this.handleRemoteChange(file, onProgress);
            
            if (file.mimeType === 'application/vnd.google-apps.folder') {
                await this.recursivePull(file.id, seenRemoteIds, onProgress);
            }
        }
    }

    private async handleRemoteDelete(fileId: string) {
        // Find local file by remoteId
        const localFile = await db.files.where('remoteId').equals(fileId).first();
        if (localFile) {
            await db.files.delete(localFile.path);
            console.log(`Deleted local file ${localFile.path} (remote delete)`);
        }
    }

    private async handleRemoteChange(driveFile: any, onProgress?: (msg: string) => void) {
        // driveFile has id, name, mimeType, parents, modifiedTime, appProperties
        const isFolder = driveFile.mimeType === 'application/vnd.google-apps.folder';
        
        // 1. Determine Local Path & VERIFY SCOPE
        const parentId = driveFile.parents?.[0];
        let parentPath = '';
        const rootId = await this.getRootFolderId();

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
                     content = await this.drive.downloadFile(driveFile.id);
                 } catch (e) {
                     console.error(`Failed to download ${driveFile.name}`, e);
                     onProgress?.(`Error downloading ${driveFile.name}`);
                     return; 
                 }
            } else if (isPdf) {
                // For PDFs, we DON'T put content in the PDF record.
                // We create a "Shadow Source" file: [filename].source.md
                onProgress?.(`Extracting PDF Source ${path}...`);
                try {
                    const binary = await this.drive.downloadBinary(driveFile.id);
                    // Clone binary for extraction to avoid detachment issues if PDF.js transfers it
                    const extractedText = await extractTextFromPdf(binary.slice(0));
                    
                    // Create/Update the Shadow Source File record
                    const sourcePath = `${path}.source.md`; // e.g. misc/paper.pdf.source.md
                    
                    // Check if source exists to preserve any manual summary edits?
                    // For now, we overwrite the text body but maybe keep a header?
                    // Let's just overwrite for now to ensure accuracy.
                    
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
                    this.storage.indexFile(sourcePath, sourceContent);

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
                return; // CRITICAL: Return here to avoid overwriting the PDF record below with empty 'content' string
            }
        } else {
            onProgress?.(`Syncing folder ${path}...`);
        }

        // 3. Determine Local Conflict / Movement
        const localFile = await db.files.where('remoteId').equals(driveFile.id).first();
        
        // 3b. Extract Metadata from AppProperties
        let remoteTags: string[] = [];
        let remoteMetadata: any = {};
        if (driveFile.appProperties?.meechi_meta) {
            try {
                const parsed = JSON.parse(driveFile.appProperties.meechi_meta);
                remoteTags = parsed.tags || [];
                remoteMetadata = parsed.metadata || {};
            } catch (e) {
                console.warn(`[SyncDown] Failed to parse meechi_meta for ${path}`, e);
            }
        }

        let finalContent: string | Blob | ArrayBuffer = content;
        let finalDirty = 0;
        let finalUpdatedAt = new Date(driveFile.modifiedTime).getTime();
        let finalTags = remoteTags;
        let finalMetadata = remoteMetadata;

        if (localFile) {
            // Check if content matches (checksum) to avoid spurious writes
            // Only verify checksum for STRING content. Binary diffing is expensive/complex.
            if (localFile.remoteId === driveFile.id && typeof content === 'string' && typeof localFile.content === 'string') {
                // Google drive doesn't provide MD5 for all files, but we can assume if timestamp differs we update anyway.
                // For now, we rely on modifiedTime for non-dirty files.
                // If remote modifiedTime is older or same as local, and local is not dirty, we can skip.
                if (new Date(driveFile.modifiedTime).getTime() <= localFile.updatedAt && !localFile.dirty) {
                    // Content is up-to-date or local is newer and not dirty, no need to update content.
                    // We still proceed to check for path changes below.
                    finalContent = localFile.content; // Keep existing local content
                    finalUpdatedAt = localFile.updatedAt; // Keep existing local updated time
                    finalTags = localFile.tags || [];
                    finalMetadata = localFile.metadata || {};
                }
            }

            // Keep local changes if dirty
            if (localFile.dirty) {
                finalContent = localFile.content;
                finalDirty = 1;
                finalUpdatedAt = localFile.updatedAt;
                finalTags = localFile.tags || [];
                finalMetadata = localFile.metadata || {};
            }

            // If path changed, remove old record
            if (localFile.path !== path) {
                console.log(`[SyncDown] Remote move detected: ${localFile.path} -> ${path}`);
                
                // If it's a folder, recursively move children too (safety)
                if (localFile.type === 'folder') {
                    const oldPrefix = localFile.path + '/';
                    const newPrefix = path + '/';
                    const children = await db.files.where('path').startsWith(oldPrefix).toArray();
                    for (const child of children) {
                        await db.files.delete(child.path);
                        await db.files.put({
                            ...child,
                            path: child.path.replace(oldPrefix, newPrefix)
                        });
                    }
                }
                // When "moving" via delete+create, we must rely on 'localFile' variable to carry over metadata
                // But wait, the final DB put below handles the PRIMARY file. 
                // This block handles CHILDREN.
                
                await db.files.delete(localFile.path);
            }
        }

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
            this.storage.indexFile(path, finalContent);
        }
    }


    /* -------------------------------------------------------------------------- */
    /*                                   SYNC UP                                  */
    /* -------------------------------------------------------------------------- */

    private async syncUp(onProgress?: (msg: string) => void) {
        onProgress?.("Checking Local Changes...");
        // 1. Get all dirty files
        const dirtyFiles = await db.files.where('dirty').equals(1).toArray();
        console.log(`[SyncUp] Found ${dirtyFiles.length} dirty files:`, dirtyFiles.map(f => f.path));
        // Sort by path depth so parents/folders processed before children
        dirtyFiles.sort((a, b) => a.path.split('/').length - b.path.split('/').length);

        if (dirtyFiles.length > 0) {
            onProgress?.(`Uploading ${dirtyFiles.length} files...`);
        }

        for (const file of dirtyFiles) {
            try {
                // HANDLE DELETE
                if (file.deleted) {
                    if (file.remoteId) {
                        onProgress?.(`Deleting ${this.getName(file.path)}...`);
                        try {
                            await this.drive.deleteFile(file.remoteId);
                            console.log(`Deleted remote file ${file.path}`);
                        } catch (e: any) {
                            // Check if 403 Forbidden (App created vs User created file scope)
                            const msg = e.toString() + (e.message || "");
                            if (msg.includes("403") || msg.includes("not granted")) {
                                console.warn(`Ignored 403 Forbidden on delete for ${file.path} (likely user-owned). Removing local record anyway.`);
                            } else {
                                throw e; // Retry later
                            }
                        }
                    }
                    // Hard delete local record after sync (or if ignored)
                    await db.files.delete(file.path);
                    continue;
                }

                if (file.remoteId) {
                    // UPDATE EXISTING
                    onProgress?.(`Updating ${this.getName(file.path)}...`);
                    
                    // 1. Update Content (if file)
                    if (file.type === 'file') {
                        await this.drive.updateFile(file.remoteId, file.content);
                    }
                    
                    // 2. Update Metadata (Rename / Move)
                    // We need to check if name or parent changed.
                    const name = this.getName(file.path);
                    const parentId = await this.resolveParentId(file.path);
                    
                    try {
                        const remoteFile = await this.drive.getFileMetadata(file.remoteId);
                        const updates: any = {};
                        
                        // Check Name
                        if (remoteFile.name !== name) {
                            updates.name = name;
                        }
                        
                        // Check Metadata Property
                        const metaJson = JSON.stringify({ tags: file.tags || [], metadata: file.metadata || {} });
                        if (remoteFile.appProperties?.meechi_meta !== metaJson) {
                            updates.appProperties = { meechi_meta: metaJson };
                        }
                        
                        // Check Parent (Move)
                        const currentRemoteParent = remoteFile.parents?.[0];
                        
                        if (parentId && currentRemoteParent !== parentId) {
                            updates.addParents = [parentId];
                            if (remoteFile.parents && remoteFile.parents.length > 0) {
                                updates.removeParents = remoteFile.parents;
                            }
                        }
                        
                        if (Object.keys(updates).length > 0) {
                            await this.drive.updateMetadata(file.remoteId, updates);
                            console.log(`Updated metadata for ${file.path}`, updates);
                        }
                    } catch (e) {
                         console.warn(`Metadata check failed for ${file.path}`, e);
                    }

                    // Mark clean
                    await db.files.update(file.path, { dirty: 0, updatedAt: Date.now() });

                } else {
                    // CREATE NEW
                    onProgress?.(`Creating ${this.getName(file.path)}...`);
                    const parentId = await this.resolveParentId(file.path);
                    const name = this.getName(file.path);
                    
                    let res;
                    if (file.type === 'folder') {
                        res = await this.drive.createFolder(name, parentId);
                    } else {
                        const appProperties = {
                             meechi_meta: JSON.stringify({ tags: file.tags || [], metadata: file.metadata || {} })
                        };
                        res = await this.drive.createFile(name, parentId || null, file.content, appProperties);
                    }
                    
                    // Update local with new Remote ID
                    await db.files.update(file.path, { 
                        remoteId: res.id, 
                        dirty: 0, 
                        updatedAt: Date.now() 
                    });
                    console.log(`Created remote file ${file.path}`);
                }
            } catch (e) {
                console.error(`Failed to sync up ${file.path}`, e);
                onProgress?.(`Error syncing ${this.getName(file.path)}`);
            }
        }
    }

    private getName(path: string) {
        return path.split('/').pop() || path;
    }

    private async getRootFolderId(): Promise<string> {
        // Check cache with NEW key to force refresh
        const cached = await db.settings.get('drive_root_id_writable');
        if (cached) return cached.value;

        // Find remote (name = ROOT_FOLDER_NAME)
        // Issue: 'drive.readonly' scope lets us see folders we can't write to.
        // We must ensure we pick a folder we can write to.
        const files: any[] = await this.drive.listFiles(`mimeType = 'application/vnd.google-apps.folder' and name = '${ROOT_FOLDER_NAME}' and trashed = false`);
        
        let rootId;
        const writableFolder = files.find(f => f.capabilities?.canAddChildren); // Ensure we have write access

        if (writableFolder) {
            rootId = writableFolder.id; // Use existing writable folder
            console.log(`Found existing writable root: ${rootId}`);
        } else {
            // Create new
            try {
                const folder = await this.drive.createFolder(ROOT_FOLDER_NAME);
                rootId = folder.id;
                console.log(`Created new root: ${rootId}`);
            } catch (e) {
                console.error("Failed to create Meechi Journal root", e);
                // Fallback? Rethrow?
                throw e; 
            }
        }

        // Cache it
        await db.settings.put({ key: 'drive_root_id_writable', value: rootId });
        return rootId;
    }

    private async resolveParentId(path: string): Promise<string> {
        const parts = path.split('/');
        
        // If it's a top-level file (e.g. "misc", "history")
        // The parent is the Root.
        if (parts.length <= 1) {
             return await this.getRootFolderId();
        }
        
        // Parent Path (e.g. "misc/Research")
        const parentPath = parts.slice(0, -1).join('/');
        const parentName = parts[parts.length - 2]; 

        // 1. Check local DB for Parent
        const parent = await db.files.get(parentPath);

        // 2. If parent has remoteId, we are good.
        if (parent?.remoteId) return parent.remoteId;

        console.log(`Parent ${parentPath} has no remoteId. Resolving...`);

        // 3. Recursive Step: Get Grandparent ID
        // (This ensures we build the tree from top down)
        const grandParentId = await this.resolveParentId(parentPath);

        // 4. Create this folder (if not clean)
        // If we found it locally but no remoteId, create it.
        // If we didn't find it locally, create it locally & remotely.

        // Check if it already exists on remote (name + parent)?
        // To avoid duplicates if we just lost the link.
        // For simplicity/safety, let's list children of grandParentId with this name.
        const existing = await this.drive.listFiles(`'${grandParentId}' in parents and name = '${parentName}' and trashed = false and mimeType = 'application/vnd.google-apps.folder'`);
        
        let folderId;
        if (existing.length > 0) {
            folderId = existing[0].id;
            console.log(`Found existing remote folder for ${parentPath}: ${folderId}`);
        } else {
            console.log(`Creating new remote folder for ${parentPath}...`);
            const created = await this.drive.createFolder(parentName, grandParentId);
            folderId = created.id;
        }

        // 5. Update/Save Local Record
        if (!parent) {
             await db.files.put({
                 path: parentPath,
                 remoteId: folderId,
                 type: 'folder',
                 content: '',
                 updatedAt: Date.now(),
                 dirty: 0 // We just synced it effectively
             });
        } else {
            await db.files.update(parentPath, {
                remoteId: folderId,
                dirty: 0
            });
        }

        return folderId;
    }
}
