import { getAllCachedMessages, setMessagesSyncedAt, upsertMessages } from './messagesDb';

// Thin layer, chatSync.js jaisa — par ek chat ke messages tak scoped
// (4 chat-list tabs ke jagah). Koi "smart merge/diff" logic yahan nahi —
// upsertMessages() already idempotent overwrite-by-id karta hai, isliye
// cache write kabhi bhi kisi bhi up-to-date message array ke saath safe hai.

/**
 * SQL se ek chat ke saare cached messages padh lo (koi network call nahi).
 * Screen jaisa newest-first array deta hai, seedha setMessages() me daalne ke liye.
 * Kabhi throw nahi karta — error par [] deta hai (log karke swallow).
 */
export const loadCachedMessages = async (chatId) => {
    try {
        return await getAllCachedMessages(chatId);
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
        await upsertMessages(chatId, messages);
        await setMessagesSyncedAt(chatId, Date.now());
    } catch (error) {
        console.log('⚠️ cacheMessages error:', error);
    }
};
