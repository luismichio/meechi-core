import { doc } from './store';
// Access the Y.Map for edges
// Key: Edge ID (UUID)
// Value: GraphEdge object
export const getEdgesMap = () => {
    return doc.getMap('graph-edges');
};
