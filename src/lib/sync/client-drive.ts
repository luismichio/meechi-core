// Client-Side Google Drive Service for Desktop App
// This replaces the server-side logic in /api/sync/* when running in static mode.

const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export class ClientDriveService {
    private accessToken: string | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            this.accessToken = localStorage.getItem('google_access_token');
        }
    }

    setToken(token: string) {
        this.accessToken = token;
        localStorage.setItem('google_access_token', token);
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        if (!this.accessToken) {
            throw new Error("No Google Access Token found. Please connect Account.");
        }

        const url = `${GOOGLE_DRIVE_API_BASE}/${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const res = await fetch(url, { ...options, headers });
        
        if (res.status === 401) {
            // Token expired
            localStorage.removeItem('google_access_token');
            this.accessToken = null;
            throw new Error("Token Expired. Please reconnect.");
        }

        if (!res.ok) {
            throw new Error(`Google Drive API Error: ${res.statusText}`);
        }

        return res.json();
    }

    async listFiles() {
        try {
            // Query for Docs and PDFs, not trashed
            const q = "mimeType != 'application/vnd.google-apps.folder' and trashed = false";
            const res = await this.request(`files?q=${encodeURIComponent(q)}&fields=files(id, name, mimeType, modifiedTime)`);
            return res.files || [];
        } catch (e: any) {
            console.error("Client Drive List Error:", e);
            throw e;
        }
    }

    async getFileContent(fileId: string): Promise<string> {
        // For Google Docs, we must export them. For PDFs/Text, get media.
        // Simplified: Export everything as text/plain if possible
        try {
            // 1. Check Metadata
            const metadata = await this.request(`files/${fileId}?fields=mimeType`);
            
            let url =  `${GOOGLE_DRIVE_API_BASE}/files/${fileId}?alt=media`;
            
            if (metadata.mimeType === 'application/vnd.google-apps.document') {
                url = `${GOOGLE_DRIVE_API_BASE}/files/${fileId}/export?mimeType=text/plain`;
            }

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });

            if (!res.ok) throw new Error("Failed to download file content");
            
            return await res.text();
        } catch (e) {
            console.error("Download Error:", e);
            throw e;
        }
    }
}

export const clientDrive = new ClientDriveService();
