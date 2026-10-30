import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RenderModeType, RtcSurfaceView } from 'react-native-agora';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import socketService from '../services/socketService';
import callService from '../services/callService';
import { navigationRef, navigate as rootNavigate } from '../navigation/RootNavigation';
import { showOverLockScreen } from '../services/lockScreenModule';
import {
    clearActiveCall, clearHeldCall, getActiveCall, getHeldCall, hideRechargePrompt, isRechargePromptVisible, isSwitching, patchActiveCall,
    setRemoteHold, showRechargePrompt, subscribeActiveCall, subscribeRechargePrompt,
} from '../services/activeCallStore';
import { acceptCall, endCall, rejectCall, resumeHeld } from '../services/callHelpers';
import { playRingtone, stopRingtone } from '../services/ringtoneModule';
import { cancelIncomingCallNotification } from './notification';
import { useNameResolver } from '../services/nameResolver';
import { setPipEnabled, usePipMode } from '../services/pip';

const fmt = (secs) => `${Math.floor(secs / 60).toString().padStart(2, '0')}:${Math.floor(secs % 60).toString().padStart(2, '0')}`;
const LIVE_PHASES = ['ringing', 'connecting', 'ongoing'];
const onCallScreen = () => navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === 'InCall';


// Video call ke dauraan dusre page par jaane par right side me chhoti floating video window
// (in-app Picture-in-Picture). Drag kar sakte hain, tap par call screen wapas.
function FloatingVideo({ call, top, onOpen, onEnd, fullscreen = false }) {
    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const responder = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
        onPanResponderGrant: () => { pan.setOffset({ x: pan.x.__getValue(), y: pan.y.__getValue() }); pan.setValue({ x: 0, y: 0 }); },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
            pan.flattenOffset();
            if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) onOpen();
        },
    })).current;
    const remote = call.remoteUid != null;
    // System PiP window: poori (chhoti) window me sirf remote video, koi button/drag nahi
    if (fullscreen) {
        return (
            <View style={styles.pipFull} pointerEvents="none">
                <RtcSurfaceView
                    style={StyleSheet.absoluteFill}
                    canvas={remote
                        ? { uid: call.remoteUid, renderMode: RenderModeType.RenderModeHidden }
                        : { uid: 0, renderMode: RenderModeType.RenderModeHidden }}
                />
            </View>
        );
    }
    return (
        <Animated.View style={[styles.pip, { top }, { transform: pan.getTranslateTransform() }]} {...responder.panHandlers}>
            <RtcSurfaceView
                style={StyleSheet.absoluteFill}
                canvas={remote
                    ? { uid: call.remoteUid, renderMode: RenderModeType.RenderModeHidden }
                    : { uid: 0, renderMode: RenderModeType.RenderModeHidden }}
                zOrderOnTop
                zOrderMediaOverlay
            />
            <TouchableOpacity style={styles.pipEnd} onPress={onEnd} hitSlop={8}>
                <Ionicons name="call" size={12} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
        </Animated.View>
    );
}

