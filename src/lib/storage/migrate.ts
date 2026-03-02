import { openDB } from 'idb';
import { db, FileRecord } from './db';
import Dexie from 'dexie';

const OLD_DB_NAME = 'michio-local-v1';
const OLD_STORE_NAME = 'files';

export async function migrateFromIdbToDexie() {
    // GUARD: Check for the sentinel key to distinguish between:
    // (a) New user: DB is empty, no sentinel -> run migration check.
    // (b) Wipe recovery: DB is empty, but sentinel EXISTS -> data loss event, do NOT re-run migration.
    const sentinel = await db.settings.get('db_initialized_at');
    if (sentinel) {
        // Sentinel exists: DB was previously initialized. If empty now, it was wiped.
        // Do not silently re-migrate. Return and let the app handle recovery mode.
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
            // No old data found. This is a clean new user.
            await db.settings.put({ key: 'db_initialized_at', value: Date.now() });
            return;
        }

        const allRecords = await oldDb.getAll(OLD_STORE_NAME);
        if (allRecords.length === 0) {
            await db.settings.put({ key: 'db_initialized_at', value: Date.now() });
            return;
        }

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
        // Set sentinel AFTER successful migration
        await db.settings.put({ key: 'db_initialized_at', value: Date.now() });
        console.log(`[Meechi] Migrated ${recordsToInsert.length} files to new storage.`);

    } catch (e) {
        console.warn("Migration check failed (safe to ignore if new user)", e);
        // Still set sentinel on error to prevent infinite retry loops
        await db.settings.put({ key: 'db_initialized_at', value: Date.now() });
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
        // FIX (H5): Use Dexie.exists() to check before opening.
        // openDB() creates the database if it doesn't exist, polluting the browser storage.
        const guestDbExists = await Dexie.exists(GUEST_DB_NAME);
        if (!guestDbExists) return;

        const guestDb = await openDB(GUEST_DB_NAME);
        
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
