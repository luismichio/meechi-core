import React from 'react';
import * as Y from 'yjs';
interface YjsContextType {
    doc: Y.Doc;
    synced: boolean;
}
export declare function YjsProvider({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare const useYjs: () => YjsContextType;
export {};
