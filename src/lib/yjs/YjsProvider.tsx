'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, yProvider } from './store';
import * as Y from 'yjs';

interface YjsContextType {
  doc: Y.Doc;
  synced: boolean;
}

const YjsContext = createContext<YjsContextType>({
  doc,
  synced: false,
});

export function YjsProvider({ children }: { children: React.ReactNode }) {
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
    } else {
      yProvider.on('synced', onSynced);
    }

    return () => {
      if (yProvider) {
        yProvider.off('synced', onSynced);
      }
    };
  }, []);

  return (
    <YjsContext.Provider value={{ doc, synced }}>
      {children}
    </YjsContext.Provider>
  );
}

export const useYjs = () => useContext(YjsContext);
