import { db } from './db';
import { migrateFromIdbToDexie, migrateJournal } from './migrate';
import { generateEmbedding, chunkText, cosineSimilarity } from '../ai/embeddings';
export class LocalStorageProvider {
    setSyncEngine(engine) {
        this.syncEngine = engine;
    }
    async init() {
        // Run migration logic once on init
        await migrateFromIdbToDexie();
        await migrateJournal();
    }
    async indexFile(path, content) {
        var _a;
        // Only index text-based files in knowledge base (misc/ or source files) AND history logs
        const isKnowledge = path.startsWith('misc/') || path.endsWith('.source.md') || path.startsWith('history/');
        if (!isKnowledge)
            return;
        try {
            console.log(`[RAG] Indexing ${path}...`);
            // 2. Fetch metadata to include comments in indexing
            const file = await db.files.get(path);
            const comments = ((_a = file === null || file === void 0 ? void 0 : file.metadata) === null || _a === void 0 ? void 0 : _a.comments) || [];
            let fullText = content;
            if (comments.length > 0) {
                const commentText = comments
                    .filter((c) => { var _a; return (_a = c.text) === null || _a === void 0 ? void 0 : _a.trim(); }) // Only include non-empty comments
                    .map((c) => c.text)
                    .join('\n');
                if (commentText) {
                    fullText += "\n\n### User Notes & Comments\n" + commentText;
                }
            }
            // 4. Clear old chunks for this file
            await db.chunks.where('filePath').equals(path).delete();
            // 5. Chunk text
            const chunks = chunkText(fullText);
            // 6. Generate embeddings and save
            for (const text of chunks) {
                const embedding = await generateEmbedding(text);
                await db.chunks.add({
                    filePath: path,
                    content: text,
                    embedding
                });
            }
            console.log(`[RAG] Finished indexing ${path} (${chunks.length} chunks).`);
        }
        catch (e) {
            console.error(`[RAG] Failed to index ${path}`, e);
        }
    }
    async listFiles(prefix) {
        // Dexie 'startsWith' query
        // "misc" -> "misc/"
        // BUT: our paths are 'misc/foo.txt'.
        // If prefix is '', get all.
        let collection;
        if (!prefix || prefix === 'root') {
            collection = db.files.toCollection();
        }
        else {
            // We want all files that START with "{prefix}/" OR equal "{prefix}" (if it's a file)
            // Actually, the File Explorer passes 'misc'.
            // We want 'misc/foo', 'misc/bar'.
            // We want 'misc/foo', 'misc/bar'.
            collection = db.files.where('path').startsWith(prefix);
        }
        const records = await collection.filter(f => !f.deleted).toArray();
        return records.map(r => ({
            id: r.path,
            name: r.path.split('/').pop() || r.path,
            path: r.path,
            updatedAt: r.updatedAt,
            type: r.type,
            remoteId: r.remoteId,
            tags: r.tags,
            metadata: r.metadata
        }));
    }
    async getFile(virtualPath) {
        const item = await db.files.get(virtualPath);
        if (!item || item.deleted)
            return null;
        return {
            id: item.path,
            name: item.path.split('/').pop() || item.path,
            path: item.path,
            type: item.type,
            updatedAt: item.updatedAt,
            remoteId: item.remoteId,
            tags: item.tags,
            metadata: item.metadata
        };
    }
    async readFile(virtualPath) {
        const file = await db.files.get(virtualPath);
        if (!file || file.deleted)
            return null;
        return file.content;
    }
    async saveFile(virtualPath, content, remoteId, tags, metadata) {
        await this.ensureParent(virtualPath);
        // Optimistic Update
        await db.transaction('rw', db.files, async () => {
            const existing = await db.files.get(virtualPath);
            await db.files.put({
                path: virtualPath,
                content: content,
                updatedAt: Date.now(),
                type: virtualPath.endsWith('.source.md') ? 'source' : 'file',
                remoteId: remoteId || (existing === null || existing === void 0 ? void 0 : existing.remoteId), // Preserve remoteId if updating content locally
                dirty: 1, // Mark as dirty (needs sync up)
                deleted: 0,
                tags: tags !== undefined ? tags : (existing === null || existing === void 0 ? void 0 : existing.tags) || [],
                metadata: metadata !== undefined ? metadata : (existing === null || existing === void 0 ? void 0 : existing.metadata) || {}
            });
        });
        if (typeof content === 'string') {
            this.indexFile(virtualPath, content);
        }
    }
    async updateMetadata(virtualPath, updates) {
        console.log('[Storage] updateMetadata called for:', virtualPath);
        console.log('[Storage] Updates:', updates);
        await db.transaction('rw', db.files, async () => {
            const existing = await db.files.get(virtualPath);
            if (!existing)
                throw new Error(`File not found: ${virtualPath}`);
            console.log('[Storage] Existing file found, updating...');
            await db.files.update(virtualPath, Object.assign(Object.assign({}, updates), { updatedAt: Date.now(), dirty: 1 }));
            console.log('[Storage] Database updated successfully');
        });
    }
    async getFilesByTag(tag) {
        const records = await db.files.where('tags').equals(tag).filter(f => !f.deleted).toArray();
        return records.map(r => ({
            id: r.path,
            name: r.path.split('/').pop() || r.path,
            path: r.path,
            updatedAt: r.updatedAt,
            type: r.type,
            remoteId: r.remoteId,
            tags: r.tags,
            metadata: r.metadata
        }));
    }
    async appendFile(virtualPath, content, skipIndex = false) {
        await this.ensureParent(virtualPath);
        let finalContent = "";
        await db.transaction('rw', db.files, async () => {
            const existing = await db.files.get(virtualPath);
            finalContent = (existing && typeof existing.content === 'string')
                ? (existing.content + '\n\n' + content)
                : content;
            await db.files.put({
                path: virtualPath,
                content: finalContent,
                updatedAt: Date.now(),
                type: 'file',
                remoteId: existing === null || existing === void 0 ? void 0 : existing.remoteId,
                dirty: 1,
                deleted: 0
            });
        });
        // Background Indexing (skipped if requested, e.g. for high-speed voice chat)
        if (!skipIndex) {
            this.indexFile(virtualPath, finalContent);
        }
    }
    async updateFile(virtualPath, newContent) {
        // 1. Verify existence (Logic: Can only update what exists)
        const existing = await db.files.get(virtualPath);
        if (!existing || existing.deleted) {
            throw new Error(`File '${virtualPath}' not found. Cannot update.`);
        }
        // 2. Perform Update (Overwrite content)
        await db.transaction('rw', db.files, async () => {
            await db.files.update(virtualPath, {
                content: newContent,
                updatedAt: Date.now(),
                dirty: 1, // Mark dirty for sync
                deleted: 0
            });
        });
        // 3. Re-Index for RAG
        this.indexFile(virtualPath, newContent);
    }
    async getRecentLogs(limitHours) {
        const now = new Date();
        const startTime = new Date(now.getTime() - limitHours * 60 * 60 * 1000);
        // Get Dates for Today and Yesterday (using local time logic implicitly via Date)
        const todayDate = new Date();
        const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const todayStr = this.formatDate(todayDate);
        const yesterdayStr = this.formatDate(yesterdayDate);
        let logs = "";
        // 1. If window crosses midnight (start time is yesterday), read yesterday's log first
        let yesterdayContent = null;
        if (startTime.getDate() !== now.getDate()) {
            yesterdayContent = await this.readFile(`history/${yesterdayStr}.md`);
            if (typeof yesterdayContent === 'string') {
                logs += this.filterLogByTime(yesterdayContent, startTime, yesterdayDate) + "\n";
            }
        }
        // 2. Read Today's log
        const todayContent = await this.readFile(`history/${todayStr}.md`);
        if (typeof todayContent === 'string') {
            logs += this.filterLogByTime(todayContent, startTime, todayDate);
        }
        console.log(`[Storage] getRecentLogs for ${limitHours}h. Files: ${yesterdayStr}(${typeof yesterdayContent}), ${todayStr}(${typeof todayContent}). Total Len: ${logs.length}`);
        return logs || "No recent history.";
    }
    formatDate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    filterLogByTime(content, startTime, fileDate) {
        const blocks = content.split('###');
        let result = "";
        for (const block of blocks) {
            if (!block.trim())
                continue;
            // Extract Time: " 10:30:05 PM", " 10:30 PM", or "22:30"
            // Regex: support optional seconds (?::\d{2})?
            const timeMatch = block.match(/^\s*(\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)?)/i);
            if (timeMatch) {
                const timeStr = timeMatch[1];
                // Parse Time
                const entryDate = new Date(fileDate);
                const [time, modifier] = timeStr.trim().split(' ');
                let [hours, minutes, seconds] = time.split(':').map(Number);
                // Handle optional seconds
                if (isNaN(seconds))
                    seconds = 0;
                if (modifier) {
                    if (modifier.toUpperCase() === 'PM' && hours < 12)
                        hours += 12;
                    if (modifier.toUpperCase() === 'AM' && hours === 12)
                        hours = 0;
                }
                entryDate.setHours(hours, minutes, seconds);
                if (entryDate >= startTime) {
                    result += '###' + block;
                }
            }
            else {
                // Include blocks without timestamp (e.g. continuations or system headers)
                // if they are part of the file we typically assume they are relevant if the file is relevant.
                // But for safety in a rolling window, maybe we skip if we can't date it?
                // Actually, 'Added Source' logs might be system logs with timestamps.
                // If it HAS NO timestamp, it might be garbage or noise. Let's keep it to be safe.
                result += '###' + block;
            }
        }
        return result;
    }
    async renameFile(oldPath, newPath) {
        await this.ensureParent(newPath);
        await db.transaction('rw', db.files, db.chunks, async () => {
            const existing = await db.files.get(oldPath);
            if (!existing)
                throw new Error(`File not found: ${oldPath}`);
            // 1. Rename the item itself
            await db.files.put(Object.assign(Object.assign({}, existing), { path: newPath, updatedAt: Date.now(), dirty: 1, deleted: 0 }));
            await db.files.delete(oldPath);
            // 1b. Migrate Chunks for this file
            await db.chunks.where('filePath').equals(oldPath).modify({ filePath: newPath });
            // 2. If it's a folder, rename all children recursively
            if (existing.type === 'folder') {
                const prefix = oldPath + '/';
                const children = await db.files.where('path').startsWith(prefix).toArray();
                for (const child of children) {
                    const childNewPath = child.path.replace(prefix, newPath + '/');
                    // Create new child record
                    await db.files.put(Object.assign(Object.assign({}, child), { path: childNewPath, updatedAt: Date.now(), dirty: 1, deleted: 0 }));
                    // Delete old child record
                    await db.files.delete(child.path);
                    // Migrate chunks for child
                    await db.chunks.where('filePath').equals(child.path).modify({ filePath: childNewPath });
                }
            }
        });
    }
    async deleteFile(virtualPath) {
        // Soft delete for sync
        await db.transaction('rw', db.files, db.chunks, async () => {
            const existing = await db.files.get(virtualPath);
            if (!existing)
                return;
            // 1. Delete the item itself
            await db.files.update(virtualPath, { deleted: 1, dirty: 1 });
            // 2. Delete semantic chunks
            await db.chunks.where('filePath').equals(virtualPath).delete();
            // 3. If it's a folder, soft-delete all children recursively
            if (existing.type === 'folder') {
                const prefix = virtualPath + '/';
                const children = await db.files.where('path').startsWith(prefix).toArray();
                for (const child of children) {
                    await db.files.update(child.path, { deleted: 1, dirty: 1 });
                    await db.chunks.where('filePath').equals(child.path).delete();
                }
            }
        });
    }
    async createFolder(virtualPath) {
        await this.ensureParent(virtualPath);
        await db.transaction('rw', db.files, async () => {
            const existing = await db.files.get(virtualPath);
            // Always update timestamp and dirty
            await db.files.put({
                path: virtualPath,
                content: '',
                updatedAt: Date.now(),
                type: 'folder',
                remoteId: existing === null || existing === void 0 ? void 0 : existing.remoteId,
                dirty: 1, // Crucial for sync
                deleted: 0
            });
        });
    }
    async ensureParent(path) {
        const parts = path.split('/');
        if (parts.length <= 1)
            return;
        // Try to find parent
        const parentPath = parts.slice(0, -1).join('/');
        // Optimize: check if exists first
        const parent = await db.files.get(parentPath);
        if (parent && !parent.deleted)
            return;
        // Check recursively (grandparent)
        await this.ensureParent(parentPath);
        // Create Parent Folder
        await db.files.put({
            path: parentPath,
            content: '',
            updatedAt: Date.now(),
            type: 'folder',
            dirty: 1,
            deleted: 0
        });
    }
    async resetSyncState() {
        console.log("Reseting sync state...");
        // 1. Clear Settings
        await db.settings.delete('drive_sync_token');
        await db.settings.delete('drive_root_id');
        await db.settings.delete('drive_root_id_writable');
        // 2. Clear Remote IDs & Mark Dirty
        await db.transaction('rw', db.files, async () => {
            const all = await db.files.toArray();
            for (const file of all) {
                await db.files.update(file.path, {
                    remoteId: undefined,
                    dirty: 1
                });
            }
        });
        console.log("Sync state reset. All files marked dirty.");
    }
    async factoryReset() {
        console.warn("PERFORMING FACTORY RESET...");
        await db.transaction('rw', db.files, db.settings, db.chunks, async () => {
            await db.files.clear();
            await db.settings.clear();
            await db.chunks.clear();
        });
        // Re-init default folders
        await this.ensureFolder('misc');
        await this.ensureFolder('history');
        console.log("Factory Reset Complete.");
    }
    async forceSync() {
        console.log("Force Sync Requested");
        if (this.syncEngine) {
            await this.syncEngine.sync();
        }
    }
    async ensureFolder(path) {
        await db.files.put({
            path,
            content: '',
            updatedAt: Date.now(),
            type: 'folder',
            dirty: 1,
            deleted: 0
        });
    }
    async getKnowledgeContext(query) {
        if (query) {
            console.log(`[RAG] Performing Semantic Search for: "${query}"`);
            try {
                const queryEmbedding = await generateEmbedding(query);
                const allChunks = await db.chunks.toArray();
                if (allChunks.length === 0) {
                    return "--- Knowledge Base ---\nNo indexed memory found. Falling back to basic context.\n" + await this.getLegacyKnowledgeContext();
                }
                // Rank chunks by similarity
                const ranked = allChunks.map(chunk => ({
                    chunk,
                    similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
                })).sort((a, b) => b.similarity - a.similarity);
                // FILENAME & TAG BOOSTING
                // If the user explicitly mentions a file (e.g. "Schema Theory") or a #tag, we MUST include it regardless of vector score.
                const queryLower = query.toLowerCase();
                const boostedChunks = [];
                const seenChunkIds = new Set();
                // Extract #tags from query
                const tagMatches = query.match(/#([\w\-]+)/g) || [];
                const queryTags = tagMatches.map(t => t.substring(1).toLowerCase());
                // 1. Find matched files (by Name OR Tag)
                // Use Dexie's index for tags if possible, or filter.
                const taggedFiles = [];
                if (queryTags.length > 0) {
                    // OR logic for tags
                    const uniqueTags = Array.from(new Set(queryTags));
                    for (const t of uniqueTags) {
                        // We need a way to search case-insensitive on tags array?
                        // Dexie *tags index is case-sensitive by default usually unless locale.
                        // For now, let's just iterate all files or use DB efficient search if possible.
                        // Since we are iterating allFiles below anyway for filename match, let's combine.
                    }
                }
                const allFiles = await db.files.toArray();
                const matchedFiles = allFiles.filter(f => {
                    var _a;
                    if (!f.path.startsWith('misc/'))
                        return false;
                    const filename = ((_a = f.path.split('/').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "";
                    // A. Tag Match
                    if (f.tags && f.tags.some(ft => queryTags.includes(ft.toLowerCase()))) {
                        return true;
                    }
                    // B. Filename Match
                    // Boosting Logic: If filename is found in query OR query is found in filename
                    // (ignoring very short queries)
                    if (queryLower.length > 3 && filename.includes(queryLower))
                        return true;
                    if (filename.length > 3 && queryLower.includes(filename))
                        return true;
                    return false;
                });
                if (matchedFiles.length > 0) {
                    console.log(`[RAG] Boosted Match Found: ${matchedFiles.map(f => f.path).join(', ')}`);
                    // Get all chunks for these files
                    for (const file of matchedFiles) {
                        const fileChunks = allChunks.filter(c => c.filePath === file.path);
                        for (const c of fileChunks) {
                            if (!seenChunkIds.has(c.content)) { // simple content dedup
                                boostedChunks.push({ chunk: c, similarity: 1.0 }); // Artificially high score
                                seenChunkIds.add(c.content);
                            }
                        }
                    }
                }
                // 2. Select Top Chunks (Boosted + Semantic)
                const semanticChunks = ranked.filter(r => r.similarity > 0.1 && !seenChunkIds.has(r.chunk.content));
                // Combine: Boosted first, then highest semantic
                // Total Limit: 8 chunks (approx 2k tokens)
                const combined = [...boostedChunks, ...semanticChunks].slice(0, 8);
                if (combined.length === 0) {
                    return "--- Knowledge Base ---\nNo relevant files found for this query.\n";
                }
                let ctx = "--- Relevant Memory (Semantic Search) ---\n";
                for (const item of combined) {
                    // Normalize filename for the AI: remove path and extension
                    // "misc/Research/Foo.pdf" -> "Foo"
                    const rawName = item.chunk.filePath.split('/').pop() || "";
                    const cleanName = rawName.replace(/\.(pdf|md|txt)(\.source\.md)?$/i, "");
                    // Add [Boosted] tag for debug clarity if it was a filename match
                    const tag = item.similarity === 1.0 ? " (Exact Match)" : "";
                    ctx += `\n### Source: ${cleanName}${tag}\n${item.chunk.content}\n---\n`;
                }
                return ctx;
            }
            catch (e) {
                console.error("[RAG] Search failed", e);
                return await this.getLegacyKnowledgeContext();
            }
        }
        else {
            return await this.getLegacyKnowledgeContext();
        }
    }
    async getLegacyKnowledgeContext() {
        // Get all files in misc/
        const files = await db.files.where('path').startsWith('misc/').toArray();
        const readableFiles = files.filter(f => !f.deleted && f.type === 'file');
        let ctx = "--- Knowledge Base (Misc Folder) ---\n";
        if (readableFiles.length === 0)
            return ctx + "No files found in Knowledge Base.\n";
        let totalLength = 0;
        // Reducing limit to 8k (~2k tokens) to be extremely safe with Groq Free Tier (12k TPM)
        const CHAR_LIMIT = 8000;
        // 1. Identify Sources to avoid duplication
        const sourcePaths = new Set(readableFiles.map(f => f.path));
        for (const file of readableFiles) {
            if (totalLength > CHAR_LIMIT) {
                ctx += `\n[System] Context limit reached. Some files omitted.\n`;
                break;
            }
            // Check if this is a raw PDF that has a Shadow Source
            const potentialSourcePath = file.path + '.source.md';
            if (file.path.endsWith('.pdf') && sourcePaths.has(potentialSourcePath)) {
                // Skip the raw PDF, we will read the .source.md instead
                continue;
            }
            // Include text-based files and PDFs
            const isText = file.path.endsWith('.md') || file.path.endsWith('.txt');
            const isPdf = file.path.endsWith('.pdf');
            if (isText || isPdf) {
                // Ensure content is string before string operations
                if (typeof file.content !== 'string') {
                    // Binary content (e.g. locally stored PDF).
                    // We cannot include binary in AI Context.
                    // However, we likely have a .source.md for this PDF, so we skipped it above (if source exists).
                    // If source does NOT exist (e.g. old file or failed extract), and we have binary, we simply say "Binary Content".
                    ctx += `\nFile: ${file.path} (Binary Content - Use Source)\n---\n`;
                    continue;
                }
                // Truncate individual massive files (e.g. books) to 10k chars (approx 2.5k tokens)
                const content = file.content.length > 10000
                    ? file.content.substring(0, 10000) + "\n...[Content Truncated]..."
                    : file.content;
                ctx += `\nFile: ${file.path}\nContent:\n${content}\n---\n`;
                totalLength += content.length;
            }
            else {
                ctx += `\nFile: ${file.path} (Non-text file, content unavailable)\n---\n`;
            }
        }
        return ctx;
    }
}
