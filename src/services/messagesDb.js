import * as SQLite from 'expo-sqlite';
import { serializeDbWrite } from './sqliteWriteQueue';

// Ek chat ke messages ka persistent store (offline cache).
// chatsDb.js sirf chat-list summaries rakhta hai, poora message thread nahi —
// yeh file wahi gap bharti hai. Same file (`telebook.db`) reuse karte hain,
// expo-sqlite same naam ki connection dedupe kar deta hai.
//
// Message object gehra nested hai (sender{}, replyTo{}, attachments[], reactions[]...)
// aur screens use poora ka poora use karti hain, isliye use JSON me rakhte hain —
// chatsDb.js ka wahi "JSON blob per row" pattern.

const DB_NAME = 'telebook.db';

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS messages (
    chat_id    TEXT    NOT NULL,
    message_id TEXT    NOT NULL,
    data       TEXT    NOT NULL,
    created_at TEXT,
    updated_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (chat_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_order ON messages (chat_id, created_at);

CREATE TABLE IF NOT EXISTS messages_meta (
    chat_id        TEXT PRIMARY KEY NOT NULL,
    last_synced_at INTEGER
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

const safeParse = (json) => {
    try {
        return JSON.parse(json);
    } catch (e) {
        return null;
    }
};

/**
 * Bulk insert-or-replace — ek hi transaction me. Yeh ADDITIVE hai (upsert),
 * replaceTabChats jaisa full-replace-and-delete-stale NAHI hai — page 1 aur
 * page 2 ke messages ek doosre ko delete nahi karte.
 */
export const upsertMessages = (chatId, messages = []) => serializeDbWrite(async () => {
    if (!chatId) return 0;
    const db = await getDb();
    const now = Date.now();

    const statement = await db.prepareAsync(`
        INSERT INTO messages (chat_id, message_id, data, created_at, updated_at)
        VALUES ($chatId, $messageId, $data, $createdAt, $updatedAt)
        ON CONFLICT(chat_id, message_id) DO UPDATE SET
            data       = excluded.data,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
    `);

    let count = 0;
    try {
        await db.withTransactionAsync(async () => {
            for (let i = 0; i < messages.length; i += 1) {
                const msg = messages[i];
                const messageId = msg?._id;
                if (!msg || !messageId) continue;
                await statement.executeAsync({
                    $chatId: String(chatId),
                    $messageId: String(messageId),
                    $data: JSON.stringify(msg),
                    $createdAt: msg?.createdAt ?? null,
                    $updatedAt: now,
                });
                count += 1;
            }
        });
    } finally {
        await statement.finalizeAsync();
    }

    return count;
});

/** Ek chat ke messages, ek page, newest-first (API ke page-1 order jaisa). */
export const getMessagesPage = async (chatId, { limit = 50, beforeCreatedAt = null } = {}) => {
    if (!chatId) return [];
    const db = await getDb();
    const rows = beforeCreatedAt
        ? await db.getAllAsync(
            'SELECT data FROM messages WHERE chat_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?',
            [String(chatId), beforeCreatedAt, limit]
        )
        : await db.getAllAsync(
            'SELECT data FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?',
            [String(chatId), limit]
        );
    return rows.map((row) => safeParse(row.data)).filter(Boolean);
};

/** Us chat ke saare cached messages, newest-first, koi limit nahi ("offline me sab dikhao" wala case). */
export const getAllCachedMessages = async (chatId) => {
    if (!chatId) return [];
    const db = await getDb();
    const rows = await db.getAllAsync(
        'SELECT data FROM messages WHERE chat_id = ? ORDER BY created_at DESC',
        [String(chatId)]
    );
    return rows.map((row) => safeParse(row.data)).filter(Boolean);
};

/** SQL check — kya is chat ke liye local data pehle se maujood hai? */
export const hasMessagesForChat = async (chatId) => {
    if (!chatId) return false;
    const db = await getDb();
    const row = await db.getFirstAsync('SELECT COUNT(*) AS total FROM messages WHERE chat_id = ?', [String(chatId)]);
    return (row?.total ?? 0) > 0;
};

export const getMessagesSyncedAt = async (chatId) => {
    if (!chatId) return null;
    const db = await getDb();
    const row = await db.getFirstAsync(
        'SELECT last_synced_at FROM messages_meta WHERE chat_id = ?', [String(chatId)]
    );
    return row?.last_synced_at ?? null;
};

export const setMessagesSyncedAt = (chatId, timestamp) => serializeDbWrite(async () => {
    if (!chatId) return;
    const db = await getDb();
    await db.runAsync(
        `INSERT INTO messages_meta (chat_id, last_synced_at) VALUES (?, ?)
         ON CONFLICT(chat_id) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
        [String(chatId), timestamp]
    );
});

/** Local delete-mark — row maujood ho to usme patch merge karke wapas likho, warna no-op. */
export const markMessageDeletedLocally = (chatId, messageId, patch) => serializeDbWrite(async () => {
    if (!chatId || !messageId) return;
    const db = await getDb();
    const row = await db.getFirstAsync(
        'SELECT data FROM messages WHERE chat_id = ? AND message_id = ?',
        [String(chatId), String(messageId)]
    );
    if (!row) return;
    const parsed = safeParse(row.data);
    if (!parsed) return;
    const merged = { ...parsed, ...patch };
    await db.runAsync(
        'UPDATE messages SET data = ?, updated_at = ? WHERE chat_id = ? AND message_id = ?',
        [JSON.stringify(merged), Date.now(), String(chatId), String(messageId)]
    );
});

/** Ek chat ke saare cached messages hata do (abhi kahin use nahi, symmetry/future ke liye). */
export const deleteMessagesForChat = (chatId) => serializeDbWrite(async () => {
    if (!chatId) return 0;
    const db = await getDb();
    const res = await db.runAsync('DELETE FROM messages WHERE chat_id = ?', [String(chatId)]);
    return res.changes ?? 0;
});

/** Logout par sab saaf. */
export const clearMessagesDb = () => serializeDbWrite(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
        await db.execAsync('DELETE FROM messages');
        await db.execAsync('DELETE FROM messages_meta');
    });
});
