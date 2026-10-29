import { useEffect, useRef, useState } from 'react';
import {
    BackHandler, Image, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenderModeType, RtcSurfaceView } from 'react-native-agora';
import callService from '../../services/callService';
import {
    clearActiveCall, getActiveCall, getHeldCall, isRemoteHeld, isSwitching, patchActiveCall, setActiveCall, subscribeActiveCall,
} from '../../services/activeCallStore';
import socketService from '../../services/socketService';
import { acceptCall, endCall, rejectCall, resumeHeld, swapCalls } from '../../services/callHelpers';
import { cancelIncomingCallNotification } from '../../components/notification';
import { showOverLockScreen } from '../../services/lockScreenModule';
import { playRingback, playRingtone, stopRingback, stopRingtone } from '../../services/ringtoneModule';
import Config from '../../services/config';
import IncomingCallOverlay from '../Call/IncomingCallOverlay';
import { useNameResolver } from '../../services/nameResolver';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const toImageUrl = (v) => (!v ? DEFAULT_AVATAR : /^(https?:|file:|data:)/.test(v) ? v : `${Config.MEDIA_URL}${v}`);

const fmtDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const END_REASON_LABEL = {
    insufficient_coins: 'Call ended — insufficient balance',
    hangup: 'Call ended',
    network: 'Call ended — network issue',
};

