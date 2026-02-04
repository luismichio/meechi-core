import { openDB } from 'idb';
import { db, FileRecord } from './db';
import Dexie from 'dexie';

const OLD_DB_NAME = 'michio-local-v1';
const OLD_STORE_NAME = 'files';

export async function migrateFromIdbToDexie() {
    // 1. Check if we already have data in Dexie
    const count = await db.files.count();
    
    if (count > 0) {
        // Already migrated
        return;
    }

    try {
        const oldDb = await openDB(OLD_DB_NAME, 1, {
            upgrade(db: any) {
                if (!db.objectStoreNames.contains(OLD_STORE_NAME)) {
                     // No old store
                }
            }
        });

        if (!oldDb.objectStoreNames.contains(OLD_STORE_NAME)) {
            return;
        }

        const allRecords = await oldDb.getAll(OLD_STORE_NAME);
        if (allRecords.length === 0) return;

        // 4. Transform & Insert
        const recordsToInsert: FileRecord[] = allRecords.map((rec: any) => ({
            path: rec.path,
            content: rec.content,
            updatedAt: rec.updatedAt,
            remoteId: rec.remoteId,
            type: 'file'
        }));


        // Use bulkPut to overwrite/merge
        await db.files.bulkPut(recordsToInsert);
        console.log(`[Meechi] Migrated ${recordsToInsert.length} files to new storage.`);

    } catch (e) {
        console.warn("Migration check failed (safe to ignore if new user)", e);
    }
}

const OLD_MICHIO_DB = 'michio-db';

export async function migrateFromMichioToMeechi() {
    // Check if new DB is empty
    const count = await db.files.count();
    if (count > 0) return; // Already initialized

    // Check if old DB exists via Dexie
    const oldExists = await Dexie.exists(OLD_MICHIO_DB);
    if (!oldExists) return;

    console.log("[Meechi] Migrating from michio-db...");

    try {
        const oldDb = new Dexie(OLD_MICHIO_DB);
        oldDb.version(1).stores({
            files: 'path, remoteId, type, updatedAt'
        });
        // We know up to version 6 existed, let's just try to open dynamic or match the latest structure
        // Since Dexie can open dynamically if we don't specify version, or we can use idb to just dump stores.
        // Using idb is safer for raw dump.
        
        const oldIdb = await openDB(OLD_MICHIO_DB);
        
        // Migrate Files
        if (oldIdb.objectStoreNames.contains('files')) {
            const files = await oldIdb.getAll('files');
            if (files.length > 0) {
                // Ensure tags/metadata structure if moving from v6
                // But since our current schema is v6, we can just put them in.
                // We might need to sanitize if schema changed, but it hasn't between michio->meechi rename.
                await db.files.bulkPut(files);
                console.log(`[Meechi] Transferred ${files.length} files from michio-db`);
            }
        }
        
        // Migrate Settings
        if (oldIdb.objectStoreNames.contains('settings')) {
            const settings = await oldIdb.getAll('settings');
            if (settings.length > 0) {
                 await db.settings.bulkPut(settings);
            }
        }
        
        // Migrate Journal
        if (oldIdb.objectStoreNames.contains('journal')) {
             const journal = await oldIdb.getAll('journal');
             if (journal.length > 0) {
                 await db.journal.bulkPut(journal);
             }
        }

        console.log("[Meechi] Migration complete.");

    } catch (e) {
        console.error("[Meechi] Migration from michio-db failed", e);
    }
}

const GUEST_DB_NAME = 'michio-guest-db';

export async function migrateJournal() {
    const count = await db.journal.count();
    if (count > 0) return;

    try {
        // We just try to open it. If it doesn't exist, openDB might create it empty or fail?
        // Actually IDB openDB will create if not exists. We should check if it has the store.
        const guestDb = await openDB(GUEST_DB_NAME, 1, {
            upgrade(db: any) {
                // If it doesn't exist, we don't create stores here, we just want to read.
                // But openDB with upgrade triggers creation.
                // If we don't provide upgrade, and version matches, it opens.
                // If we want to check existence safely:
            }
        });
        
        if (!guestDb.objectStoreNames.contains('journal')) {
            return;
        }

        const allEntries = await guestDb.getAll('journal');
        
        if (allEntries.length > 0) {
           await db.journal.bulkAdd(allEntries);
           console.log(`[Meechi] Migrated ${allEntries.length} journal entries.`);
        }

    } catch (e) {
        // Likely DB doesn't exist or other error
    }
}
