import Dexie, { Table } from 'dexie';

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

export interface FileRecord {
    path: string; // Primary Key
    content: string | Blob | ArrayBuffer;
    updatedAt: number;
    remoteId?: string; // Google Drive ID (Indexed)
    type: 'file' | 'folder' | 'source';
    dirty?: number; // 1 if dirty, 0 or undefined if clean (Indexed for fast lookup)
    deleted?: number; // 1 if deleted
    tags?: string[]; // Array of tags (Indexed)
    metadata?: FileMetadata; // JSON object for extra properties
}

export interface SettingRecord {
    key: string;
    value: any;
}

export interface FileChunk {
    id?: number;
    filePath: string;
    content: string;
    embedding: number[]; // 512 dimensions (TensorFlow.js Universal Sentence Encoder)
}

export interface JournalEntry {
    id?: number;
    content: string;
    createdAt: Date;
}

export interface GraphEdgeRecord {
    id: string;
    source: string;
    target: string;
    relation: string;
    weight?: number;
    createdAt: number;
    metadata?: any;
}

export class MeechiDB extends Dexie {
    files!: Table<FileRecord>;
    settings!: Table<SettingRecord>;
    chunks!: Table<FileChunk>;
    journal!: Table<JournalEntry>;
    edges!: Table<GraphEdgeRecord>;

    constructor() {
        super(process.env.NEXT_PUBLIC_DB_NAME || 'meechi-db');
        this.version(1).stores({
            files: 'path, remoteId, type, updatedAt'
        });
        
        // Add settings table in version 2
        this.version(2).stores({
            settings: 'key'
        });

        // Add dirty/deleted index in version 3
        this.version(3).stores({
            files: 'path, remoteId, type, updatedAt, dirty, deleted'
        }).upgrade(tx => {
             return tx.table("files").toCollection().modify(file => {
                file.dirty = 0;
                file.deleted = 0;
            });
        });


        // Add semantic chunks table in version 4
        this.version(4).stores({
            chunks: '++id, filePath'
        });

    // Add journal table in version 5
        this.version(5).stores({
            journal: '++id, createdAt'
        });

        // Add tags and metadata table in version 6
        this.version(6).stores({
            files: 'path, remoteId, type, updatedAt, dirty, deleted, *tags'
        }).upgrade(tx => {
            return tx.table("files").toCollection().modify(file => {
                file.tags = [];
                file.metadata = {};
            });
        });

        // Add graph edges table in version 7
        this.version(7).stores({
            edges: 'id, source, target, relation'
        });
    }
}

// Prevent SSR crash by using a dummy object or conditionally instantiating
export const db = (typeof window !== 'undefined') ? new MeechiDB() : {} as MeechiDB;
