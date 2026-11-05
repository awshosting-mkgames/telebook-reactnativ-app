import apiService from './apiService';
import {
    bumpPending, enqueuePending, getStatusMeta, listPending, loadStatusFeed, patchStatusLocal, purgeExpiredStatus,
    removePending, replaceStatusFeed, setStatusMeta,
} from './statusDb';

// Status sync: Screen → (SQL pehle) → API → SQL → UI.
//   loadLocal()      : cache turant (offline me bhi)
//   fetchRemote()    : API se feed, SQL me reconcile, taaza data lauta
//   queueView/React  : pehle SQL queue me (durable), phir bhejne ki koshish — network/server fail par queue me rehta hai
//   flushPending()   : queue khali karo; app foreground / socket connect / feed fetch par chalta hai (single-flight)

const toArr = (v) => (Array.isArray(v) ? v : []);
let flushing = null;

export const loadLocal = async (myUserId) => {
    await purgeExpiredStatus();
    const feed = await loadStatusFeed(myUserId);
    const cfg = await getStatusMeta('config');
    return { ...feed, cfg };
};

/** @returns {Promise<null | {others, mine, cfg}>} null = network/server fail (cache hi rehne do) */
export const fetchRemote = async (myUserId, myUserFallback) => {
    const [allRes, myRes] = await Promise.all([
        apiService({ method: 'GET', endpoint: 'status' }),
        apiService({ method: 'GET', endpoint: 'status/my' }),
    ]);
    if (!allRes?.success || !myRes?.success) return null;
    const cfg = allRes.data?.config ?? null;
    const others = toArr(allRes.data?.statuses ?? allRes.data).filter((g) => g?.user?._id && String(g.user._id) !== String(myUserId));
    const myStatuses = toArr(myRes.data?.statuses ?? myRes.data);
    const rawUser = myStatuses[0]?.user;
    const mine = myStatuses.length
        ? { user: typeof rawUser === 'object' && rawUser ? rawUser : (myUserFallback || { _id: myUserId }), statuses: myStatuses }
        : null;
    await replaceStatusFeed({ others, mine, myUserId });
    if (cfg) await setStatusMeta('config', cfg);
    return { others, mine, cfg };
};

const isPermanent = (res) => res?.status && res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;

const sendOne = async (item) => {
    if (item.kind === 'view') return apiService({ method: 'PUT', endpoint: `status/${item.statusId}/view` });
    if (item.kind === 'reaction') return apiService({ method: 'POST', endpoint: `status/${item.statusId}/reaction`, data: { emoji: item.payload?.emoji ?? null } });
    return { success: true };
};

/** Queue khali karo. Return: { sent, dropped, left } */
export const flushPending = () => {
    if (flushing) return flushing;
    flushing = (async () => {
        const out = { sent: 0, dropped: 0, left: 0, rejected: [] };
        try {
            for (const item of await listPending()) {
                const res = await sendOne(item);
                if (res?.success) { await removePending(item.id); out.sent += 1; }
                else if (isPermanent(res)) {          // 403/404/410: status ab dekha/react nahi ho sakta — queue se hatao
                    await removePending(item.id); out.dropped += 1;
                    if (item.kind === 'reaction') out.rejected.push(item.statusId);
                } else { await bumpPending(item.id); out.left += 1; if (!res?.status) break; }   // network band: baaki bhi nahi chalenge
            }
        } catch (e) { /* agli baar */ }
        flushing = null;
        return out;
    })();
    return flushing;
};

/** View durable: SQL queue → bhejo. App kill / offline ho to bhi baad me jayega. */
export const queueView = async (statusId) => { await enqueuePending('view', statusId); flushPending(); };

/** Reaction: queue (last-wins) + local patch + bhejo. 'rejected' sirf tab jab server ne mana kiya (expired/blocked). */
export const queueReaction = async (statusId, emoji) => {
    await enqueuePending('reaction', statusId, { emoji: emoji ?? null });
    await patchStatusLocal(statusId, { myReaction: emoji ?? null });
    // Pehle se chalti flush isko miss kar sakti hai — do baar chalao (dusri pending hi dekhti hai jo bachi)
    const a = await flushPending();
    const b = await flushPending();
    if ([...a.rejected, ...b.rejected].includes(String(statusId))) return 'rejected';
    return (a.left + b.left) ? 'queued' : 'sent';
};
