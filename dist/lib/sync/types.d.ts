export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    parents?: string[];
    modifiedTime: string;
    appProperties?: {
        meechi_meta?: string;
    };
    capabilities?: {
        canAddChildren?: boolean;
    };
}
