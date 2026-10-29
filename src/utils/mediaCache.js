// Downloaded media ka local cache (Point 5: offline photos/audio/video).
//
// Pehle har baar remote URL se Image/Audio/Video load hota tha, isliye internet band hote hi
// pehle dekhi hui media bhi nahi khulti thi. Ab pehli baar dikhte hi file documentDirectory
// me save hoti hai aur agli baar (offline bhi) wahi local file use hoti hai.
import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

const DIR = `${FileSystem.documentDirectory}media_cache/`;
const known = new Map();     // url -> local uri (memory me jaldi lookup)
const inflight = new Map();  // url -> Promise (same file do baar download na ho)
let dirReady = null;

const isRemote = (u) => /^https?:/i.test(u ?? '');

const localPathFor = (url) => {
    const clean = url.split('?')[0];
    const ext = (clean.split('/').pop() ?? '').includes('.') ? clean.split('.').pop().slice(0, 5) : 'bin';
    // path ke non-alnum chars '_' kar do; poora URL naam me rakhne se collision nahi hota
    const name = clean.replace(/^https?:\/\//i, '').replace(/[^a-zA-Z0-9]/g, '_').slice(-120);
    return `${DIR}${name}.${ext}`;
};

const ensureDir = () => {
    if (!dirReady) {
        dirReady = FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    }
    return dirReady;
};

export const getLocalUri = async (url) => {
    if (!isRemote(url)) return url || null;
    if (known.has(url)) return known.get(url);
    try {
        const path = localPathFor(url);
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists && info.size > 0) { known.set(url, path); return path; }
    } catch (e) { /* cache miss */ }
    return null;
};

// Background download; fail ho (offline) to null — caller remote URL par hi rahe
export const cacheMedia = (url) => {
    if (!isRemote(url)) return Promise.resolve(url || null);
    if (inflight.has(url)) return inflight.get(url);
    const job = (async () => {
        try {
            const existing = await getLocalUri(url);
            if (existing) return existing;
            await ensureDir();
            const path = localPathFor(url);
            const tmp = `${path}.part`;
            const res = await FileSystem.downloadAsync(url, tmp);
            if (res.status && res.status >= 400) { await FileSystem.deleteAsync(tmp, { idempotent: true }); return null; }
            await FileSystem.moveAsync({ from: tmp, to: path });
            known.set(url, path);
            return path;
        } catch (e) {
            return null;
        } finally {
            inflight.delete(url);
        }
    })();
    inflight.set(url, job);
    return job;
};

// Local file ho to wahi, warna remote URL (aur background me cache shuru)
export const useMediaUri = (url, { autoCache = true } = {}) => {
    const [uri, setUri] = useState(() => (isRemote(url) ? (known.get(url) ?? url) : url));
    useEffect(() => {
        if (!isRemote(url)) { setUri(url); return undefined; }
        let alive = true;
        getLocalUri(url).then((local) => {
            if (!alive) return;
            if (local) setUri(local);
            else {
                setUri(url);
                if (autoCache) cacheMedia(url);
            }
        });
        return () => { alive = false; };
    }, [url, autoCache]);
    return uri;
};
