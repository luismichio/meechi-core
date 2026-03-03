import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
// Create the global Yjs document
export const doc = new Y.Doc();
// Initialize the persistence layer (Browser only)
let persistence = null;
if (typeof window !== 'undefined') {
    // 'meechi-database' matches our app name logic, but distinct from Dexie which is 'meechi-db' usually
    persistence = new IndexeddbPersistence('meechi-yjs-store', doc);
    persistence.on('synced', () => {
        console.log('[Yjs] Content loaded from IndexedDB');
    });
    // Initialize Graph Sync (Yjs -> Dexie)
    // We do this here to ensure it runs as a side-effect of the app starting
    import('./syncGraph').then(({ initGraphSync }) => {
        initGraphSync();
    });
}
export const yProvider = persistence;
