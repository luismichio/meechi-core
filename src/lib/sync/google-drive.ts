export class GoogleDriveClient {
    private accessToken: string;

    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const url = `https://www.googleapis.com/drive/v3/${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };

        console.log(`[DriveAPI] ${options.method || 'GET'} ${url}`);

        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 30000); // 30s Timeout

        try {
            const res = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal
            });
            clearTimeout(id);
            
            if (res.status === 401) {
                console.error(`[DriveAPI] 401 Unauthorized for ${url}`);
                throw new Error("Unauthorized: Token expired or invalid");
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error(`[DriveAPI] Error ${res.status} for ${url}:`, err);
                throw new Error(`Drive API Error: ${err.error?.message || res.statusText}`);
            }

            return res;
        } catch (error: any) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                console.error(`[DriveAPI] Timeout for ${url}`);
                throw new Error("Drive API Timeout (30s)");
            }
            console.error(`[DriveAPI] Fetch Error for ${url}:`, error);
            throw error;
        }
    }




    /**
     * Search for files.
     * query: e.g. "name = 'foo.txt' and trashed = false"
     */
    async listFiles(query: string) {
        const params = new URLSearchParams({
            q: query,
            fields: 'files(id, name, mimeType, parents, modifiedTime, version, trashed, capabilities, appProperties)',
            pageSize: '1000', 
        });
        
        const res = await this.request(`files?${params.toString()}`);
        return (await res.json()).files;
    }

    /**
     * Get Sync Token for tracking changes
     */
    async getStartPageToken() {
        const res = await this.request('changes/startPageToken');
        return (await res.json()).startPageToken;
    }

    /**
     * List changes since token
     */
    async listChanges(pageToken: string) {
        const params = new URLSearchParams({
            pageToken,
            fields: 'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, parents, modifiedTime, version, trashed, appProperties))',
        });
        const res = await this.request(`changes?${params.toString()}`);
        return await res.json();
    }

    /**
     * Download file content
     */
    async downloadFile(fileId: string): Promise<string> {
        const res = await this.request(`files/${fileId}?alt=media`);
        return await res.text();
    }

    /**
     * Download file content as Binary (ArrayBuffer)
     */
    async downloadBinary(fileId: string): Promise<ArrayBuffer> {
        const res = await this.request(`files/${fileId}?alt=media`);
        return await res.arrayBuffer();
    }

    /**
     * Get file metadata
     */
    async getFileMetadata(fileId: string) {
        const res = await this.request(`files/${fileId}?fields=id,name,parents,mimeType,modifiedTime,trashed,appProperties`);
        return await res.json();
    }

    /**
     * Update file content
     */


    async updateMetadata(fileId: string, metadata: { name?: string, addParents?: string[], removeParents?: string[], appProperties?: Record<string, string> }) {
        const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
        if (metadata.addParents) url.searchParams.append('addParents', metadata.addParents.join(','));
        if (metadata.removeParents) url.searchParams.append('removeParents', metadata.removeParents.join(',')); // Important: remove old parents for move

        const body: any = {};
        if (metadata.name) body.name = metadata.name;
        if (metadata.appProperties) body.appProperties = metadata.appProperties;

        const res = await this.request(url.toString().replace('https://www.googleapis.com/drive/v3/', ''), { // request prepends base
            method: 'PATCH',
            body: JSON.stringify(body)
        });
        
        return await res.json();
    }

    async updateFile(fileId: string, content: string | Blob | ArrayBuffer) {
        // Simple upload (media only) is easiest for updates, but multipart is robust.
        // For updates, we often just want to update content.
        // Google Drive API supports PATCHing content.
        // Ref: https://developers.google.com/drive/api/guides/manage-uploads#simple
        
        const blob = content instanceof Blob ? content : new Blob([content]);
        
        const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': blob.type || 'application/octet-stream'
            },
            body: blob
        });

        if (!res.ok) throw new Error("Update content failed");
        return await res.json();
    }

    /**
     * Create file
     */
    async createFile(name: string, folderId: string | null, content: string | Blob | ArrayBuffer, appProperties?: Record<string, string>) {
        let mimeType = 'application/octet-stream';
        if (name.endsWith('.md')) mimeType = 'text/markdown';
        else if (name.endsWith('.txt')) mimeType = 'text/plain';
        else if (name.endsWith('.pdf')) mimeType = 'application/pdf';

        const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });

        const metadata: any = {
            name,
            parents: folderId ? [folderId] : [],
        };
        if (appProperties) metadata.appProperties = appProperties;

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
            },
            body: form
        });

        if (!res.ok) throw new Error("Create failed");
        return await res.json();
    }
    
    /**
     * Create Folder
     */
    async createFolder(name: string, parentId?: string) {
        const metadata = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : []
        };
        
        const res = await this.request('files', {
            method: 'POST',
            body: JSON.stringify(metadata)
        });
        return await res.json();
    }

    /**
     * Delete file (Trash)
     */
    async deleteFile(fileId: string) {
        const res = await this.request(`files/${fileId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error("Delete failed");
    }
}
