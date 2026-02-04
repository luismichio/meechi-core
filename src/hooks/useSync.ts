
import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncEngine } from '../lib/sync/engine';
import { GoogleDriveClient } from '../lib/sync/google-drive';
import { StorageProvider } from '../lib/storage/types';

export function useSync(storage: StorageProvider, session: any, updateSession: () => Promise<any>, currentDate: string) {
    const [syncLogs, setSyncLogs] = useState<string[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncMessage, setSyncMessage] = useState<string>('');
    const engineRef = useRef<SyncEngine | null>(null);

    const addLog = useCallback((msg: string) => {
        setSyncLogs(prev => {
            const next = [...prev, msg];
            return next.slice(-50); // Keep last 50
        });
        setSyncMessage(msg);
    }, []);

    // Initialize Engine when session is available
    useEffect(() => {
        if (session?.accessToken) {
            const client = new GoogleDriveClient(session.accessToken);
            engineRef.current = new SyncEngine(client, storage);
            // Register with storage for manual triggering
            if ('setSyncEngine' in storage) {
                (storage as any).setSyncEngine(engineRef.current);
            }
        } else {
            engineRef.current = null;
            if ('setSyncEngine' in storage) {
                (storage as any).setSyncEngine(null);
            }
        }
    }, [session?.accessToken, storage]);

    const syncNow = useCallback(async () => {
         if (!engineRef.current) return;
         if (isSyncing) return;
         
         setIsSyncing(true);
         setSyncError(null);
         addLog('Starting Sync...');
         
         try {
             await engineRef.current.sync((msg) => addLog(msg));
             setSyncError(null); // Clear error on success
         } catch (e: any) {
             console.error("Sync Error", e);
             const errMsg = e.message || "Sync Failed";
             setSyncError(errMsg);
             addLog(`Error: ${errMsg}`);

             // Handle Token Expiry
             if (errMsg.includes("Unauthorized") || errMsg.includes("Token expired")) {
                 addLog("Refreshing Session...");
                 await updateSession(); // Trigger NextAuth rotation
             }
         } finally {
             setIsSyncing(false);
             addLog("Finished.");
         }
    }, [isSyncing, session, addLog, updateSession]);

    // Auto-sync on load and periodically
    useEffect(() => {
        if (!session?.accessToken) return;

        // 1. Initial Sync (once per session/mount)
        // We use a timeout to let the app settle
        const timer = setTimeout(() => {
             // Only sync if not already syncing (though syncNow checks this too)
             if (!engineRef.current) return;
             syncNow(); 
        }, 1000);

        // 2. Periodic Sync
        const interval = setInterval(() => {
             syncNow();
        }, 120000);

        return () => {
             clearTimeout(timer);
             clearInterval(interval);
        };
        // CRITICAL DEBT: syncNow in dep array causes infinite loop if syncNow updates state that triggers re-render
        // We really only want this to run when SESSION starts. 
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.accessToken]);

    return { isSyncing, syncNow, syncError, syncMessage, syncLogs };
}
