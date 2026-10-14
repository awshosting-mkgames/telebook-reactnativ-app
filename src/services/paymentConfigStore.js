/**
 * paymentConfigStore.js — GET /api/payments/config, cached for the session.
 *
 * callConfigStore.js jaisa hi lightweight cached-module pattern. Plans aur
 * Wallet screens dono isi se decide karte hain ki Buy/Upgrade button active
 * dikhana hai ya sirf informational pill (abhi server par sirf `manual`
 * mode live hai, isliye `canBuy()` false rahega jab tak gateway/play on na ho).
 */

import apiService from './apiService';

let cached = null;
let inflight = null;

export async function fetchPaymentConfig() {
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const res = await apiService({ method: 'GET', endpoint: 'payments/config' });
            if (res?.success && res.data?.success !== false) {
                cached = res.data?.data ?? null;
            }
        } catch (e) {
            console.warn('[paymentConfigStore] fetch error:', e?.message);
        } finally {
            inflight = null;
        }
        return cached;
    })();
    return inflight;
}

export function getCachedPaymentConfig() {
    return cached;
}

// gateway/play koi bhi on ho to "Buy" button active, warna informational pill.
export function canBuy(config) {
    return !!(config?.modes?.gateway || config?.modes?.play);
}
