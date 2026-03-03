export interface FileMetadata {
    isSource?: boolean;
    originalContent?: string;
    summary?: string;
    comments?: Array<{
        id: string;
        text: string;
        range?: any;
        timestamp: number;
    }>;
    [key: string]: any;
}
export interface FileMeta {
    id: string;
    name: string;
    path: string;
    updatedAt: number;
    type: 'file' | 'folder' | 'source';
    remoteId?: string;
    deleted?: number;
    tags?: string[];
    metadata?: FileMetadata;
    content?: string | Blob | ArrayBuffer;
}
export interface StorageProvider {
    /**
     * Initialize the storage (e.g. open DB, auth check)
     */
    init(): Promise<void>;
    /**
     * Write content to a file. Overwrites if exists.
     */
    saveFile(virtualPath: string, content: string | Blob | ArrayBuffer, remoteId?: string, tags?: string[], metadata?: any): Promise<void>;
    updateMetadata(virtualPath: string, updates: Partial<FileMeta>): Promise<void>;
    getFilesByTag(tag: string): Promise<FileMeta[]>;
    /**
     * Read content of a file. Returns null if not found.
     */
    readFile(virtualPath: string): Promise<string | Blob | ArrayBuffer | null>;
    /**
     * List files in a virtual folder.
     */
    listFiles(virtualFolder: string): Promise<FileMeta[]>;
    /**
     * Append content to a file. Creates if not exists.
     */
    appendFile(virtualPath: string, content: string): Promise<void>;
    renameFile(oldPath: string, newPath: string): Promise<void>;
    deleteFile(virtualPath: string): Promise<void>;
    createFolder(virtualPath: string): Promise<void>;
    getFile(virtualPath: string): Promise<FileMeta | null>;
    resetSyncState(): Promise<void>;
    factoryReset(): Promise<void>;
    /**
     * Trigger a manual sync immediately.
     */
    forceSync?(): Promise<void>;
    /**
     * Collect relevant context for the AI from the local knowledge base.
     */
    getKnowledgeContext(query?: string): Promise<string>;
    /**
     * Re-index a file for semantic search.
     */
    indexFile(path: string, content: string): Promise<void>;
}
