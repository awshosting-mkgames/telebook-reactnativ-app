/**
 * paymentActions.js — "Buy tap par kya ho" dispatch table, mode ke hisaab se.
 *
 * gateway mode on hai to Razorpay checkout chalta hai:
 *   POST payments/order -> RazorpayCheckout.open -> POST payments/verify -> refresh.
 * manual / play mode abhi bhi sirf informational Toast dikhate hain (unchanged).
 * Plans/Wallet screens ki JSX `canBuy()` se hi active/pill decide karti hain.
 */

import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import apiService from './apiService';
import { store } from '../redex/store';
import { fetchMyPlan } from '../redex/slices/plansSlice';
import { fetchWallet } from '../redex/slices/walletSlice';

// Native module build mein na ho (purani APK / Expo Go) to app crash na kare —
// isliye import top-level nahi, guarded require.
let RazorpayCheckout = null;
try {
    // eslint-disable-next-line global-require
    RazorpayCheckout = require('react-native-razorpay').default || require('react-native-razorpay');
} catch (e) {
    RazorpayCheckout = null;
}
const razorpayAvailable = () => !!(RazorpayCheckout && typeof RazorpayCheckout.open === 'function');

// Ek waqt par ek hi checkout — double tap par do order na bane.
let checkoutBusy = false;

async function handleUnavailable(kind) {
    Toast.show({
        type: 'info',
        text1: kind === 'coins' ? "Can't buy coins yet" : "Can't upgrade yet",
        text2: 'Contact support to top up or upgrade your plan — in-app purchase is coming soon.',
    });
    return { ok: false, reason: 'not_available' };
}

// PLAN 7.2 — active plan par naya plan/renew: user ko batao ki validity aaj se full hogi.
const confirmPlanRestart = (durationDays) =>
    new Promise((resolve) => {
        Alert.alert(
            'Confirm plan change',
            `Your new plan will start today and will be valid for the full ${durationDays} days from today.`,
            [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Confirm', onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) }
        );
    });

const refreshAfterPayment = (purpose) => {
    try {
        if (purpose === 'plan') store.dispatch(fetchMyPlan());
        else store.dispatch(fetchWallet());
    } catch (e) { /* refresh best-effort */ }
};

// Razorpay cancel: Android par code 0 (PAYMENT_CANCELLED) aata hai.
const isCancelled = (err) => {
    const code = err?.code ?? err?.error?.code;
    const desc = String(err?.description ?? err?.error?.description ?? '').toLowerCase();
    return code === 0 || code === '0' || desc.includes('cancel');
};

/**
 * Shared gateway flow (plans + coins). Daam/key sab server se aate hain,
 * app kuch hard-code nahi karta.
 */
async function runGatewayCheckout({ purpose, productId, description }) {
    if (!razorpayAvailable()) {
        Toast.show({ type: 'info', text1: 'Payments are not available in this build' });
        return { ok: false, reason: 'sdk_missing' };
    }
    if (checkoutBusy) return { ok: false, reason: 'busy' };
    checkoutBusy = true;
    try {
        const orderRes = await apiService({ method: 'POST', endpoint: 'payments/order', data: { purpose, productId } });
        const order = orderRes?.data?.data;
        if (!orderRes?.success || orderRes.data?.success === false || !order?.orderId) {
            const msg = orderRes?.error?.message || 'Could not start the payment. Please try again.';
            Toast.show({ type: 'error', text1: 'Payment failed to start', text2: msg });
            return { ok: false, reason: 'order_failed' };
        }

        const mobile = store.getState()?.totalappData?.user?.mobile;
        const options = {
            key: order.keyId,
            order_id: order.orderId,
            amount: order.amountInPaise ?? Math.round(Number(order.amount) * 100),
            currency: order.currency,
            name: 'Telebook',
            description: description || order.label || '',
            prefill: mobile ? { contact: String(mobile) } : undefined,
            theme: { color: '#1199ff' },
        };

        let paid;
        try {
            paid = await RazorpayCheckout.open(options);
        } catch (err) {
            if (isCancelled(err)) {
                Toast.show({ type: 'info', text1: 'Payment cancelled', text2: 'Nothing was charged or activated.' });
                return { ok: false, reason: 'cancelled' };
            }
            const d = err?.description || err?.error?.description || 'Payment could not be completed.';
            Toast.show({ type: 'error', text1: 'Payment failed', text2: String(d) });
            return { ok: false, reason: 'checkout_failed' };
        }

        const verifyRes = await apiService({
            method: 'POST',
            endpoint: 'payments/verify',
            data: {
                razorpay_order_id: paid?.razorpay_order_id,
                razorpay_payment_id: paid?.razorpay_payment_id,
                razorpay_signature: paid?.razorpay_signature,
            },
        });
        if (!verifyRes?.success || verifyRes.data?.success === false) {
            // Paise kat sakte hain par confirm nahi hua — server webhook/reconcile se apply karega.
            Toast.show({
                type: 'info',
                text1: 'Payment received',
                text2: 'Payment received, activation pending — it will be applied automatically',
                visibilityTime: 6000,
            });
            refreshAfterPayment(purpose);
            return { ok: false, reason: 'verify_pending' };
        }

        Toast.show({
            type: 'success',
            text1: purpose === 'plan' ? 'Plan activated' : 'Coins added',
            text2: purpose === 'plan' ? 'Your plan is now active.' : 'Your wallet has been topped up.',
        });
        refreshAfterPayment(purpose);
        return { ok: true };
    } catch (e) {
        console.warn('[paymentActions] checkout error:', e?.message);
        Toast.show({ type: 'error', text1: 'Payment error', text2: 'Something went wrong. Please try again.' });
        return { ok: false, reason: 'error' };
    } finally {
        checkoutBusy = false;
    }
}

export async function handleBuyCoins(pack, config) {
    const modes = config?.modes || {};
    if (modes.gateway) {
        return runGatewayCheckout({ purpose: 'coins', productId: pack?.id, description: `${pack?.coins ?? ''} coins` });
    }
    if (modes.play) return handleUnavailable('coins'); // TODO: Play Billing integration, future phase
    return handleUnavailable('coins'); // manual-only
}

export async function handleBuyPlan(plan, config) {
    const modes = config?.modes || {};
    if (modes.gateway) {
        const ent = store.getState()?.plans?.me?.entitlements;
        if (ent?.isActive) {
            const ok = await confirmPlanRestart(plan?.durationDays);
            if (!ok) return { ok: false, reason: 'declined' };
        }
        return runGatewayCheckout({ purpose: 'plan', productId: plan?.code, description: `${plan?.name ?? ''} plan` });
    }
    if (modes.play) return handleUnavailable('plan'); // TODO: Play Billing integration, future phase
    return handleUnavailable('plan'); // manual-only
}

// GET /api/payments/:transactionId — poll status after a gateway/Play checkout.
export async function getPaymentStatus(transactionId) {
    return apiService({ method: 'GET', endpoint: `payments/${transactionId}` });
}
