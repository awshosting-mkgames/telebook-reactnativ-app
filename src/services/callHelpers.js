/**
 * callHelpers.js — call-mutation helpers shared by ChatHeader/Chat screen,
 * the Calls history list, IncomingCallManager aur InCallScreen.
 *
 * REST hi authoritative hai (socket ke `call:initiate/accept/reject/end` emits
 * yahan wire NAHI kiye — REST ke saath duplicate-initiation race ban jaati).
 */

import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import apiService from './apiService';
import socketService from './socketService';
import { apiErrorMessage } from './chatActions';
import callService from './callService';
import {
    clearActiveCall, clearHeldCall, getActiveCall, getHeldCall, markSwitching, setActiveCall, setHeldCall,
} from './activeCallStore';
import { openInCall } from '../navigation/RootNavigation';

const isOk = (res) => !!res?.success && res?.data?.success !== false;

const ERROR_MESSAGES = {
    INSUFFICIENT_COINS: 'Not enough coins to start this call — top up to continue.',
    ALREADY_IN_CALL: 'You are already on another call.',
    USER_BUSY: 'This user is busy on another call.',
    BLOCKED: "You can't call this contact.",
    CALLS_NOT_CONFIGURED: "Calling isn't available right now.",
    CALL_NOT_RINGING: 'This call has already ended.',
};

// POST /api/calls {calleeId, type} → navigate to InCall on success.
// Part 2 §2.17: call se pehle rate + balance dikhao aur confirm lo. Coins band
// ho (wallet 404) ya wallet fetch fail ho to confirm chhod kar call chalne do
// — server hi asli check karta hai (INSUFFICIENT_COINS).
async function confirmCallCost(type) {
    try {
        const w = await apiService({ method: 'GET', endpoint: 'wallet' });
        if (!isOk(w)) return true;
        const d = w.data.data ?? {};
        const rates = d.rates ?? {};
        const perUnit = type === 'video' ? rates.videoCoinsPerUnit : rates.audioCoinsPerUnit;
        if (!perUnit) return true;                       // muft call
        const unit = rates.billingUnit === 'second' ? 'second' : 'minute';
        const secs = d.talkTimeSeconds?.[type === 'video' ? 'video' : 'audio'];
        const approx = secs != null
            ? (unit === 'minute' ? `~${Math.floor(secs / 60)} min` : `~${secs} sec`)
            : null;
        const msg = [
            `${perUnit} coin${perUnit > 1 ? 's' : ''} per ${unit} (${type} call), charged for every started ${unit}.`,
            `Your balance: ${d.balance ?? 0} coins${approx ? ` (${approx})` : ''}.`,
        ].join('\n');
        return await new Promise((resolve) => {
            Alert.alert(type === 'video' ? 'Start video call?' : 'Start voice call?', msg, [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Call', onPress: () => resolve(true) },
            ], { cancelable: true, onDismiss: () => resolve(false) });
        });
    } catch (_) {
        return true;
    }
}

export async function startCall({ navigation, calleeId, type, remoteUser }) {
    if (!calleeId) return { ok: false };
    if (!(await confirmCallCost(type))) return { ok: false, cancelled: true };
    const res = await apiService({ method: 'POST', endpoint: 'calls', data: { calleeId, type } });
    if (isOk(res)) {
        const { call, agora, billing } = res.data.data ?? {};
        socketService.setCallActive(true);
        navigation.navigate('InCall', { callId: call._id, type, isIncoming: false, agora, billing, remoteUser });
        return { ok: true };
    }
    const code = res?.error?.code;
    Toast.show({ type: 'error', text1: 'Call failed', text2: ERROR_MESSAGES[code] || apiErrorMessage(res, 'Could not start the call') });
    return { ok: false, code };
}

// POST /api/calls/:callId/accept — IncomingCallManager ke Accept button, aur
// InCallScreen ke "push tap se khula, token abhi nahi mila" path, dono isi ko use karte hain.
export async function acceptCall(callId) {
    const res = await apiService({ method: 'POST', endpoint: `calls/${callId}/accept`, data: {} });
    if (isOk(res)) return { ok: true, ...(res.data.data ?? {}) };
    return { ok: false, code: res?.error?.code, message: apiErrorMessage(res, 'Could not accept the call') };
}