// Always-mounted (IncomingCallManager jaisa). Do kaam (Point 13):
//  1. Call chalte waqt kisi bhi dusre page par "Ongoing call" mini bar, tap par call screen wapas.
//  2. Call screen band hone par bhi call ke socket events (accepted/ended) sambhalna, taaki
//     minimize hone par call na toote aur dusre side ke hangup par sahi se saaf ho.
export default function ActiveCallBar() {
    const resolveName = useNameResolver();
    const insets = useSafeAreaInsets();
    const [call, setCall] = useState(getActiveCall());
    const [routeName, setRouteName] = useState(null);
    const [now, setNow] = useState(Date.now());
    const tick = useRef(null);
    const inPip = usePipMode();

    // Video call connected ho tab Home dabane par system Picture-in-Picture (native build me)
    const pipCall = !!call && call.type === 'video' && !!call.connected && LIVE_PHASES.includes(call.phase);
    useEffect(() => {
        setPipEnabled(pipCall);
        return () => setPipEnabled(false);
    }, [pipCall]);

    useEffect(() => subscribeActiveCall(setCall), []);

    // Recharge popup (coins khatam) — kisi bhi page par
    const [rechargeOpen, setRechargeOpen] = useState(isRechargePromptVisible());
    useEffect(() => subscribeRechargePrompt(setRechargeOpen), []);

    // InCall screen se back karne par bhi incoming ghanti + vibration chalti rahe (jab tak
    // Accept/Reject na ho ya server ring timeout / caller hangup na kare)
    const incomingRinging = call?.phase === 'incoming';
    useEffect(() => {
        if (!incomingRinging) return undefined;
        playRingtone();
        return () => stopRingtone();
    }, [incomingRinging, call?.callId]);

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
            cancelIncomingCallNotification(c.callId);
            callService.leaveChannel();
            callService.release();
            socketService.setCallActive(false);
            showOverLockScreen(false);
            clearActiveCall();
            // Call waiting: hold wali call ho to wahi wapas, warna sirf toast
            if (getHeldCall()) { resumeHeld(); return; }
            if (payload?.endReason === 'insufficient_coins' && !c.isIncoming) { showRechargePrompt(); return; }
            Toast.show({ type: 'info', text1: payload?.status === 'missed' && c.phase === 'incoming' ? 'Missed call' : 'Call ended' });
        };
        // Samne wale ne hume hold par rakha / wapas liya (call waiting)
        const onHold = (payload) => { if (payload?.callId) setRemoteHold(payload.callId, !!payload.held); };
        // InCall screen band hone par bhi remote video uid track ho (floating video window ke liye)
        const onUserJoined = (uid) => { if (getActiveCall()) patchActiveCall({ remoteUid: uid }); };
        const onUserOffline = () => { if (getActiveCall()) patchActiveCall({ remoteUid: null }); };
        callService.on('userJoined', onUserJoined);
        callService.on('userOffline', onUserOffline);
        socketService.on('call:accepted', onAccepted);
        socketService.on('call:ended', onEnded);
        socketService.on('call:hold', onHold);
        socketService.on('call:resumed', onHold);
        return () => {
            callService.off('userJoined', onUserJoined);
            callService.off('userOffline', onUserOffline);
            socketService.off('call:accepted', onAccepted);
            socketService.off('call:ended', onEnded);
            socketService.off('call:hold', onHold);
            socketService.off('call:resumed', onHold);
        };
    }, []);

    const rechargeModal = (
        <Modal visible={rechargeOpen} transparent animationType="fade" onRequestClose={hideRechargePrompt}>
            <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <Ionicons name="wallet-outline" size={36} color="#e67e22" />
                    <Text style={styles.modalTitle}>Coins khatam ho gaye</Text>
                    <Text style={styles.modalText}>Balance khatam hone se call disconnect ho gayi. Call jaari rakhne ke liye wallet recharge karein.</Text>
                    <View style={styles.modalRow}>
                        <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={hideRechargePrompt}>
                            <Text style={styles.modalCancelText}>Later</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalBtn, styles.modalOk]} onPress={() => { hideRechargePrompt(); rootNavigate('Wallet'); }}>
                            <Text style={styles.modalOkText}>Recharge</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    // ── Incoming ring (InCall screen se back karne par) — Accept / Reject banner ──
    if (call && call.phase === 'incoming' && routeName !== 'InCall') {
        const callerName = call.remoteUser?.mobile ? resolveName(call.remoteUser).title : (call.remoteUser?.name || 'Unknown');
        const cleanupRing = () => {
            stopRingtone();
            cancelIncomingCallNotification(call.callId);
            showOverLockScreen(false);
        };
        const reject = () => {
            const id = call.callId;
            cleanupRing();
            clearActiveCall();
            socketService.setCallActive(false);
            rejectCall(id);
        };
        const accept = async () => {
            const snapshot = call;
            cleanupRing();
            patchActiveCall({ phase: 'resolving' });
            const res = await acceptCall(snapshot.callId);
            if (res.ok) {
                socketService.setCallActive(true);
                patchActiveCall({ phase: 'connecting', agora: res.agora });
                rootNavigate('InCall', {
                    callId: snapshot.callId, type: snapshot.type, isIncoming: true, agora: res.agora,
                    billing: res.billing, remoteUser: snapshot.remoteUser,
                });
            } else {
                clearActiveCall();
                Toast.show({ type: 'info', text1: 'Call already ended' });
            }
        };
        return (
            <>
                <View style={[styles.wrap, styles.ringWrap, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
                    <TouchableOpacity activeOpacity={0.9} style={styles.ringCard} onPress={() => rootNavigate('InCall', {
                        callId: call.callId, type: call.type, isIncoming: true, remoteUser: call.remoteUser, agora: call.agora,
                    })}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.ringName} numberOfLines={1}>{callerName}</Text>
                            <Text style={styles.ringSub}>Incoming {call.type === 'video' ? 'video' : 'voice'} call…</Text>
                        </View>
                        <TouchableOpacity onPress={reject} style={[styles.ringBtn, { backgroundColor: '#e53935' }]} hitSlop={6}>
                            <Ionicons name="call" size={20} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={accept} style={[styles.ringBtn, { backgroundColor: '#2ecc71' }]} hitSlop={6}>
                            <Ionicons name={call.type === 'video' ? 'videocam' : 'call'} size={20} color="#fff" />
                        </TouchableOpacity>
                    </TouchableOpacity>
                </View>
                {rechargeModal}
            </>
        );
    }

    // System PiP me (kisi bhi page par) sirf remote video; InCall screen apna PiP UI khud sambhalti hai
    if (inPip && pipCall && routeName !== 'InCall') {
        return <FloatingVideo call={call} fullscreen />;
    }

    if (!live || routeName === 'InCall') return rechargeModal;

    const secs = call.startedAt ? Math.max(0, Math.floor((now - call.startedAt) / 1000)) : 0;
    const name = call.remoteUser?.mobile ? resolveName(call.remoteUser).title : (call.remoteUser?.name || 'Unknown');
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
        <>
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
            {call.type === 'video' && call.connected && (
                <FloatingVideo call={call} top={insets.top + 70} onOpen={openCall} onEnd={hangup} />
            )}
            {rechargeModal}
        </>
    );
}

