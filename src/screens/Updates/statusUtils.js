import { getSeenIds, markSeenDb } from '../../services/statusDb';
import Config from '../../services/config';

export const STATUS_DURATION = 5000;   // server config na aaye to image kitni der (ms)
export const VIDEO_MAX_SECS = 30;
export const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
export const TEXT_BGS = ['#075e54', '#1296f3', '#6d4c9f', '#c62828', '#ef6c00', '#00897b', '#37474f'];

export const toArr = (v) => (Array.isArray(v) ? v : []);

// Server relative path deta hai (uploads/...) — usko media host ke saath jodna hota hai.
export const imgUrl = (p) => {
    if (!p) return null;
    if (p.startsWith('http')) return p;
    return `${Config.MEDIA_URL}${p}`.replace(/([^:])\/\//g, '$1/');
};

// Server viewedBy me viewers rakhta hai — usi se ring grey/blue decide hota hai.
//
// Phone par bhi yaad rakhte hain (status id → time, 25h baad hata dete hain; status 24h me expire hota hai).
// Wajah: PUT .../view fire-and-forget hai — fail/der se pahunche to screen par wapas aane par refetch
// "viewed" ko mita deta tha aur status wapas "Status" me aa jata tha.
// Seen ids SQLite (status_seen) me; yahan memory copy taaki isSeenByMe sync rahe.
let seenIds = {};
let seenLoaded = false;
export const loadSeenIds = async () => {
    if (seenLoaded) return;
    try { seenIds = { ...(await getSeenIds()), ...seenIds }; } catch (e) { /* ignore */ }
    seenLoaded = true;
};
export const rememberSeen = (id) => {
    if (!id || seenIds[id]) return;
    seenIds[id] = Date.now();
    markSeenDb(id).catch(() => {});
};

export const isSeenByMe = (status, myUserId) => {
    if (!myUserId) return false;
    if (status?.seen || status?.isViewed) return true;
    if (status?._id && seenIds[String(status._id)]) return true;
    const viewers = toArr(status?.viewedBy ?? status?.viewers ?? status?.views);
    return viewers.some((v) => String(v?.user?._id ?? v?.user ?? v?._id ?? v) === String(myUserId));
};
export const fmtTime = (d) => {
    if (!d) return '';
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
};
export const getMediaType = (status) => {
    const t = status?.mediaType || '';
    if (t === 'video') return 'video';
    if (t === 'image') return 'image';
    const url = status?.mediaUrl || '';
    if (/\.(mp4|mov|avi|mkv|webm)$/i.test(url)) return 'video';
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) return 'image';
    return 'text';
};


/** Group me pehla unseen status (nahi to 0) — viewer yahin se shuru hota hai */
export const firstUnseenIdx = (group, myUserId) => {
    const list = toArr(group?.statuses);
    const i = list.findIndex((st) => !isSeenByMe(st, myUserId));
    return i < 0 ? 0 : i;
};

/** "Expires in 14h 5m" — server ke expiresAt se */
export const expiresIn = (d) => {
    if (!d) return '';
    const ms = new Date(d) - Date.now();
    if (ms <= 0) return 'Expired';
    const m = Math.floor(ms / 60000);
    return m >= 60 ? `Expires in ${Math.floor(m / 60)}h ${m % 60}m` : `Expires in ${m}m`;
};

/** 10:30 AM */
export const fmtClock = (d) => {
    if (!d) return '';
    const x = new Date(d);
    const h = x.getHours();
    return `${String(h % 12 || 12).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
export const fmtDay = (d) => {
    if (!d) return '';
    const x = new Date(d);
    const same = x.toDateString() === new Date().toDateString();
    return same ? 'Today' : `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
};
