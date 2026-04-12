import { StorageProvider } from '../lib/storage/types';
export declare function useSync(storage: StorageProvider, session: any, updateSession: () => Promise<any>, currentDate: string): {
    isSyncing: boolean;
    syncNow: () => Promise<void>;
    syncError: string | null;
    syncMessage: string;
    syncLogs: string[];
};
