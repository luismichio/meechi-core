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
    path: string;
    content: string | Blob | ArrayBuffer;
    updatedAt: number;
    remoteId?: string;
    type: 'file' | 'folder' | 'source';
    dirty?: number;
    deleted?: number;
    tags?: string[];
    metadata?: FileMetadata;
}
export interface SettingRecord {
    key: string;
    value: any;
}
export interface FileChunk {
    id?: number;
    filePath: string;
    content: string;
    embedding: number[];
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
export declare class MeechiDB extends Dexie {
    files: Table<FileRecord>;
    settings: Table<SettingRecord>;
    chunks: Table<FileChunk>;
    journal: Table<JournalEntry>;
    edges: Table<GraphEdgeRecord>;
    constructor();
}
export declare const db: MeechiDB;
