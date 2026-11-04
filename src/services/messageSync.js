import apiService from './apiService';
import Config from './config';
import { removeCachedMedia } from '../utils/mediaCache';
import {
    deleteCachedMessage, deleteCachedMessages, deleteMessagesForChat, getAllCachedMessages, getMessagesPage, getSyncState,
    markMessagesDeletedBatch, setMessagesSyncedAt, setSyncState, upsertMessages,
} from './messagesDb';

// Thin layer, chatSync.js jaisa — par ek chat ke messages tak scoped
// (4 chat-list tabs ke jagah). Koi "smart merge/diff" logic yahan nahi —
// upsertMessages() already idempotent overwrite-by-id karta hai, isliye
// cache write kabhi bhi kisi bhi up-to-date message array ke saath safe hai.

// In-memory mirror — chat dobara kholne par SQL ka async wait bhi na ho
// (pehla frame hi messages ke saath render ho, spinner/blank flash na aaye).
const memCache = new Map();
const byNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

export const getMemoryMessages = (chatId) => memCache.get(String(chatId)) || null;
export const clearMemoryMessages = () => { memCache.clear(); tombstones.clear(); syncing.clear(); };

// Delete-for-everyone ho chuke ids (is app session me). Server delete wapas nahi hota, lekin delete se THEEK PEHLE
// shuru hua koi page/refresh purani (undeleted) row ke saath baad me land ho sakta hai — woh message wapas jaag jata
// tha. Tombstone ke rehte non-deleted version kabhi memory/SQL/state me nahi likhte.
const tombstones = new Map(); // chatId -> Set(messageId)
export const isTombstoned = (chatId, messageId) => !!tombstones.get(String(chatId))?.has(String(messageId));
const addTombstones = (chatId, ids) => {
    const key = String(chatId);
    if (!tombstones.has(key)) tombstones.set(key, new Set());
    ids.forEach((id) => tombstones.get(key).add(String(id)));
};
const dropStale = (chatId, messages) => messages.filter((m) => m?.isDeleted || !isTombstoned(chatId, m?._id));

const fullMediaUrl = (u) => (!u ? null : /^(https?:|file:|data:)/.test(u) ? u : `${Config?.MEDIA_URL}${u}`);
const purgeMedia = (urls) => { new Set(urls.filter(Boolean)).forEach((u) => { const f = fullMediaUrl(u); if (f) removeCachedMedia(f); }); };
const urlsOf = (m) => (m?.attachments || []).flatMap((a) => [a?.url, a?.thumbnailUrl]).filter(Boolean);

export const messageStatus = (m) => {
    if (m.readBy?.length) return 'read';
    if (m.deliveredTo?.length) return 'delivered';
    return 'sent';
};

const mergeMemory = (chatId, messages) => {
    const key = String(chatId);
    const map = new Map((memCache.get(key) || []).map((m) => [m._id, m]));
    messages.forEach((m) => {
        if (!m?._id || String(m._id).startsWith('temp_')) return;
        if (map.get(m._id)?.isDeleted && !m.isDeleted) return; // deleted wapas zinda nahi hota
        map.set(m._id, m);
    });
    memCache.set(key, Array.from(map.values()).sort(byNewest));
};

/**
 * SQL se ek chat ke saare cached messages padh lo (koi network call nahi).
 * Screen jaisa newest-first array deta hai, seedha setMessages() me daalne ke liye.
 * Kabhi throw nahi karta — error par [] deta hai (log karke swallow).
 */
export const loadCachedMessages = async (chatId) => {
    try {
        const rows = await getAllCachedMessages(chatId);
        if (rows.length) mergeMemory(chatId, rows);
        return rows;
    } catch (error) {
        console.log('⚠️ loadCachedMessages error:', error);
        return [];
    }
};

/**
 * Messages SQL me likh do + us chat ka lastSyncedAt update karo.
 * Best-effort cache write — kabhi throw nahi karta, fail hone par sirf log hota
 * hai, user ko kabhi dikhna nahi chahiye. Fire-and-forget safe, par promise
 * return karta hai taki caller chahe to await bhi kar sake.
 */
export const cacheMessages = async (chatId, messages = []) => {
    try {
        messages = dropStale(chatId, messages);
        mergeMemory(chatId, messages);
        await upsertMessages(chatId, messages);
        await setMessagesSyncedAt(chatId, Date.now());
    } catch (error) {
        console.log('⚠️ cacheMessages error:', error);
    }
};

const DELETED_PATCH = { isDeleted: true, content: 'This message was deleted', attachments: [] };

