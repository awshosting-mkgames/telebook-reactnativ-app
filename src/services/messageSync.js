import { deleteCachedMessage, getAllCachedMessages, setMessagesSyncedAt, upsertMessages } from './messagesDb';

// Thin layer, chatSync.js jaisa — par ek chat ke messages tak scoped
// (4 chat-list tabs ke jagah). Koi "smart merge/diff" logic yahan nahi —
// upsertMessages() already idempotent overwrite-by-id karta hai, isliye
// cache write kabhi bhi kisi bhi up-to-date message array ke saath safe hai.

// In-memory mirror — chat dobara kholne par SQL ka async wait bhi na ho
// (pehla frame hi messages ke saath render ho, spinner/blank flash na aaye).
const memCache = new Map();
const byNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

export const getMemoryMessages = (chatId) => memCache.get(String(chatId)) || null;
export const clearMemoryMessages = () => memCache.clear();

const mergeMemory = (chatId, messages) => {
    const key = String(chatId);
    const map = new Map((memCache.get(key) || []).map((m) => [m._id, m]));
    messages.forEach((m) => { if (m?._id && !String(m._id).startsWith('temp_')) map.set(m._id, m); });
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
        mergeMemory(chatId, messages);
        await upsertMessages(chatId, messages);
        await setMessagesSyncedAt(chatId, Date.now());
    } catch (error) {
        console.log('⚠️ cacheMessages error:', error);
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