export default function InCallScreen({ route, navigation }) {
    const resolveName = useNameResolver();
    const { callId, type, isIncoming, remoteUser, autoAccept } = route.params || {};
    const isVideo = type === 'video';

    // route.params.agora missing hona matlab: notification se khula hai (app
    // backgrounded/killed tha) — token nahi hai, Accept dabane par accept
    // karke lena padega. `autoAccept` sirf tab true hai jab user ne notification
    // ke "Accept" quick-action button se khola ho — tab ring UI dikhane ki
    // zarurat nahi, seedha connect ho jaana chahiye.
    // Mini bar se wapas aane par (Point 13) call pehle se chal rahi hoti hai — uski state restore karo,
    // dobara join/ring mat karo.
    const resumed = useRef(getActiveCall()?.callId === callId ? getActiveCall() : null).current;
    const [agora, setAgora] = useState(route.params?.agora ?? resumed?.agora ?? null);
    const [phase, setPhase] = useState(() => {
        if (resumed) return resumed.phase;
        if (agora) return isIncoming ? 'connecting' : 'ringing';
        if (isIncoming) return autoAccept ? 'resolving' : 'incoming';
        return 'resolving';
    });
    // incoming | resolving | ringing | connecting | ongoing | ended | missed
    const [connected, setConnected] = useState(resumed?.connected ?? false);
    const [duration, setDuration] = useState(resumed?.startedAt ? Math.floor((Date.now() - resumed.startedAt) / 1000) : 0);
    const [muted, setMuted] = useState(resumed?.muted ?? false);
    const [speakerOn, setSpeakerOn] = useState(resumed?.speakerOn ?? isVideo); // video calls default speaker on
    const [cameraOn, setCameraOn] = useState(resumed?.cameraOn ?? isVideo);
    const [remoteUid, setRemoteUid] = useState(resumed?.remoteUid ?? null);
    const [lowBalance, setLowBalance] = useState(null); // {remainingSeconds}
    const [endedInfo, setEndedInfo] = useState(null); // {endReason}
    // Call waiting: doosri call hold par hai? / samne wale ne hume hold par rakha hai?
    const [heldCall, setHeldCallState] = useState(getHeldCall());
    const [remoteHeld, setRemoteHeld] = useState(isRemoteHeld(callId));
    useEffect(() => subscribeActiveCall(() => {
        setHeldCallState(getHeldCall());
        setRemoteHeld(isRemoteHeld(callId));
    }), [callId]);
    const endingRef = useRef(false);
    const timerRef = useRef(null);

    const avatarUrl = toImageUrl(remoteUser?.profilePicture);
    const resolvedRemote = remoteUser?.mobile ? resolveName(remoteUser) : null;
    const name = resolvedRemote?.title || remoteUser?.name || 'Unknown';

    // Call khud ko saaf karna — end/leave/release/setCallActive(false)/lock
    // screen flag off, kabhi bhi (end button, back, call:ended, unmount) do
    // baar na ho isliye guard.
    const teardown = () => {
        if (endingRef.current) return;
        endingRef.current = true;
        if (timerRef.current) clearInterval(timerRef.current);
        callService.leaveChannel();
        callService.release();
        socketService.setCallActive(false);
        showOverLockScreen(false);
        clearActiveCall();
    };

    // Call chalti rahe, sirf screen band (mini bar se wapas aa sakte hain)
    const minimize = () => goBack();

    const goBack = () => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('tab', { screen: 'Calls' });
    };

    const startTimer = () => {
        if (timerRef.current) return;
        let startedAt = getActiveCall()?.startedAt;
        if (!startedAt) { startedAt = Date.now(); patchActiveCall({ startedAt }); }
        setDuration(Math.floor((Date.now() - startedAt) / 1000));
        timerRef.current = setInterval(() => {
            setDuration(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);
    };

    const resolveAndJoin = async () => {
        setPhase('resolving');
        const res = await acceptCall(callId);
        if (res.ok) {
            setAgora(res.agora);
            setPhase('connecting');
        } else {
            clearActiveCall();
            setPhase('missed');
            setTimeout(goBack, 1600);
        }
    };

    // ── Notification se khula ho to lock screen ke upar dikhao, aur jo
    // full-screen/heads-up notification abhi bhi lagi ho use hata do ────────
    useEffect(() => {
        if (isIncoming) {
            showOverLockScreen(true);
            cancelIncomingCallNotification(callId);
        }
        return () => showOverLockScreen(false);
    }, [isIncoming, callId]);

    // ── Call ko global store me register karo + UI state sync (mini bar / wapas aane ke liye) ──
    useEffect(() => {
        if (resumed || getActiveCall()?.callId === callId) return;
        setActiveCall({
            callId, type, isIncoming: !!isIncoming, remoteUser, agora, phase, connected: false,
            startedAt: null, muted: false, speakerOn: isVideo, cameraOn: isVideo, remoteUid: null,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        patchActiveCall({ phase, connected, muted, speakerOn, cameraOn, agora });
    }, [phase, connected, muted, speakerOn, cameraOn, agora]);
    // Timer wapas aane par (resumed) turant chalu
    useEffect(() => {
        if (resumed?.connected) startTimer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Ring UI dikh rahi ho tab tak device ka default ringtone bajao,
    // phase kahin bhi badle (accept/reject/ended/unmount) khud band ho jaata hai ──
    useEffect(() => {
        if (phase !== 'incoming') return undefined;
        playRingtone();
        return () => stopRingtone();
    }, [phase]);

    // ── Outgoing call: samne wala uthane tak caller ko ringback tone sunao ──
    useEffect(() => {
        if (isIncoming || phase !== 'ringing') return undefined;
        playRingback();
        return () => stopRingback();
    }, [phase, isIncoming]);

    // ── autoAccept (notification ka "Accept" button) → seedha accept+join ──
    useEffect(() => {
        if (agora || phase !== 'resolving') return;
        resolveAndJoin();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Join the Agora channel once we have a token ─────────────────────────
    useEffect(() => {
        if (!agora) return undefined;
        let cancelled = false;

        (async () => {
            // Pehle se is channel me hain (screen dobara khuli) → dobara join nahi
            if (callService.isJoined(agora.channel)) return;
            await callService.requestCallPermissions(isVideo);
            if (cancelled) return;
            // Server har call ke response mein apna appId bhejta hai — Config
            // wala sirf tab tak fallback hai jab tak server-side AGORA_APP_ID
            // set na ho (doc ke hisaab se tabhi calls/config.available true hota hai).
            callService.init({ appId: agora.appId || Config.AGORA_APP_ID });
            callService.joinChannel({ token: agora.token, channel: agora.channel, uid: agora.uid, isVideo });
            // Hold/resume ke baad naya join: mute aur speaker ka pichla state engine par dobara lagao
            callService.toggleMute(muted);
            callService.toggleSpeaker(speakerOn);
            socketService.setCallActive(true);
            if (isIncoming) {
                setConnected(true);
                setPhase('ongoing');
                startTimer();
            }
        })();

        const onUserJoined = (uid) => { setRemoteUid(uid); patchActiveCall({ remoteUid: uid }); };
        const onUserOffline = () => { setRemoteUid(null); patchActiveCall({ remoteUid: null }); };
        callService.on('userJoined', onUserJoined);
        callService.on('userOffline', onUserOffline);

        return () => {
            cancelled = true;
            callService.off('userJoined', onUserJoined);
            callService.off('userOffline', onUserOffline);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agora]);

    // ── Socket: accepted (caller side)/balance-warning/ended ────────────────
    useEffect(() => {
        const onAccepted = (payload) => {
            if (payload?.callId !== callId) return;
            setConnected(true);
            setPhase('ongoing');
            startTimer();
        };
        const onBalanceWarning = (payload) => {
            if (payload?.callId !== callId) return;
            setLowBalance(payload);
        };
        const onEnded = (payload) => {
            if (payload?.callId !== callId) return;
            if (isSwitching(callId)) return; // End & Accept: naya call chal raha hai, ise mat todo
            teardown();
            // Call waiting: ye call khatam, hold wali call wapas uthao (ended screen nahi)
            if (getHeldCall()) { resumeHeld(); return; }
            setEndedInfo(payload);
            setPhase('ended');
            setTimeout(goBack, 1600);
        };

        socketService.on('call:accepted', onAccepted);
        socketService.on('call:balance-warning', onBalanceWarning);
        socketService.on('call:ended', onEnded);

        return () => {
            socketService.off('call:accepted', onAccepted);
            socketService.off('call:balance-warning', onBalanceWarning);
            socketService.off('call:ended', onEnded);
            // Yahan teardown NAHI: screen band hone par call chalti rehni chahiye (Point 13).
            // Call sirf End button / call:ended par khatam hoti hai.
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callId]);

    const handleEnd = async () => {
        teardown();
        endCall(callId, 'hangup'); // fire-and-forget — local teardown already happened above
        if (getHeldCall()) { resumeHeld(); return; } // hold wali call wapas
        goBack();
    };

    const handleRejectIncoming = () => {
        rejectCall(callId); // fire-and-forget
        showOverLockScreen(false);
        goBack();
    };

    // ── Hardware back → ring UI me reject, warna call cleanly end ──────────
    useEffect(() => {
        const onBack = () => {
            if (phase === 'incoming') handleRejectIncoming();
            else minimize(); // pehle back dabane par call cut ho jaati thi; ab sirf minimize
            return true;
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
        return () => sub.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // State updater ke andar side-effect nahi: naya value pehle nikalo, phir engine + state
    const toggleMute = () => { const next = !muted; callService.toggleMute(next); setMuted(next); };
    const toggleSpeaker = () => { const next = !speakerOn; callService.toggleSpeaker(next); setSpeakerOn(next); };
    const toggleCamera = () => { const next = !cameraOn; callService.toggleCamera(next); setCameraOn(next); };

    // ── Rendering ────────────────────────────────────────────────────────────
    if (phase === 'incoming') {
        // App notification/background se khuli, user ne abhi Accept/Reject
        // nahi dabaya — socket IncomingCallManager ka overlay jaisa hi UI,
        // bas yahan ek pukki screen ke roop mein (lock screen ke upar).
        return (
            <View style={{ flex: 1 }}>
                <StatusBar backgroundColor="#101418" barStyle="light-content" />
                <IncomingCallOverlay
                    caller={remoteUser}
                    type={type}
                    onAccept={resolveAndJoin}
                    onReject={handleRejectIncoming}
                />
            </View>
        );
    }
    if (phase === 'resolving') {
        return (
            <SafeAreaView style={styles.center}>
                <StatusBar backgroundColor="#101418" barStyle="light-content" />
                <Text style={styles.statusText}>Connecting…</Text>
            </SafeAreaView>
        );
    }
    if (phase === 'missed') {
        return (
            <SafeAreaView style={styles.center}>
                <StatusBar backgroundColor="#101418" barStyle="light-content" />
                <Ionicons name="call" size={40} color="#e53935" />
                <Text style={styles.statusText}>Missed call</Text>
            </SafeAreaView>
        );
    }
    if (phase === 'ended') {
        return (
            <SafeAreaView style={styles.center}>
                <StatusBar backgroundColor="#101418" barStyle="light-content" />
                <Text style={styles.statusText}>{END_REASON_LABEL[endedInfo?.endReason] || 'Call ended'}</Text>
                {!!endedInfo?.durationSeconds && <Text style={styles.statusSub}>{fmtDuration(endedInfo.durationSeconds)}</Text>}
            </SafeAreaView>
        );
    }

    const showRemoteVideo = isVideo && remoteUid != null;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#101418" barStyle="light-content" />

            {showRemoteVideo ? (
                <RtcSurfaceView
                    style={styles.remoteVideo}
                    canvas={{ uid: remoteUid, renderMode: RenderModeType.RenderModeHidden }}
                />
            ) : (
                <View style={styles.avatarWrap}>
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                </View>
            )}

            {isVideo && cameraOn && (
                <View style={styles.localVideoWrap}>
                    <RtcSurfaceView
                        style={styles.localVideo}
                        canvas={{ uid: 0, renderMode: RenderModeType.RenderModeHidden }}
                        zOrderOnTop
                        zOrderMediaOverlay
                    />
                </View>
            )}

            {!!lowBalance && (
                <View style={styles.lowBalanceBanner}>
                    <Ionicons name="warning" size={16} color="#fff" />
                    <Text style={styles.lowBalanceText}>
                        Low balance — call may end in ~{lowBalance.remainingSeconds ?? '--'}s
                    </Text>
                </View>
            )}

            {!!heldCall && (
                <TouchableOpacity style={styles.heldStrip} onPress={swapCalls} activeOpacity={0.85}>
                    <Ionicons name="pause-circle" size={18} color="#fff" />
                    <Text style={styles.heldText} numberOfLines={1}>{heldCall.remoteUser?.name || 'Unknown'} · on hold</Text>
                    <Text style={styles.heldSwap}>Swap</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.minimizeBtn} onPress={minimize} activeOpacity={0.8} hitSlop={10}>
                <Ionicons name="chevron-down" size={28} color="#fff" />
            </TouchableOpacity>

            <View style={styles.infoWrap}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Text style={styles.statusLine}>
                    {remoteHeld ? 'On hold…' : phase === 'ringing' ? 'Ringing…' : connected ? fmtDuration(duration) : 'Connecting…'}
                </Text>
            </View>

            <View style={styles.controls}>
                {/* Point 13.4: active state saaf dikhe — on hone par safed background + gehra icon */}
                <TouchableOpacity style={[styles.ctrlBtn, muted && styles.ctrlBtnActive]} onPress={toggleMute} activeOpacity={0.8}>
                    <Ionicons name={muted ? 'mic-off' : 'mic'} size={24} color={muted ? '#101418' : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ctrlBtn, speakerOn && styles.ctrlBtnActive]} onPress={toggleSpeaker} activeOpacity={0.8}>
                    <Ionicons name={speakerOn ? 'volume-high' : 'volume-mute'} size={24} color={speakerOn ? '#101418' : '#fff'} />
                </TouchableOpacity>
                {isVideo && (
                    <>
                        <TouchableOpacity style={styles.ctrlBtn} onPress={toggleCamera} activeOpacity={0.8}>
                            <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.ctrlBtn} onPress={() => callService.switchCamera()} activeOpacity={0.8}>
                            <Ionicons name="camera-reverse" size={24} color="#fff" />
                        </TouchableOpacity>
                    </>
                )}
                <TouchableOpacity style={[styles.ctrlBtn, styles.endBtn]} onPress={handleEnd} activeOpacity={0.85}>
                    <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#101418' },
    center: { flex: 1, backgroundColor: '#101418', alignItems: 'center', justifyContent: 'center', gap: 10 },
    statusText: { color: '#fff', fontSize: 18, fontWeight: '600' },
    statusSub: { color: '#9aa5ab', fontSize: 14 },

    avatarWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#333' },

    remoteVideo: { flex: 1 },
    localVideoWrap: {
        position: 'absolute', top: 50, right: 16, width: 110, height: 150,
        borderRadius: 14, overflow: 'hidden', backgroundColor: '#1a1f24', elevation: 6,
    },
    localVideo: { flex: 1 },

    lowBalanceBanner: {
        position: 'absolute', top: 0, left: 0, right: 0,
        backgroundColor: '#e67e22', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 8,
    },
    lowBalanceText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    infoWrap: { position: 'absolute', top: '14%', left: 0, right: 0, alignItems: 'center' },
    name: { color: '#fff', fontSize: 22, fontWeight: '700' },
    statusLine: { color: '#cfd8dc', fontSize: 14, marginTop: 6 },

    controls: {
        position: 'absolute', bottom: 40, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'center', gap: 18, paddingHorizontal: 20,
    },
    ctrlBtn: {
        width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center', justifyContent: 'center',
    },
    ctrlBtnActive: { backgroundColor: '#ffffff' },
    endBtn: { backgroundColor: '#e53935' },
    heldStrip: {
        position: 'absolute', top: 36, left: 56, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(230,126,34,0.95)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
    },
    heldText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
    heldSwap: { color: '#fff', fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
    minimizeBtn: { position: 'absolute', top: 40, left: 14, padding: 6 },
});
