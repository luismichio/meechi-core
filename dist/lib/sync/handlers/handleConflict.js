import { db } from '../../storage/db';
export async function handleConflict(driveFile, localFile, content, path) {
    var _a;
    let finalContent = content;
    let finalDirty = 0;
    let finalUpdatedAt = new Date(driveFile.modifiedTime).getTime();
    // 3b. Extract Metadata from AppProperties
    let remoteTags = [];
    let remoteMetadata = {};
    if ((_a = driveFile.appProperties) === null || _a === void 0 ? void 0 : _a.meechi_meta) {
        try {
            const parsed = JSON.parse(driveFile.appProperties.meechi_meta);
            remoteTags = parsed.tags || [];
            remoteMetadata = parsed.metadata || {};
        }
        catch (e) {
            console.warn(`[SyncDown] Failed to parse meechi_meta for ${path}`, e);
        }
    }
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
                    await db.files.put(Object.assign(Object.assign({}, child), { path: child.path.replace(oldPrefix, newPrefix) }));
                }
            }
            // When "moving" via delete+create, we must rely on 'localFile' variable to carry over metadata
            // But wait, the final DB put below handles the PRIMARY file. 
            // This block handles CHILDREN.
            await db.files.delete(localFile.path);
        }
    }
    return {
        finalContent,
        finalDirty,
        finalUpdatedAt,
        finalTags,
        finalMetadata
    };
}
