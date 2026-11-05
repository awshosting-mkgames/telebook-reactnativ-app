import * as SQLite from 'expo-sqlite';
import { serializeDbWrite } from './sqliteWriteQueue';

// Call history ka local store (offline dikhane + filters offline chalane ke liye).
// Server hi sach hai: fetch ke baad local reconcile hota hai (server se hate/delete hue calls yahan se bhi jaate hain).

const DB_NAME = 'telebook.db';
const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS call_history (
    call_id    TEXT PRIMARY KEY NOT NULL,
    data       TEXT NOT NULL,
    started_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_call_history_started ON call_history (started_at DESC);
CREATE TABLE IF NOT EXISTS call_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);
`;

let dbPromise = null;
const getDb = () => {
    if (!dbPromise) {
        dbPromise = (async () => {
            const db = await SQLite.openDatabaseAsync(DB_NAME);
            await db.execAsync(SCHEMA);
            return db;
        })();
    }
    return dbPromise;
};
const parse = (j) => { try { return JSON.parse(j); } catch (e) { return null; } };
const t = (d) => (d ? new Date(d).getTime() : 0);

/**
 * Server se aaya page local me daalo. `reconcile`: sirf page-1 (filter 'all') par — us page ki purani se naye tak ki
 * range me jo local calls server ne nahi bheje (delete / history clear) unhe hata do.
 */
export const upsertCalls = (calls = [], { reconcile = false, hasMore = false } = {}) => serializeDbWrite(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
        for (const c of calls) {
            if (!c?._id) continue;
            await db.runAsync(
                `INSERT INTO call_history (call_id, data, started_at) VALUES (?, ?, ?)
                 ON CONFLICT(call_id) DO UPDATE SET data = excluded.data, started_at = excluded.started_at`,
                [String(c._id), JSON.stringify(c), t(c.startedAt)]
            );
        }
        if (reconcile) {
            const keep = new Set(calls.map((c) => String(c._id)));
            // Agar aur pages baaki hain to sirf is page ki range me; nahi to poori history server ke barabar
            const floor = hasMore && calls.length ? Math.min(...calls.map((c) => t(c.startedAt))) : 0;
            const rows = await db.getAllAsync('SELECT call_id FROM call_history WHERE started_at >= ?', [floor]);
            for (const r of rows) if (!keep.has(r.call_id)) await db.runAsync('DELETE FROM call_history WHERE call_id = ?', [r.call_id]);
            await db.runAsync(`INSERT INTO call_meta (key, value) VALUES ('syncedAt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [String(Date.now())]);
        }
    });
});

const MATCH = {
    all: () => true,
    missed: (c) => !!c.missed,
    incoming: (c) => c.direction === 'incoming',
    outgoing: (c) => c.direction === 'outgoing',
    audio: (c) => c.type === 'audio',
    video: (c) => c.type === 'video',
};

/** Local history, wahi filters jo server par hain (offline me chips kaam karein) */
export const loadCalls = async (filter = 'all', limit = 200) => {
    const db = await getDb();
    const rows = await db.getAllAsync('SELECT data FROM call_history ORDER BY started_at DESC LIMIT ?', [limit * 3]);
    const pred = MATCH[filter] || MATCH.all;
    return rows.map((r) => parse(r.data)).filter((c) => c && pred(c)).slice(0, limit);
};

export const deleteCallsLocal = (ids = null) => serializeDbWrite(async () => {
    const db = await getDb();
    if (!ids) { await db.runAsync('DELETE FROM call_history'); return; }
    await db.withTransactionAsync(async () => {
        for (const id of ids) await db.runAsync('DELETE FROM call_history WHERE call_id = ?', [String(id)]);
    });
});

export const clearCallsDb = () => serializeDbWrite(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
        await db.execAsync('DELETE FROM call_history');
        await db.execAsync('DELETE FROM call_meta');
    });
});
