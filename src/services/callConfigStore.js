/**
 * callConfigStore.js — GET /api/calls/config, cached for the session.
 *
 * Plain cached module (profileSync.js jaisa), Redux nahi — yeh read-mostly
 * session config hai (available/billing/talkTime), koi screen ki apni state
 * nahi. ChatHeader aur Call/index.js dono isi cache se `available` padhte
 * hain taaki call button/calls-tab tabhi dikhe jab server par calling on ho.
 */

import apiService from './apiService';

let cached = null;
let inflight = null;

export async function fetchCallsConfig() {
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const res = await apiService({ method: 'GET', endpoint: 'calls/config' });
            if (res?.success && res.data?.success !== false) {
                cached = res.data?.data ?? null;
            }
        } catch (e) {
            console.warn('[callConfigStore] fetch error:', e?.message);
        } finally {
            inflight = null;
        }
        return cached;
    })();
    return inflight;
}

export function getCachedCallsConfig() {
    return cached;
}