/**
 * "Delete for everyone" ka asar memory mirror + SQL dono me, chahe message abhi screen ki `messages` state me ho ya na ho
 * (purane page / sirf SQLite me). Attachments row se saaf, aur un messages ki local media-cache files bhi hat jati hain.
 */
export const markMessagesDeleted = async (chatId, messageIds = []) => {
    try {
        const ids = [...new Set((messageIds || []).map(String))];
        if (!ids.length) return;
        addTombstones(chatId, ids);
        const idSet = new Set(ids);
        const key = String(chatId);
        const urls = [];
        const list = memCache.get(key);
        if (list) {
            memCache.set(key, list.map((m) => {
                if (!idSet.has(String(m._id))) return m;
                urls.push(...urlsOf(m));
                return { ...m, ...DELETED_PATCH };
            }));
        }
        const sqlUrls = await markMessagesDeletedBatch(chatId, ids, DELETED_PATCH);
        purgeMedia([...urls, ...sqlUrls]);
    } catch (error) {
        console.log('⚠️ markMessagesDeleted error:', error);
    }
};

/** Delete-for-me (is user ke liye): rows SQL + memory se hatao. */
export const removeMessagesLocally = async (chatId, messageIds = []) => {
    try {
        const idSet = new Set((messageIds || []).map(String));
        if (!idSet.size) return;
        const key = String(chatId);
        const list = memCache.get(key);
        if (list) memCache.set(key, list.filter((m) => !idSet.has(String(m._id))));
        await deleteCachedMessages(chatId, [...idSet]);
    } catch (error) {
        console.log('⚠️ removeMessagesLocally error:', error);
    }
};

/** "Clear chat" — local cache + sync cursor reset. */
export const clearChatCache = async (chatId) => {
    try {
        memCache.delete(String(chatId));
        await deleteMessagesForChat(chatId);
        await setSyncState(chatId, { cursor: null, historyComplete: false, backfillBefore: null });
    } catch (error) {
        console.log('⚠️ clearChatCache error:', error);
    }
};

/** Temp/failed row ko SQL + memory se hatao (asli message aa jaane ya user delete karne par). */
export const uncacheMessage = async (chatId, messageId) => {
    try {
        const key = String(chatId);
        const list = memCache.get(key);
        if (list) memCache.set(key, list.filter((m) => m._id !== messageId));
        await deleteCachedMessage(chatId, messageId);
    } catch (error) {
        console.log('⚠️ uncacheMessage error:', error);
    }
};

// ── Global / "mobile-as-a-server" sync engine ───────────────────────────────────────────────────────────────
//  SQLite = source of truth. Chat khulte hi cache turant dikhta hai (screen), phir yeh engine background me:
//    1. cursor ho to DELTA  (GET ?since=<server cursor>)  — naye + edit/reaction/ticks + delete-for-everyone (isDeleted)
//       + deletedForMeIds; cursor na ho to NEWEST page (page=1) se shuru
//    2. history poori na aayi ho to purane messages ka silent crawl (GET ?before=<oldest>), ek-ek request,
//       chhota gap, jab tak server hasMore=false na kahe. Progress SQL me (backfill_before) => app kill ho to resume.
//  Har batch: SQL upsert + memory + screen callback (screen scroll position nahi chhedta — sirf append/replace).
export const SYNC_PAGE = 100;     // newest page + older crawl page
export const SYNC_DELTA = 200;    // delta batch
const SYNC_GAP_MS = 350;          // crawl ke beech saans (UI/network/server par bojh nahi)
const syncing = new Map();        // chatId -> { promise, handlers }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * syncChat(chatId, { onBatch(msgs), onRemoved(ids), onDetails(chatDetails), onProgress({syncing, historyComplete}) })
 * Ek chat par ek hi sync chalta hai (dobara bulane par wahi promise, naye handlers ke saath).
 */
export const syncChat = (chatId, handlers = {}) => {
    const key = String(chatId);
    const cur = syncing.get(key);
    if (cur) { cur.handlers = handlers; cur.again = true; return cur.promise; }
    const entry = { handlers };
    entry.promise = runSync(chatId, entry).catch((e) => { console.log('⚠️ syncChat error:', e); return { ok: false }; })
        .then(async (r) => {
            syncing.delete(key);
            entry.handlers?.onProgress?.({ syncing: false });
            // Crawl ke dauran koi aur refresh maanga gaya (foreground/reconnect) => ek baar delta aur (sasta)
            if (entry.again && r?.ok) await syncChat(chatId, entry.handlers || {});
            return r;
        });
    syncing.set(key, entry);
    return entry.promise;
};
export const detachSync = (chatId, handlers) => {
    const cur = syncing.get(String(chatId));
    if (cur && cur.handlers === handlers) cur.handlers = {};
};

