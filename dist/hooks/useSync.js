import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncEngine } from '../lib/sync/engine';
import { GoogleDriveClient } from '../lib/sync/google-drive';
export function useSync(storage, session, updateSession, currentDate) {
    const [syncLogs, setSyncLogs] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState(null);
    const [syncMessage, setSyncMessage] = useState('');
    const engineRef = useRef(null);
    const addLog = useCallback((msg) => {
        setSyncLogs(prev => {
            const next = [...prev, msg];
            return next.slice(-50); // Keep last 50
        });
        setSyncMessage(msg);
    }, []);
    // Initialize Engine when session is available
    useEffect(() => {
        if (session === null || session === void 0 ? void 0 : session.accessToken) {
            const client = new GoogleDriveClient(session.accessToken);
            engineRef.current = new SyncEngine(client, storage);
            // Register with storage for manual triggering
            if ('setSyncEngine' in storage) {
                storage.setSyncEngine(engineRef.current);
            }
        }
        else {
            engineRef.current = null;
            if ('setSyncEngine' in storage) {
                storage.setSyncEngine(null);
            }
        }
    }, [session === null || session === void 0 ? void 0 : session.accessToken, storage]);
    const syncNow = useCallback(async () => {
        if (!engineRef.current)
            return;
        if (isSyncing)
            return;
        setIsSyncing(true);
        setSyncError(null);
        addLog('Starting Sync...');
        try {
            await engineRef.current.sync((msg) => addLog(msg));
            setSyncError(null); // Clear error on success
        }
        catch (e) {
            console.error("Sync Error", e);
            const errMsg = e.message || "Sync Failed";
            setSyncError(errMsg);
            addLog(`Error: ${errMsg}`);
            // Handle Token Expiry
            if (errMsg.includes("Unauthorized") || errMsg.includes("Token expired")) {
                addLog("Refreshing Session...");
                await updateSession(); // Trigger NextAuth rotation
            }
        }
        finally {
            setIsSyncing(false);
            addLog("Finished.");
        }
    }, [isSyncing, session, addLog, updateSession]);
    // Auto-sync on load and periodically
    useEffect(() => {
        if (!(session === null || session === void 0 ? void 0 : session.accessToken))
            return;
        // 1. Initial Sync (once per session/mount)
        // We use a timeout to let the app settle
        const timer = setTimeout(() => {
            // Only sync if not already syncing (though syncNow checks this too)
            if (!engineRef.current)
                return;
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
    }, [session === null || session === void 0 ? void 0 : session.accessToken]);
    return { isSyncing, syncNow, syncError, syncMessage, syncLogs };
}