const styles = StyleSheet.create({
    pipFull: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 99999, elevation: 99999 },
    wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9000, elevation: 9000, backgroundColor: '#1fa855' },
    bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 8 },
    text: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
    hint: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
    ringWrap: { backgroundColor: 'transparent', paddingHorizontal: 10 },
    ringCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1d2329', borderRadius: 18, padding: 12, elevation: 14 },
    ringName: { color: '#fff', fontSize: 16, fontWeight: '700' },
    ringSub: { color: '#b8c4cc', fontSize: 12, marginTop: 2 },
    ringBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    pip: {
        position: 'absolute', right: 12, width: 104, height: 146, borderRadius: 14, overflow: 'hidden',
        backgroundColor: '#1a1f24', zIndex: 9001, elevation: 9001,
    },
    pipEnd: { position: 'absolute', bottom: 6, alignSelf: 'center', width: 26, height: 26, borderRadius: 13, backgroundColor: '#e53935', alignItems: 'center', justifyContent: 'center' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 },
    modalCard: { width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 22, alignItems: 'center', gap: 8 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
    modalText: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 8 },
    modalRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    modalCancel: { backgroundColor: '#eceff1' },
    modalCancelText: { color: '#333', fontWeight: '600' },
    modalOk: { backgroundColor: '#1199ff' },
    modalOkText: { color: '#fff', fontWeight: '700' },
    endBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e53935', alignItems: 'center', justifyContent: 'center' },
});
