import * as Y from 'yjs';
export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    relation: string;
    weight?: number;
    createdAt: number;
    metadata?: any;
}
export declare const getEdgesMap: () => Y.Map<GraphEdge>;
