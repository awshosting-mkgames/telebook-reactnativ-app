import { useEffect, useState } from 'react';
import apiService from './apiService';

// Admin ne kaun si jagah badge dikhana hai — GET plans → data.badgePlacements.
// Ek baar fetch, memory me cache. Startup block nahi karta: fetch aane tak defaults chalte hain.
const DEFAULTS = { home: true, chatList: true, header: true, profile: true, ring: false };

let placements = { ...DEFAULTS };
let inflight = null;
let fetchedAt = 0;
const listeners = new Set();
const TTL_MS = 30 * 60 * 1000;

export const getBadgePlacements = () => placements;

export const loadBadgePlacements = (force = false) => {
    if (inflight) return inflight;
    if (!force && fetchedAt && Date.now() - fetchedAt < TTL_MS) return Promise.resolve(placements);
    inflight = (async () => {
        try {
            const res = await apiService({ method: 'GET', endpoint: 'plans' });
            const bp = res?.data?.data?.badgePlacements ?? res?.data?.badgePlacements;
            if (res?.success && bp && typeof bp === 'object') {
                placements = { ...DEFAULTS, ...bp };
                fetchedAt = Date.now();
                listeners.forEach((fn) => fn(placements));
            }
        } catch (e) {
            // defaults hi rahenge
        } finally {
            inflight = null;
        }
        return placements;
    })();
    return inflight;
};

/** Component me use: turant cached/default deta hai, fetch aane par re-render. */
export const useBadgePlacements = () => {
    const [value, setValue] = useState(placements);
    useEffect(() => {
        listeners.add(setValue);
        loadBadgePlacements();
        return () => { listeners.delete(setValue); };
    }, []);
    return value;
};

// Badge color par readable text color (luminance se)
export const badgeTextColor = (hex) => {
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(hex || '').trim());
    if (!m) return '#ffffff';
    let h = m[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.4 ? '#1a1a1a' : '#ffffff';
};
