// Backend ka system-config (privacy / terms / about / support / app links).
//
//   GET {BASE_URL}app/system-config               -> poora config
//   GET {BASE_URL}app/system-config/privacy|terms|about -> sirf ek page
//
// Rules:
//  - Auth nahi chahiye, chhota timeout; fail / offline / 404 (backend abhi deploy na ho) par
//    koi error nahi uthta — caller purane behaviour par fall back karta hai.
//  - Pehle AsyncStorage cache turant, phir network se refresh. `updatedAt` badla ho tabhi cache likhte hain.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from './config';

const TIMEOUT_MS = 8000;
const KEY_PREFIX = 'SYSTEM_CONFIG_V1:';
const FULL = 'full';

// Memory copy — sync getters (share text jaise jagah) isi se padhte hain
const mem = {};
const listeners = new Set();

const endpointOf = (kind) => (kind === FULL ? 'app/system-config' : `app/system-config/${kind}`);

const fetchJson = async (endpoint) => {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
    try {
        const res = await fetch(`${Config.BASE_URL}${endpoint}`, { signal: ctrl?.signal, headers: { Accept: 'application/json' } });
        if (!res.ok) return null; // 404 = backend abhi deploy nahi hua
        const json = await res.json();
        return json?.success && json.data ? json.data : null;
    } catch (e) {
        return null;
    } finally {
        if (timer) clearTimeout(timer);
    }
};

const readCache = async (kind) => {
    if (mem[kind]) return mem[kind];
    try {
        const raw = await AsyncStorage.getItem(KEY_PREFIX + kind);
        if (raw) mem[kind] = JSON.parse(raw);
    } catch (e) { /* kharab cache — ignore */ }
    return mem[kind] || null;
};

/** Cache turant (agar hai) + network refresh. onUpdate(data) har baar naya data aane par. */
export async function loadSystemConfig(kind = FULL, onUpdate) {
    const cached = await readCache(kind);
    if (cached) onUpdate?.(cached);
    const fresh = await fetchJson(endpointOf(kind));
    if (fresh) {
        const changed = !cached || fresh.updatedAt !== cached.updatedAt || fresh.version !== cached.version
            || JSON.stringify(fresh) !== JSON.stringify(cached);
        mem[kind] = fresh;
        if (changed) {
            AsyncStorage.setItem(KEY_PREFIX + kind, JSON.stringify(fresh)).catch(() => {});
            onUpdate?.(fresh);
            listeners.forEach((l) => { try { l(kind, fresh); } catch (e) { /* listener bug */ } });
        }
        return fresh;
    }
    return cached;
}

// Sync getter — sirf memory (app start par warmSystemConfig() bharta hai)
export const getCachedSystemConfig = () => mem[FULL] || null;

/** App start par ek baar: cache memory me + background refresh. Kabhi throw nahi karta. */
export const warmSystemConfig = () => loadSystemConfig(FULL).catch(() => null);

/** Share App ka link: server ka appLinks.downloadUrl, nahi to diya hua fallback. */
export const getAppDownloadUrl = (fallback) => getCachedSystemConfig()?.appLinks?.downloadUrl || fallback;
export const getDownloadUrl = getAppDownloadUrl; // purana naam (ChatUserDetailScreen)

/**
 * Link banana pade (server ne poora link nahi diya) to uska base: kind = 'profile' | 'channel' | 'group'.
 * Server: appLinks.profileLinkBase / channelLinkBase / groupInviteBase. Nahi mila to fallback.
 */
export const getLinkBase = (kind, fallback) => {
    const links = getCachedSystemConfig()?.appLinks || {};
    const key = { profile: 'profileLinkBase', channel: 'channelLinkBase', group: 'groupInviteBase' }[kind];
    const base = key && links[key];
    return base ? String(base).replace(/\/+$/, '') : fallback;
};

/** Share App ka poora text: server ka shareText (link ke saath) ya `${prefix} ${url}` fallback. */
export const getShareText = (fallbackPrefix, fallbackUrl) => {
    const links = getCachedSystemConfig()?.appLinks;
    const url = links?.downloadUrl || fallbackUrl;
    if (links?.shareText) return links.shareText.includes(url) ? links.shareText : `${links.shareText} ${url}`;
    return `${fallbackPrefix} ${url}`;
};
