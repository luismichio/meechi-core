import { db } from '../storage/db';
import { getEdgesMap, GraphEdge } from './graph';
import * as Y from 'yjs';

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
    edgesMap.observe((event: Y.YMapEvent<GraphEdge>) => {
        // event.keysChanged is a Set of keys (Edge IDs) that changed
        const changes = Array.from(event.keysChanged);
        
        db.transaction('rw', db.edges, async () => {
            for (const key of changes) {
                const type = event.changes.keys.get(key);
                // type.action is 'add', 'update', or 'delete'
                
                if (type?.action === 'delete') {
                    // Deleted from Yjs -> Delete from Dexie
                    await db.edges.delete(key);
                } else {
                    // Added or Updated -> Put to Dexie
                    const edge = edgesMap.get(key);
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
