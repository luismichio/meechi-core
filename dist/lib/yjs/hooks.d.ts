import * as Y from 'yjs';
export declare function useYDoc(): {
    doc: Y.Doc;
    synced: boolean;
};
export declare function useYMap<T>(name: string): [Y.Map<T>, T];
export declare function useYArray<T>(name: string): [Y.Array<T>, T[]];
