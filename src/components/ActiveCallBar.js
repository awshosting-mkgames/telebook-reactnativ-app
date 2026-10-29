import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import socketService from '../services/socketService';
import callService from '../services/callService';
import { navigationRef, navigate as rootNavigate } from '../navigation/RootNavigation';
import { showOverLockScreen } from '../services/lockScreenModule';
import {
    clearActiveCall, clearHeldCall, getActiveCall, getHeldCall, isSwitching, patchActiveCall, setRemoteHold, subscribeActiveCall,
} from '../services/activeCallStore';
import { endCall, resumeHeld } from '../services/callHelpers';

const fmt = (secs) => `${Math.floor(secs / 60).toString().padStart(2, '0')}:${Math.floor(secs % 60).toString().padStart(2, '0')}`;
const LIVE_PHASES = ['ringing', 'connecting', 'ongoing'];
const onCallScreen = () => navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === 'InCall';

// Always-mounted (IncomingCallManager jaisa). Do kaam (Point 13):
//  1. Call chalte waqt kisi bhi dusre page par "Ongoing call" mini bar, tap par call screen wapas.
//  2. Call screen band hone par bhi call ke socket events (accepted/ended) sambhalna, taaki
//     minimize hone par call na toote aur dusre side ke hangup par sahi se saaf ho.
export default function ActiveCallBar() {
    const insets = useSafeAreaInsets();
    const [call, setCall] = useState(getActiveCall());
    const [routeName, setRouteName] = useState(null);
    const [now, setNow] = useState(Date.now());
    const tick = useRef(null);

    useEffect(() => subscribeActiveCall(setCall), []);

    // Current route track karo (bar InCall screen par chhupa rehta hai)
    useEffect(() => {
        const read = () => setRouteName(navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name ?? null : null);
        read();
        const unsub = navigationRef.addListener?.('state', read);
        const poll = setInterval(read, 1000); // ref ready hone se pehle ka case
        return () => { unsub?.(); clearInterval(poll); };
    }, []);

    const live = !!call && LIVE_PHASES.includes(call.phase);
    useEffect(() => {
        if (!live) return undefined;
        tick.current = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(tick.current);
    }, [live]);

    useEffect(() => {
        const onAccepted = (payload) => {
            const c = getActiveCall();
            if (!c || payload?.callId !== c.callId) return;
            patchActiveCall({ connected: true, phase: 'ongoing', startedAt: c.startedAt ?? Date.now() });
        };
        const onEnded = (payload) => {
            if (isSwitching(payload?.callId)) return; // End & Accept: naya call chal raha hai
            // Hold par rakhi call samne wale ne kaat di
            const h = getHeldCall();
            if (h && payload?.callId === h.callId) {
                clearHeldCall();
                if (!getActiveCall()) socketService.setCallActive(false);
                Toast.show({ type: 'info', text1: 'Call ended', text2: `${h.remoteUser?.name || 'The other person'} ended the call on hold` });
                return;
            }
            const c = getActiveCall();
            if (!c || payload?.callId !== c.callId) return;
            if (onCallScreen()) return; // call screen khud "Call ended" dikhakar saaf karegi
            callService.leaveChannel();
            callService.release();
            socketService.setCallActive(false);
            showOverLockScreen(false);
            clearActiveCall();
            // Call waiting: hold wali call ho to wahi wapas, warna sirf toast
            if (getHeldCall()) { resumeHeld(); return; }
            Toast.show({ type: 'info', text1: 'Call ended' });
        };
        // Samne wale ne hume hold par rakha / wapas liya (call waiting)
        const onHold = (payload) => { if (payload?.callId) setRemoteHold(payload.callId, !!payload.held); };
        socketService.on('call:accepted', onAccepted);
        socketService.on('call:ended', onEnded);
        socketService.on('call:hold', onHold);
        socketService.on('call:resumed', onHold);
        return () => {
            socketService.off('call:accepted', onAccepted);
            socketService.off('call:ended', onEnded);
            socketService.off('call:hold', onHold);
            socketService.off('call:resumed', onHold);
        };
    }, []);

    if (!live || routeName === 'InCall') return null;

    const secs = call.startedAt ? Math.max(0, Math.floor((now - call.startedAt) / 1000)) : 0;
    const name = call.remoteUser?.name || 'Unknown';
    const label = call.connected ? fmt(secs) : call.phase === 'ringing' ? 'Ringing…' : 'Connecting…';

    const openCall = () => rootNavigate('InCall', {
        callId: call.callId, type: call.type, isIncoming: call.isIncoming, remoteUser: call.remoteUser, agora: call.agora,
    });
    const hangup = () => {
        const id = call.callId;
        callService.leaveChannel();
        callService.release();
        socketService.setCallActive(false);
        showOverLockScreen(false);
        clearActiveCall();
        endCall(id, 'hangup');
    };

    return (
        <View style={[styles.wrap, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
            <TouchableOpacity style={styles.bar} activeOpacity={0.85} onPress={openCall}>
                <Ionicons name={call.type === 'video' ? 'videocam' : 'call'} size={18} color="#fff" />
                <Text style={styles.text} numberOfLines={1}>Ongoing {call.type} call · {name} · {label}</Text>
                <Text style={styles.hint}>Tap to return</Text>
                <TouchableOpacity onPress={hangup} hitSlop={10} style={styles.endBtn}>
                    <Ionicons name="call" size={16} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9000, elevation: 9000, backgroundColor: '#1fa855' },
    bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 8 },
    text: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
    hint: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
    endBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e53935', alignItems: 'center', justifyContent: 'center' },
});
