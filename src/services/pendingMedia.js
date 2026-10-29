import { AppState } from 'react-native';
import socketService from './socketService';

// Pending (abhi upload/send ho rahe) media messages ka module-level store.
//
// Pehle upload queue + optimistic bubble Chat screen ke component state me thi, isliye
// upload ke dauran Back dabane par bubble gayab ho jata tha aur wapas aane par progress
// nahi dikhta tha (Point 9/10/15). Ab upload job isi store me update karta hai; Chat
// screen sirf subscribe karta hai — screen band ho to bhi upload chalta rehta hai aur
// dobara kholne par pending bubble + progress wahi se mil jata hai.

const byChat = new Map();   // chatId -> Map(tempId -> message)
const listeners = new Map(); // chatId -> Set(fn)

const key = (chatId) => String(chatId);
const emit = (chatId, event) => {
    (listeners.get(key(chatId)) || []).forEach((fn) => { try { fn(event); } catch (e) { /* ignore */ } });
};

export const getPending = (chatId) => Array.from(byChat.get(key(chatId))?.values() || []);

export const upsertPending = (chatId, msg) => {
    const k = key(chatId);
    if (!byChat.has(k)) byChat.set(k, new Map());
    byChat.get(k).set(msg._id, msg);
    emit(chatId, { type: 'upsert', msg });
};

export const patchPending = (chatId, id, patch) => {
    const cur = byChat.get(key(chatId))?.get(id);
    if (cur) byChat.get(key(chatId)).set(id, { ...cur, ...patch });
    emit(chatId, { type: 'patch', id, patch });
};

// Server ne message confirm kar diya — temp bubble ko asli message se badlo
export const resolvePending = (chatId, id, msg) => {
    byChat.get(key(chatId))?.delete(id);
    emit(chatId, { type: 'resolve', id, msg });
};

export const removePending = (chatId, id) => {
    byChat.get(key(chatId))?.delete(id);
    emit(chatId, { type: 'remove', id });
};

// Failed / offline-queued message store me rehta hai (retry ke liye), par upload ab nahi chal raha
export const subscribePending = (chatId, fn) => {
    const k = key(chatId);
    if (!listeners.has(k)) listeners.set(k, new Set());
    listeners.get(k).add(fn);
    return () => listeners.get(k)?.delete(fn);
};

// ── Upload queue (module-level: screen unmount se nahi rukti) ──────────────
// 3 parallel photos dheeli network par timeout/"Network Error" de rahe the (Point 12) — 2 rakho
export const MAX_CONCURRENT_UPLOADS = 2;
const queue = [];
let active = 0;
const runNext = () => {
    if (active >= MAX_CONCURRENT_UPLOADS) return;
    const job = queue.shift();
    if (!job) return;
    active += 1;
    job().catch(() => {}).finally(() => { active -= 1; runNext(); });
    runNext();
};
export const enqueueUpload = (job) => { queue.push(job); runNext(); };

// Reducer: store event ko messages array (newest-first) par lagao
export const applyPendingEvent = (prev, ev) => {
    switch (ev.type) {
        case 'upsert':
            return prev.some((m) => m._id === ev.msg._id)
                ? prev.map((m) => (m._id === ev.msg._id ? { ...m, ...ev.msg } : m))
                : [ev.msg, ...prev];
        case 'patch':
            return prev.map((m) => (m._id === ev.id ? { ...m, ...ev.patch } : m));
        case 'resolve':
            // Socket ne asli message pehle daal diya ho to temp hatao, warna replace
            return prev.some((m) => m._id === ev.msg._id)
                ? prev.filter((m) => m._id !== ev.id)
                : prev.map((m) => (m._id === ev.id ? ev.msg : m));
        case 'remove':
            return prev.filter((m) => m._id !== ev.id);
        default:
            return prev;
    }
};

// Network-fail hue media ke auto-retry attempts (screen remount se bhi yaad rahe)
export const autoRetryAttempts = new Map();
export const AUTO_RETRY_DELAYS = [5000, 10000, 20000, 30000, 45000, 60000];

// Cancel flags module-level: chat dobara khulne par naya screen instance bhi purane chal rahe job ko cancel kar sake
export const cancelledUploads = {};

// ── Network wapas aate hi pending uploads khud resume (Point 12) ─────────────
// Network-fail hue media ka retry function yahan register hota hai. Socket reconnect ya app
// foreground par sabko ek saath try karte hain — Chat screen khuli ho ya na ho.
const retryHandlers = new Map(); // `${chatId}:${tempId}` -> () => void
const rkey = (chatId, id) => `${chatId}:${id}`;
export const registerRetry = (chatId, id, fn) => { retryHandlers.set(rkey(chatId, id), fn); };
export const unregisterRetry = (chatId, id) => { retryHandlers.delete(rkey(chatId, id)); };

let resumeTimer = null;
export const resumeQueuedUploads = () => {
    // Reconnect ke saath aksar kai events ek saath aate hain — ek hi baar chalao
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
        Array.from(retryHandlers.entries()).forEach(([k, fn]) => {
            const [chatId, ...rest] = k.split(':');
            const id = rest.join(':');
            const cur = byChat.get(chatId)?.get(id);
            if (!cur || cur.status !== 'failed' || !cur.offlineQueued) { retryHandlers.delete(k); return; }
            fn();
        });
    }, 800);
};

socketService.on('connect', resumeQueuedUploads);
AppState.addEventListener('change', (st) => { if (st === 'active') resumeQueuedUploads(); });
