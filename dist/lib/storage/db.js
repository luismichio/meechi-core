import Dexie from 'dexie';
export class MeechiDB extends Dexie {
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
export const db = (typeof window !== 'undefined') ? new MeechiDB() : {};
