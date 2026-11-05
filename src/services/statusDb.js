import * as SQLite from 'expo-sqlite';
import { serializeDbWrite } from './sqliteWriteQueue';

// Status ka local store (offline cache + durable queue). chatsDb/messagesDb jaisa pattern:
// "telebook.db", JSON blob per row, sab writes serializeDbWrite se.
//
//  status_owners  : jis contact ke status hain uska user object + muted flag (feed ke group)
//  status_items   : har status (apne + dusron ke), expires_at se purane padhte waqt chhupte hain
//  status_seen    : maine kaun se status dekhe (25h baad apne aap hat jaate hain)
//  status_pending : server tak na pahunche kaam — view / reaction. Network aate hi bhejte hain (app kill ho to bhi bacha rehta hai)
//  status_meta    : config, privacy, last sync time

const DB_NAME = 'telebook.db';
const SEEN_TTL = 25 * 60 * 60 * 1000;
const MAX_TRIES = 8;

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS status_owners (
    owner_id TEXT PRIMARY KEY NOT NULL,
    data     TEXT NOT NULL,
    muted    INTEGER NOT NULL DEFAULT 0,
    last_at  TEXT
);
CREATE TABLE IF NOT EXISTS status_items (
    status_id  TEXT PRIMARY KEY NOT NULL,
    owner_id   TEXT NOT NULL,
    is_mine    INTEGER NOT NULL DEFAULT 0,
    data       TEXT NOT NULL,
    created_at TEXT,
    expires_at INTEGER,
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_status_items_owner ON status_items (is_mine, owner_id, created_at);
CREATE TABLE IF NOT EXISTS status_seen (
    status_id TEXT PRIMARY KEY NOT NULL,
    seen_at   INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS status_pending (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kind       TEXT NOT NULL,
    status_id  TEXT NOT NULL,
    payload    TEXT,
    created_at INTEGER NOT NULL,
    tries      INTEGER NOT NULL DEFAULT 0,
    UNIQUE (kind, status_id)
);
CREATE TABLE IF NOT EXISTS status_meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT
);
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
const ts = (d) => (d ? new Date(d).getTime() : null);

/**
 * Server ka sach local me utaro: others = [{user, muted, statuses[]}], mine = {user, statuses[]} ya null.
 * Server ne jo status nahi bheje (delete / expire / privacy badli / block) woh yahan se bhi hat jaate hain.
 * Sirf SUCCESSFUL fetch ke baad call karo — fail par purana cache hi rehna chahiye.
 */
export const replaceStatusFeed = ({ others = [], mine = null, myUserId = null }) => serializeDbWrite(async () => {
    const db = await getDb();
    const now = Date.now();
    await db.withTransactionAsync(async () => {
        const keepItems = new Set();
        const keepOwners = new Set();
        const putItem = async (st, ownerId, isMine) => {
            if (!st?._id) return;
            keepItems.add(String(st._id));
            await db.runAsync(
                `INSERT INTO status_items (status_id, owner_id, is_mine, data, created_at, expires_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(status_id) DO UPDATE SET owner_id = excluded.owner_id, is_mine = excluded.is_mine, data = excluded.data,
                     created_at = excluded.created_at, expires_at = excluded.expires_at, updated_at = excluded.updated_at`,
                [String(st._id), String(ownerId), isMine ? 1 : 0, JSON.stringify(st), st.createdAt ?? null, ts(st.expiresAt), now]
            );
        };
        for (const g of others) {
            const oid = String(g?.user?._id ?? '');
            if (!oid) continue;
            keepOwners.add(oid);
            const list = g.statuses || [];
            await db.runAsync(
                `INSERT INTO status_owners (owner_id, data, muted, last_at) VALUES (?, ?, ?, ?)
                 ON CONFLICT(owner_id) DO UPDATE SET data = excluded.data, muted = excluded.muted, last_at = excluded.last_at`,
                [oid, JSON.stringify(g.user), g.muted ? 1 : 0, list.length ? list[list.length - 1].createdAt ?? null : null]
            );
            for (const st of list) await putItem(st, oid, false);
        }
        if (mine) for (const st of mine.statuses || []) await putItem(st, String(myUserId ?? mine.user?._id ?? ''), true);

        // Server me nahi rahe → local se bhi hatao
        const rows = await db.getAllAsync('SELECT status_id FROM status_items');
        for (const r of rows) if (!keepItems.has(r.status_id)) await db.runAsync('DELETE FROM status_items WHERE status_id = ?', [r.status_id]);
        const owners = await db.getAllAsync('SELECT owner_id FROM status_owners');
        for (const r of owners) if (!keepOwners.has(r.owner_id)) await db.runAsync('DELETE FROM status_owners WHERE owner_id = ?', [r.owner_id]);
        await db.runAsync(`INSERT INTO status_meta (key, value) VALUES ('syncedAt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [String(now)]);
    });
});

/** Local feed (expire hue status chhupa kar). { others, mine, syncedAt } */
export const loadStatusFeed = async (myUserId) => {
    const db = await getDb();
    const now = Date.now();
    const items = await db.getAllAsync(
        'SELECT owner_id, is_mine, data FROM status_items WHERE expires_at IS NULL OR expires_at > ? ORDER BY created_at ASC', [now]
    );
    const owners = await db.getAllAsync('SELECT owner_id, data, muted FROM status_owners');
    const byOwner = new Map(owners.map((o) => [o.owner_id, { user: parse(o.data), muted: o.muted === 1, statuses: [] }]));
    const mine = [];
    for (const r of items) {
        const st = parse(r.data);
        if (!st) continue;
        if (r.is_mine === 1) mine.push(st);
        else byOwner.get(r.owner_id)?.statuses.push(st);
    }
    const others = [...byOwner.values()].filter((g) => g.user && g.statuses.length)
        .sort((a, b) => new Date(b.statuses[b.statuses.length - 1].createdAt) - new Date(a.statuses[a.statuses.length - 1].createdAt));
    const meta = await db.getFirstAsync(`SELECT value FROM status_meta WHERE key = 'syncedAt'`);
    return { others, mine: mine.length ? { user: null, statuses: mine } : null, syncedAt: meta?.value ? Number(meta.value) : null, myUserId };
};

export const setOwnerMutedLocal = (ownerId, muted) => serializeDbWrite(async () => {
    const db = await getDb();
    await db.runAsync('UPDATE status_owners SET muted = ? WHERE owner_id = ?', [muted ? 1 : 0, String(ownerId)]);
});

export const deleteStatusLocal = (statusId) => serializeDbWrite(async () => {
    const db = await getDb();
    await db.runAsync('DELETE FROM status_items WHERE status_id = ?', [String(statusId)]);
});

/** Ek status ke JSON me patch (jaise myReaction / seen) */
export const patchStatusLocal = (statusId, patch) => serializeDbWrite(async () => {
    const db = await getDb();
    const row = await db.getFirstAsync('SELECT data FROM status_items WHERE status_id = ?', [String(statusId)]);
    const cur = row ? parse(row.data) : null;
    if (!cur) return;
    await db.runAsync('UPDATE status_items SET data = ?, updated_at = ? WHERE status_id = ?', [JSON.stringify({ ...cur, ...patch }), Date.now(), String(statusId)]);
});

export const purgeExpiredStatus = () => serializeDbWrite(async () => {
    const db = await getDb();
    await db.runAsync('DELETE FROM status_items WHERE expires_at IS NOT NULL AND expires_at <= ?', [Date.now()]);
    await db.runAsync('DELETE FROM status_seen WHERE seen_at < ?', [Date.now() - SEEN_TTL]);
});

// ── seen ─────────────────────────────────────────────────────────────────────
export const getSeenIds = async () => {
    const db = await getDb();
    const rows = await db.getAllAsync('SELECT status_id, seen_at FROM status_seen WHERE seen_at > ?', [Date.now() - SEEN_TTL]);
    return Object.fromEntries(rows.map((r) => [r.status_id, r.seen_at]));
};
export const markSeenDb = (statusId) => serializeDbWrite(async () => {
    const db = await getDb();
    await db.runAsync('INSERT OR IGNORE INTO status_seen (status_id, seen_at) VALUES (?, ?)', [String(statusId), Date.now()]);
});

// ── pending queue ────────────────────────────────────────────────────────────
/** kind: 'view' | 'reaction'. Same (kind,status) dobara aaye to payload replace (reaction me last-wins) */
export const enqueuePending = (kind, statusId, payload = null) => serializeDbWrite(async () => {
    const db = await getDb();
    await db.runAsync(
        `INSERT INTO status_pending (kind, status_id, payload, created_at, tries) VALUES (?, ?, ?, ?, 0)
         ON CONFLICT(kind, status_id) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at, tries = 0`,
        [kind, String(statusId), payload == null ? null : JSON.stringify(payload), Date.now()]
    );
});
export const listPending = async () => {
    const db = await getDb();
    const rows = await db.getAllAsync('SELECT id, kind, status_id, payload, tries FROM status_pending ORDER BY id ASC');
    return rows.map((r) => ({ id: r.id, kind: r.kind, statusId: r.status_id, payload: r.payload ? parse(r.payload) : null, tries: r.tries }));
};
export const removePending = (id) => serializeDbWrite(async () => {
    const db = await getDb();
    await db.runAsync('DELETE FROM status_pending WHERE id = ?', [id]);
});
/** Fail par tries badhao; MAX_TRIES ke baad chhod do (warna hamesha atka rahega) */
export const bumpPending = (id) => serializeDbWrite(async () => {
    const db = await getDb();
    await db.runAsync('UPDATE status_pending SET tries = tries + 1 WHERE id = ?', [id]);
    await db.runAsync('DELETE FROM status_pending WHERE id = ? AND tries >= ?', [id, MAX_TRIES]);
});

// ── meta (config / privacy) ──────────────────────────────────────────────────
export const getStatusMeta = async (key) => {
    const db = await getDb();
    const row = await db.getFirstAsync('SELECT value FROM status_meta WHERE key = ?', [key]);
    return row?.value ? parse(row.value) : null;
};
export const setStatusMeta = (key, value) => serializeDbWrite(async () => {
    const db = await getDb();
    await db.runAsync(`INSERT INTO status_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, JSON.stringify(value)]);
});

export const clearStatusDb = () => serializeDbWrite(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
        for (const t of ['status_owners', 'status_items', 'status_seen', 'status_pending', 'status_meta']) await db.execAsync(`DELETE FROM ${t}`);
    });
});
