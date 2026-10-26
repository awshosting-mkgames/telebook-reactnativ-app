import * as SQLite from 'expo-sqlite';
import { serializeDbWrite } from './sqliteWriteQueue';

// Contacts ka persistent store. Redux sirf current (in-memory) copy rakhta hai,
// asli data yahin rehta hai aur app start par yahan se Redux me load hota hai.

const DB_NAME = 'telebook.db';

// phone primary key hai — isi se duplicate contacts apne aap avoid hote hain
// aur dobara sync par wahi row UPDATE ho jati hai (INSERT ... ON CONFLICT).
const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS contacts (
    phone         TEXT PRIMARY KEY NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    avatar        TEXT,
    is_registered INTEGER NOT NULL DEFAULT 0,
    app_user      TEXT,
    updated_at    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_contacts_registered ON contacts (is_registered);

CREATE TABLE IF NOT EXISTS contacts_meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT
);
`;

let dbPromise = null;

const getDb = () => {
    // Ek hi connection reuse karo — har call par naya kholna mehanga hai
    if (!dbPromise) {
        dbPromise = (async () => {
            const db = await SQLite.openDatabaseAsync(DB_NAME);
            await db.execAsync(SCHEMA);
            return db;
        })();
    }
    return dbPromise;
};

// DB row → app ka contact object (wahi shape jo screens pehle se use karti hain)
const rowToContact = (row) => ({
    id: row.phone,
    phone: row.phone,
    name: row.name,
    avatar: row.avatar ?? null,
    isRegistered: row.is_registered === 1,
    appUser: row.app_user ? JSON.parse(row.app_user) : null,
});

/**
 * Contacts ko bulk me insert/update karta hai.
 *
 * 1000+ contacts ke liye: ek hi transaction, ek hi prepared statement.
 * Har row par alag runAsync karne se har statement dobara compile hota aur
 * har write apna transaction kholta — isse kaafi dheema pad jata hai.
 */
export const upsertContacts = (contacts = []) => serializeDbWrite(async () => {
    if (!contacts.length) return 0;

    const db = await getDb();
    const now = Date.now();
    let written = 0;

    const statement = await db.prepareAsync(`
        INSERT INTO contacts (phone, name, avatar, is_registered, app_user, updated_at)
        VALUES ($phone, $name, $avatar, $isRegistered, $appUser, $updatedAt)
        ON CONFLICT(phone) DO UPDATE SET
            name          = excluded.name,
            avatar        = excluded.avatar,
            is_registered = excluded.is_registered,
            app_user      = excluded.app_user,
            updated_at    = excluded.updated_at
    `);

    try {
        await db.withTransactionAsync(async () => {
            for (const contact of contacts) {
                if (!contact?.phone) continue;
                await statement.executeAsync({
                    $phone: String(contact.phone),
                    $name: contact.name ?? '',
                    $avatar: contact.avatar ?? null,
                    $isRegistered: contact.isRegistered ? 1 : 0,
                    $appUser: contact.appUser ? JSON.stringify(contact.appUser) : null,
                    $updatedAt: now,
                });
                written += 1;
            }
        });
    } finally {
        await statement.finalizeAsync();
    }

    return written;
});

/** Saare contacts — registered pehle, phir naam ke hisaab se. */
export const getAllContacts = async () => {
    const db = await getDb();
    const rows = await db.getAllAsync(
        `SELECT phone, name, avatar, is_registered, app_user
           FROM contacts
          ORDER BY is_registered DESC, name COLLATE NOCASE ASC`
    );
    return rows.map(rowToContact);
};

/** Device se hate hue contacts DB se bhi hata do. */
export const deleteContactsNotIn = (phones = []) => serializeDbWrite(async () => {
    const db = await getDb();
    if (!phones.length) {
        const res = await db.runAsync('DELETE FROM contacts');
        return res.changes ?? 0;
    }
    // SQLite ki variable limit se bachne ke liye phones ko chunks me delete karte hain
    const CHUNK = 500;
    const keep = phones.map(String);
    let removed = 0;

    await db.withTransactionAsync(async () => {
        await db.execAsync('CREATE TEMP TABLE IF NOT EXISTS keep_phones (phone TEXT PRIMARY KEY)');
        await db.execAsync('DELETE FROM keep_phones');

        for (let i = 0; i < keep.length; i += CHUNK) {
            const chunk = keep.slice(i, i + CHUNK);
            const placeholders = chunk.map(() => '(?)').join(',');
            await db.runAsync(`INSERT OR IGNORE INTO keep_phones (phone) VALUES ${placeholders}`, chunk);
        }

        const res = await db.runAsync(
            'DELETE FROM contacts WHERE phone NOT IN (SELECT phone FROM keep_phones)'
        );
        removed = res.changes ?? 0;
        await db.execAsync('DELETE FROM keep_phones');
    });

    return removed;
});

export const getLastSyncedAt = async () => {
    const db = await getDb();
    const row = await db.getFirstAsync(
        'SELECT value FROM contacts_meta WHERE key = ?', ['lastSyncedAt']
    );
    return row?.value ? Number(row.value) : null;
};

export const setLastSyncedAt = (timestamp) => serializeDbWrite(async () => {
    const db = await getDb();
    await db.runAsync(
        `INSERT INTO contacts_meta (key, value) VALUES ('lastSyncedAt', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [String(timestamp)]
    );
});

/** Logout par sab saaf karne ke liye. */
export const clearContactsDb = () => serializeDbWrite(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
        await db.execAsync('DELETE FROM contacts');
        await db.execAsync('DELETE FROM contacts_meta');
    });
});