// Fire-and-forget — reject/end ka UI kabhi ruk kar inka response nahi chahiye.
export function rejectCall(callId) {
    return apiService({ method: 'POST', endpoint: `calls/${callId}/reject`, data: {} });
}

export function endCall(callId, reason = 'hangup') {
    return apiService({ method: 'POST', endpoint: `calls/${callId}/end`, data: { reason } });
}

// ── Call waiting (Point 13.3) ────────────────────────────────────────────────
export function holdCallApi(callId) {
    return apiService({ method: 'POST', endpoint: `calls/${callId}/hold`, data: {} });
}
export function resumeCallApi(callId) {
    return apiService({ method: 'POST', endpoint: `calls/${callId}/resume`, data: {} });
}

const callParams = (c) => ({
    callId: c.callId, type: c.type, isIncoming: c.isIncoming, remoteUser: c.remoteUser, agora: c.agora,
});

// Naya (waiting) call accept karke uski screen kholo
async function acceptAndOpen(incoming) {
    const res = await acceptCall(incoming.callId);
    if (!res.ok) {
        Toast.show({ type: 'error', text1: 'Could not answer', text2: ERROR_MESSAGES[res.code] || res.message });
        return false;
    }
    socketService.setCallActive(true);
    openInCall({
        callId: incoming.callId, type: incoming.type, isIncoming: true,
        agora: res.agora, billing: res.billing, remoteUser: incoming.caller,
    });
    return true;
}

// Chal rahi call HOLD par rakho, naya call uthao. Ek hi Agora engine/channel hota hai, isliye
// hold = purane channel se bahar; server par call 'ongoing' rehti hai (billing chalti rehti hai).
export async function holdAndAccept(incoming) {
    const cur = getActiveCall();
    if (!cur) return acceptAndOpen(incoming);
    const h = await holdCallApi(cur.callId);
    if (!isOk(h)) {
        Toast.show({ type: 'error', text1: 'Could not hold the call', text2: apiErrorMessage(h, 'Try again') });
        return false;
    }
    callService.leaveChannel();
    setHeldCall({ ...cur });
    clearActiveCall();
    const ok = await acceptAndOpen(incoming);
    if (!ok) await resumeHeld(); // naya fail hua to purani wapas
    return ok;
}

// Chal rahi call kaato, naya call uthao
export async function endAndAccept(incoming) {
    const cur = getActiveCall();
    if (cur) {
        markSwitching(cur.callId);   // is call ka call:ended screen/bar ko "naya call mat todo" bata de
        callService.leaveChannel();
        clearActiveCall();
        endCall(cur.callId, 'hangup');
    }
    return acceptAndOpen(incoming);
}

// Hold wali call wapas lo (naya call khatam hone par ya Swap par)
export async function resumeHeld() {
    const h = getHeldCall();
    if (!h) return false;
    const r = await resumeCallApi(h.callId);
    clearHeldCall();
    if (!isOk(r)) {
        // Dusri taraf ne is dauran call kaat di
        socketService.setCallActive(false);
        Toast.show({ type: 'info', text1: 'Call ended', text2: `${h.remoteUser?.name || 'The other person'} ended the call on hold` });
        return false;
    }
    const restored = { ...h, muted: false, remoteUid: null };
    setActiveCall(restored);
    socketService.setCallActive(true);
    openInCall(callParams(restored));
    return true;
}

// Active aur hold wali call aapas me badlo
export async function swapCalls() {
    const cur = getActiveCall();
    const target = getHeldCall();
    if (!cur || !target) return false;
    const h = await holdCallApi(cur.callId);
    if (!isOk(h)) {
        Toast.show({ type: 'error', text1: 'Could not switch calls', text2: apiErrorMessage(h, 'Try again') });
        return false;
    }
    callService.leaveChannel();
    setHeldCall({ ...cur });
    clearActiveCall();
    // resumeHeld() ab 'held' (= cur) ko resume karega, isliye target ko pehle pakad kar active banao
    const r = await resumeCallApi(target.callId);
    if (!isOk(r)) {
        Toast.show({ type: 'info', text1: 'Call ended', text2: `${target.remoteUser?.name || 'The other person'} ended the call on hold` });
        return resumeHeld();
    }
    const restored = { ...target, muted: false, remoteUid: null };
    setActiveCall(restored);
    openInCall(callParams(restored));
    return true;
}

export { ERROR_MESSAGES };
