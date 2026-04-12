'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from 'react';
import { doc, yProvider } from './store';
const YjsContext = createContext({
    doc,
    synced: false,
});
export function YjsProvider({ children }) {
    const [synced, setSynced] = useState(false);
    useEffect(() => {
        if (!yProvider) {
            // Server-side or non-browser environment
            setSynced(true);
            return;
        }
        const onSynced = () => setSynced(true);
        // Check if already synced
        if (yProvider.synced) {
            setSynced(true);
        }
        else {
            yProvider.on('synced', onSynced);
        }
        return () => {
            if (yProvider) {
                yProvider.off('synced', onSynced);
            }
        };
    }, []);
    return (_jsx(YjsContext.Provider, { value: { doc, synced }, children: children }));
}
export const useYjs = () => useContext(YjsContext);
