import * as SQLite from 'expo-sqlite';
import { serializeDbWrite } from './sqliteWriteQueue';

// 4 tabs (All / Groups / Unread / Calls) ka persistent store.
// Redux sirf current copy rakhta hai, asli data yahin rehta hai aur app open
// hote hi yahan se Redux me load hota hai.
//
// Chat object gehra nested hai (users[], latestMessage{}, readBy[]...) aur
// screens use poora ka poora use karti hain, isliye use JSON me rakhte hain.
// Column-wise todne se ek mapper layer banani padti, jo yahan nahi chahiye.

const DB_NAME = 'telebook.db';

export const CHAT_TABS = ['All', 'Groups', 'Unread', 'Calls'];

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS chat_tabs (
    tab        TEXT    NOT NULL,
    chat_id    TEXT    NOT NULL,
    position   INTEGER NOT NULL DEFAULT 0,
    data       TEXT    NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tab, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_tabs_order ON chat_tabs (tab, position);

CREATE TABLE IF NOT EXISTS chat_tabs_meta (
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

const safeParse = (json) => {
    try {
        return JSON.parse(json);
    } catch (e) {
        return null;
    }
};

/**
 * Ek tab ka data poora replace karta hai — ek hi transaction me.
 * (tab, chat_id) primary key hai, isliye duplicate nahi bante aur dobara
 * sync par wahi row UPDATE ho jati hai.
 */
export const replaceTabChats = (tab, chats = []) => serializeDbWrite(async () => {
    const db = await getDb();
    const now = Date.now();

    const statement = await db.prepareAsync(`
        INSERT INTO chat_tabs (tab, chat_id, position, data, updated_at)
        VALUES ($tab, $chatId, $position, $data, $updatedAt)
        ON CONFLICT(tab, chat_id) DO UPDATE SET
            position   = excluded.position,
            data       = excluded.data,
            updated_at = excluded.updated_at
    `);

    try {
        await db.withTransactionAsync(async () => {
            const keptIds = [];

            for (let i = 0; i < chats.length; i += 1) {
                const chat = chats[i];
                const chatId = chat?._id;
                if (!chatId) continue;
                await statement.executeAsync({
                    $tab: tab,
                    $chatId: String(chatId),
                    $position: i,
                    $data: JSON.stringify(chat),
                    $updatedAt: now,
                });
                keptIds.push(String(chatId));
            }

            // Is tab se hate hue chats DB se bhi hata do
            if (!keptIds.length) {
                await db.runAsync('DELETE FROM chat_tabs WHERE tab = ?', [tab]);
                return;
            }
            const placeholders = keptIds.map(() => '?').join(',');
            await db.runAsync(
                `DELETE FROM chat_tabs WHERE tab = ? AND chat_id NOT IN (${placeholders})`,
                [tab, ...keptIds]
            );
        });
    } finally {
        await statement.finalizeAsync();
    }

    return chats.length;
});

/** Ek tab ke chats, server wale order me. */
export const getTabChats = async (tab) => {
    const db = await getDb();
    const rows = await db.getAllAsync(
        'SELECT data FROM chat_tabs WHERE tab = ? ORDER BY position ASC',
        [tab]
    );
    return rows.map((row) => safeParse(row.data)).filter(Boolean);
};

/** Chaaron tabs ek saath — app open par yahi use hota hai. */
export const getAllTabChats = async () => {
    const db = await getDb();
    const rows = await db.getAllAsync(
        'SELECT tab, data FROM chat_tabs ORDER BY tab ASC, position ASC'
    );

    const tabs = {};
    CHAT_TABS.forEach((tab) => { tabs[tab] = []; });

    rows.forEach((row) => {
        const chat = safeParse(row.data);
        if (!chat) return;
        if (!tabs[row.tab]) tabs[row.tab] = [];
        tabs[row.tab].push(chat);
    });

    return tabs;
};

/** Ek chat ko chaaron tabs se hata do (delete/block ke baad). */
export const deleteChatFromDb = (chatId) => serializeDbWrite(async () => {
    if (!chatId) return 0;
    const db = await getDb();
    const res = await db.runAsync('DELETE FROM chat_tabs WHERE chat_id = ?', [String(chatId)]);
    return res.changes ?? 0;
});

/** SQL check — kya local data pehle se maujood hai? */
export const hasChatData = async () => {
    const db = await getDb();
    const row = await db.getFirstAsync('SELECT COUNT(*) AS total FROM chat_tabs');
    return (row?.total ?? 0) > 0;
};

export const getChatsSyncedAt = async () => {
    const db = await getDb();
    const row = await db.getFirstAsync(
        'SELECT value FROM chat_tabs_meta WHERE key = ?', ['lastSyncedAt']
    );
    return row?.value ? Number(row.value) : null;
};

export const setChatsSyncedAt = (timestamp) => serializeDbWrite(async () => {
    const db = await getDb();
    await db.runAsync(
        `INSERT INTO chat_tabs_meta (key, value) VALUES ('lastSyncedAt', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [String(timestamp)]
    );
});

/** Logout par sab saaf. */
export const clearChatsDb = () => serializeDbWrite(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
        await db.execAsync('DELETE FROM chat_tabs');
        await db.execAsync('DELETE FROM chat_tabs_meta');
    });
});