const runSync = async (chatId, entry) => {
    const h = () => entry.handlers || {};
    h().onProgress?.({ syncing: true });
    const st = await getSyncState(chatId);
    const fetchJson = (qs) => apiService({ method: 'GET', endpoint: `messages/${chatId}?${qs}` });
    const seen = new Set();

    const applyMessages = async (raw) => {
        const msgs = dropStale(chatId, raw.map((m) => ({ ...m, status: messageStatus(m) })));
        // Server se aaya deleted row: local copy ki media file hatao (memory me purani attachments ho to)
        const mem = memCache.get(String(chatId));
        if (mem) {
            const byId = new Map(mem.map((m) => [m._id, m]));
            msgs.forEach((m) => { if (m.isDeleted && byId.get(m._id) && !byId.get(m._id).isDeleted) purgeMedia(urlsOf(byId.get(m._id))); });
        }
        msgs.forEach((m) => { if (m.isDeleted) addTombstones(chatId, [m._id]); seen.add(m._id); });
        if (msgs.length) await cacheMessages(chatId, msgs);
        if (msgs.length) h().onBatch?.(msgs);
        return msgs;
    };
    const applyRemoved = async (ids = []) => {
        if (!ids.length) return;
        await removeMessagesLocally(chatId, ids);
        h().onRemoved?.(ids);
    };

    let cursor = st.cursor;
    let backfillBefore = st.backfillBefore;
    let historyComplete = st.historyComplete;
    const initial = !cursor;
    let startedAt = null;

    if (cursor) {
        // ── 2a. DELTA: cursor se aage jo bhi badla ──
        for (let guard = 0; guard < 200; guard += 1) {
            const res = await fetchJson(`since=${encodeURIComponent(cursor)}&limit=${SYNC_DELTA}`);
            if (!res?.success) return { ok: false };
            if (res.data?.chatDetails) h().onDetails?.(res.data.chatDetails);
            await applyMessages(res.data?.messages ?? []);
            await applyRemoved(res.data?.deletedForMeIds ?? []);
            cursor = res.data?.nextSince ?? cursor;
            await setSyncState(chatId, { cursor });
            if (!res.data?.pagination?.hasMore) break;
            await sleep(120);
        }
    } else {
        // ── 2b. Pehli baar: newest page ──
        const res = await fetchJson(`page=1&limit=${SYNC_PAGE}`);
        if (!res?.success) return { ok: false };
        startedAt = res.data?.serverTime ?? new Date().toISOString();
        if (res.data?.chatDetails) h().onDetails?.(res.data.chatDetails);
        const msgs = await applyMessages(res.data?.messages ?? []);
        const more = res.data?.pagination?.hasMore ?? false;
        historyComplete = !more;
        backfillBefore = msgs.length ? msgs[msgs.length - 1].createdAt : null;
        cursor = startedAt;
        await setSyncState(chatId, { cursor, historyComplete, backfillBefore });
    }
    h().onProgress?.({ syncing: true, historyComplete });
    h().onFirstSync?.();

    // ── 3. Purani history ka silent crawl ──
    if (!historyComplete) {
        if (!backfillBefore) {
            const all = memCache.get(String(chatId)) || [];
            backfillBefore = all.length ? all[all.length - 1].createdAt : null;
        }
        while (backfillBefore) {
            await sleep(SYNC_GAP_MS);
            const res = await fetchJson(`before=${encodeURIComponent(backfillBefore)}&limit=${SYNC_PAGE}`);
            if (!res?.success) return { ok: false };
            const rows = res.data?.messages ?? [];
            await applyMessages(rows);
            const more = res.data?.pagination?.hasMore ?? false;
            if (rows.length) backfillBefore = rows[rows.length - 1].createdAt;
            historyComplete = !more || !rows.length;
            await setSyncState(chatId, { backfillBefore, historyComplete });
            h().onProgress?.({ syncing: true, historyComplete });
            if (historyComplete) break;
        }
    }

    // ── 4. Pehli poori crawl ke baad: purani cache ki woh rows jo server ne dobara nahi bheji (delete-for-me / clear
    //       chat jab cursor nahi tha) — hata do. Sirf crawl shuru hone se PEHLE ki rows (naye socket messages safe).
    if (initial && historyComplete && startedAt) {
        const cutoff = new Date(startedAt).getTime();
        const stale = (memCache.get(String(chatId)) || [])
            .filter((m) => !seen.has(m._id) && !String(m._id).startsWith('temp_') && new Date(m.createdAt).getTime() < cutoff - 10000)
            .map((m) => m._id);
        await applyRemoved(stale);
    }
    return { ok: true, historyComplete };
};

export { getMessagesPage };
