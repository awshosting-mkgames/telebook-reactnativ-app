/**
 * paymentActions.js — "Buy tap par kya ho" dispatch table, mode ke hisaab se.
 *
 * Abhi server ka config `{manual:true, play:false, gateway:false}` hai aur
 * is phase mein koi Razorpay/IAP SDK add nahi kiya gaya — isliye har mode
 * abhi ek informational Toast hi dikhata hai. Jab gateway/play future mein
 * on honge aur SDK add hoga, SIRF yahi do functions badlenge — Plans/Wallet
 * screens ki JSX kuch nahi badlegi (woh `canBuy()` se hi active/pill decide
 * karti hain, paymentConfigStore.js mein).
 */

import Toast from 'react-native-toast-message';
import apiService from './apiService';

async function handleUnavailable(kind) {
    Toast.show({
        type: 'info',
        text1: kind === 'coins' ? "Can't buy coins yet" : "Can't upgrade yet",
        text2: 'Contact support to top up or upgrade your plan — in-app purchase is coming soon.',
    });
    return { ok: false, reason: 'not_available' };
}

export async function handleBuyCoins(pack, config) {
    const modes = config?.modes || {};
    if (modes.gateway) return handleUnavailable('coins'); // TODO: react-native-razorpay integration, future phase
    if (modes.play) return handleUnavailable('coins'); // TODO: Play Billing integration, future phase
    return handleUnavailable('coins'); // manual-only (current server state)
}

export async function handleBuyPlan(plan, config) {
    const modes = config?.modes || {};
    if (modes.gateway) return handleUnavailable('plan'); // TODO: react-native-razorpay integration, future phase
    if (modes.play) return handleUnavailable('plan'); // TODO: Play Billing integration, future phase
    return handleUnavailable('plan'); // manual-only (current server state)
}

// GET /api/payments/:transactionId — poll status after a gateway/Play checkout.
// Future phase se pehle kahin call nahi hoti, par GET hone ki wajah se
// abhi likh dena safe hai (forward-compatible).
export async function getPaymentStatus(transactionId) {
    return apiService({ method: 'GET', endpoint: `payments/${transactionId}` });
}
