/**
 * callHelpers.js — call-mutation helpers shared by ChatHeader/Chat screen,
 * the Calls history list, IncomingCallManager aur InCallScreen.
 *
 * REST hi authoritative hai (socket ke `call:initiate/accept/reject/end` emits
 * yahan wire NAHI kiye — REST ke saath duplicate-initiation race ban jaati).
 */

import Toast from 'react-native-toast-message';
import apiService from './apiService';
import socketService from './socketService';
import { apiErrorMessage } from './chatActions';

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
export async function startCall({ navigation, calleeId, type, remoteUser }) {
    if (!calleeId) return { ok: false };
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

export { ERROR_MESSAGES };
