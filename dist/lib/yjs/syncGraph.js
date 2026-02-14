import { db } from '../storage/db';
import { getEdgesMap } from './graph';
// Sync Yjs Graph Edges -> Dexie 'edges' table
// This allows us to use Dexie for fast GraphRAG querying (e.g. "Find all neighbors of Ada")
// while keeping Yjs as the source of truth for sync.
export function initGraphSync() {
    console.log('[GraphSync] Initializing...');
    const edgesMap = getEdgesMap();
    // 1. Initial Sync: Ensure specific indexes match if needed, or just rely on eventual consistency.
    // For now, we trust the observe events or a full re-sync if strictly needed.
    // Ideally, Yjs persistence loads the doc, and then we might want to dump to Dexie if Dexie is empty.
    // But since Yjs persistence goes to IndexedDB anyway, this is "Derived Data".
    // We observe changes.
    edgesMap.observe((event) => {
        // Snapshot changed keys and values synchronously to avoid accessing
        // event.changes or edgesMap after the handler returns (Yjs restriction).
        const changedKeys = Array.from(event.keysChanged);
        const snapshots = changedKeys.map(key => {
            const change = event.changes.keys.get(key);
            const action = change === null || change === void 0 ? void 0 : change.action;
            const edge = edgesMap.get(key);
            return { key, action, edge };
        });
        db.transaction('rw', db.edges, async () => {
            for (const { key, action, edge } of snapshots) {
                if (action === 'delete') {
                    await db.edges.delete(key);
                }
                else {
                    if (edge) {
                        await db.edges.put(edge);
                    }
                }
            }
        }).catch(err => {
            console.error('[GraphSync] Error syncing to Dexie:', err);
        });
    });
    console.log('[GraphSync] Listening for changes.');
}
