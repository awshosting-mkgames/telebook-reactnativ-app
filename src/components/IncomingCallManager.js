import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { useSelector } from 'react-redux';
import socketService from '../services/socketService';
import { acceptCall, endAndAccept, holdAndAccept, rejectCall } from '../services/callHelpers';
import { navigate as rootNavigate } from '../navigation/RootNavigation';
import IncomingCallOverlay from '../screens/Call/IncomingCallOverlay';
import { cancelIncomingCallNotification } from './notification';
import { playRingtone, stopRingtone } from '../services/ringtoneModule';
import Toast from 'react-native-toast-message';
import { getActiveCall } from '../services/activeCallStore';

// Always-mounted sibling (ChatListSocketSync.js jaisa) — `call:incoming` par
// ek global full-screen overlay dikhata hai, chahe app kisi bhi screen/tab
// par ho. Koi portal/modal-provider is codebase mein nahi hai, isliye Toast
// jaisa hi ek absolutely-positioned View use kiya hai.
const IncomingCallManager = () => {
    const token = useSelector((state) => state.totalappData?.apiToken ?? null);
    const [incomingCall, setIncomingCall] = useState(null); // {callId, type, caller, startedAt, ringTimeoutSeconds}
    // Call waiting: ek call chalte waqt aayi doosri call (server `waiting: true` bhejta hai)
    const [waitingCall, setWaitingCall] = useState(null);
    const acceptingRef = useRef(false);
    const ringingIdRef = useRef(null); // abhi ring ho rahi call (overlay dikh raha hai)

    useEffect(() => {
        if (!token) {
            setIncomingCall(null);
            return undefined;
        }

        const handleIncoming = (payload) => {
            if (!payload?.callId) return;
            // Point 13.3: pehle se ek call chal rahi hai (ya ring ho rahi hai) → naya caller ko
            // "busy" reject, ringtone/overlay nahi (server bhi normally busy bhej deta hai; yeh safety net hai).
            const live = getActiveCall();
            const alreadyRinging = ringingIdRef.current && ringingIdRef.current !== payload.callId;
            // Call waiting: chal rahi call par hain aur server ne waiting call bheji — user ko 3 vikalp do
            if (payload.waiting && live && live.callId !== payload.callId && !alreadyRinging) {
                ringingIdRef.current = payload.callId;
                setWaitingCall(payload);
                Vibration.vibrate([0, 400, 300, 400]); // ringtone nahi: baat-cheet na bigde
                return;
            }
            if (alreadyRinging || live && live.callId !== payload.callId && ['ringing', 'connecting', 'ongoing'].includes(live.phase)) {
                rejectCall(payload.callId);
                Toast.show({ type: 'info', text1: 'Missed call', text2: `${payload.caller?.name || 'Someone'} called while you were on another call` });
                return;
            }
            acceptingRef.current = false;
            ringingIdRef.current = payload.callId;
            setIncomingCall(payload);
            playRingtone();
        };
        // Caller ne hangup kar diya ya ringTimeoutSeconds beet gaya — overlay hata do.
        const handleEnded = (payload) => {
            if (payload?.callId) cancelIncomingCallNotification(payload.callId);
            stopRingtone();
            if (ringingIdRef.current === payload?.callId) ringingIdRef.current = null;
            setIncomingCall((cur) => (cur && cur.callId === payload?.callId ? null : cur));
            setWaitingCall((cur) => {
                if (cur && cur.callId === payload?.callId) { Vibration.cancel(); return null; }
                return cur;
            });
        };

        socketService.on('call:incoming', handleIncoming);
        socketService.on('call:ended', handleEnded);

        return () => {
            socketService.off('call:incoming', handleIncoming);
            socketService.off('call:ended', handleEnded);
            stopRingtone();
        };
    }, [token]);

    if (!incomingCall && waitingCall) {
        const w = waitingCall;
        const done = () => { Vibration.cancel(); ringingIdRef.current = null; setWaitingCall(null); };
        return (
            <View style={styles.waitWrap} pointerEvents="box-none">
                <View style={styles.waitCard}>
                    <Text style={styles.waitTitle} numberOfLines={1}>{w.caller?.name || 'Unknown'}</Text>
                    <Text style={styles.waitSub}>Incoming {w.type} call — you are on another call</Text>
                    <View style={styles.waitRow}>
                        <TouchableOpacity style={[styles.waitBtn, styles.waitReject]} onPress={() => { done(); rejectCall(w.callId); }}>
                            <Text style={styles.waitBtnText}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.waitBtn, styles.waitEnd]} onPress={() => { done(); endAndAccept(w); }}>
                            <Text style={styles.waitBtnText}>End & Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.waitBtn, styles.waitHold]} onPress={() => { done(); holdAndAccept(w); }}>
                            <Text style={styles.waitBtnText}>Hold & Accept</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    if (!incomingCall) return null;

    const handleAccept = async () => {
        if (acceptingRef.current) return;
        acceptingRef.current = true;
        ringingIdRef.current = null;
        stopRingtone();
        cancelIncomingCallNotification(incomingCall.callId); // race-safe: push bhi aa gaya ho to hata do
        const res = await acceptCall(incomingCall.callId);
        if (res.ok) {
            socketService.setCallActive(true);
            setIncomingCall(null);
            rootNavigate('InCall', {
                callId: incomingCall.callId,
                type: incomingCall.type,
                isIncoming: true,
                agora: res.agora,
                billing: res.billing,
                remoteUser: incomingCall.caller,
            });
        } else {
            // Call already ended/timed out server-side — bas overlay hata do.
            setIncomingCall(null);
        }
        acceptingRef.current = false;
    };

    const handleReject = () => {
        ringingIdRef.current = null;
        stopRingtone();
        rejectCall(incomingCall.callId);
        cancelIncomingCallNotification(incomingCall.callId);
        setIncomingCall(null);
    };

    return (
        <View style={styles.overlay}>
            <IncomingCallOverlay
                caller={incomingCall.caller}
                type={incomingCall.type}
                onAccept={handleAccept}
                onReject={handleReject}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    waitWrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 48, paddingHorizontal: 12, zIndex: 9999, elevation: 9999 },
    waitCard: { backgroundColor: '#1d2329', borderRadius: 18, padding: 14, elevation: 12, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8 },
    waitTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
    waitSub: { color: '#b8c4cc', fontSize: 12, marginTop: 2, marginBottom: 12 },
    waitRow: { flexDirection: 'row', gap: 8 },
    waitBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    waitBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
    waitReject: { backgroundColor: '#e53935' },
    waitEnd: { backgroundColor: '#e67e22' },
    waitHold: { backgroundColor: '#2ecc71' },
    overlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999, elevation: 9999,
    },
});

export default IncomingCallManager;
