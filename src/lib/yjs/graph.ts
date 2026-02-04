import * as Y from 'yjs';
import { doc } from './store';

export interface GraphEdge {
    id: string;
    source: string; // Source Node ID (e.g. file path 'history/2025-01-01.md' or entity 'Ada')
    target: string; // Target Node ID
    relation: string; // Predicate (e.g. 'mentions', 'located_in', 'related_to')
    weight?: number; // 0.0 to 1.0
    createdAt: number;
    metadata?: any;
}

// Access the Y.Map for edges
// Key: Edge ID (UUID)
// Value: GraphEdge object
export const getEdgesMap = (): Y.Map<GraphEdge> => {
    return doc.getMap<GraphEdge>('graph-edges');
};
