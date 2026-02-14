import { StorageProvider, FileMeta } from './types';
export declare class LocalStorageProvider implements StorageProvider {
    private syncEngine;
    setSyncEngine(engine: any): void;
    init(): Promise<void>;
    indexFile(path: string, content: string): Promise<void>;
    listFiles(prefix: string): Promise<FileMeta[]>;
    getFile(virtualPath: string): Promise<FileMeta | null>;
    readFile(virtualPath: string): Promise<string | Blob | ArrayBuffer | null>;
    saveFile(virtualPath: string, content: string | Blob | ArrayBuffer, remoteId?: string, tags?: string[], metadata?: any): Promise<void>;
    updateMetadata(virtualPath: string, updates: Partial<FileMeta>): Promise<void>;
    getFilesByTag(tag: string): Promise<FileMeta[]>;
    appendFile(virtualPath: string, content: string, skipIndex?: boolean): Promise<void>;
    updateFile(virtualPath: string, newContent: string): Promise<void>;
    getRecentLogs(limitHours: number): Promise<string>;
    private formatDate;
    private filterLogByTime;
    renameFile(oldPath: string, newPath: string): Promise<void>;
    deleteFile(virtualPath: string): Promise<void>;
    createFolder(virtualPath: string): Promise<void>;
    private ensureParent;
    resetSyncState(): Promise<void>;
    factoryReset(): Promise<void>;
    forceSync(): Promise<void>;
    private ensureFolder;
    getKnowledgeContext(query?: string): Promise<string>;
    private getLegacyKnowledgeContext;
}
