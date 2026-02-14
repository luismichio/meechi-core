export declare class GoogleDriveClient {
    private accessToken;
    constructor(accessToken: string);
    private request;
    /**
     * Search for files.
     * query: e.g. "name = 'foo.txt' and trashed = false"
     */
    listFiles(query: string): Promise<any>;
    /**
     * Get Sync Token for tracking changes
     */
    getStartPageToken(): Promise<any>;
    /**
     * List changes since token
     */
    listChanges(pageToken: string): Promise<any>;
    /**
     * Download file content
     */
    downloadFile(fileId: string): Promise<string>;
    /**
     * Download file content as Binary (ArrayBuffer)
     */
    downloadBinary(fileId: string): Promise<ArrayBuffer>;
    /**
     * Get file metadata
     */
    getFileMetadata(fileId: string): Promise<any>;
    /**
     * Update file content
     */
    updateMetadata(fileId: string, metadata: {
        name?: string;
        addParents?: string[];
        removeParents?: string[];
        appProperties?: Record<string, string>;
    }): Promise<any>;
    updateFile(fileId: string, content: string | Blob | ArrayBuffer): Promise<any>;
    /**
     * Create file
     */
    createFile(name: string, folderId: string | null, content: string | Blob | ArrayBuffer, appProperties?: Record<string, string>): Promise<any>;
    /**
     * Create Folder
     */
    createFolder(name: string, parentId?: string): Promise<any>;
    /**
     * Delete file (Trash)
     */
    deleteFile(fileId: string): Promise<void>;
}
