import { useEffect, useRef, useState } from 'react';
import {
    BackHandler, Image, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenderModeType, RtcSurfaceView } from 'react-native-agora';
import callService from '../../services/callService';
import socketService from '../../services/socketService';
import { acceptCall, endCall, rejectCall } from '../../services/callHelpers';
import { cancelIncomingCallNotification } from '../../components/notification';
import { showOverLockScreen } from '../../services/lockScreenModule';
import { playRingtone, stopRingtone } from '../../services/ringtoneModule';
import Config from '../../services/config';
import IncomingCallOverlay from '../Call/IncomingCallOverlay';

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
    const { callId, type, isIncoming, remoteUser, autoAccept } = route.params || {};
    const isVideo = type === 'video';

    // route.params.agora missing hona matlab: notification se khula hai (app
    // backgrounded/killed tha) — token nahi hai, Accept dabane par accept
    // karke lena padega. `autoAccept` sirf tab true hai jab user ne notification
    // ke "Accept" quick-action button se khola ho — tab ring UI dikhane ki
    // zarurat nahi, seedha connect ho jaana chahiye.
    const [agora, setAgora] = useState(route.params?.agora ?? null);
    const [phase, setPhase] = useState(() => {
        if (agora) return isIncoming ? 'connecting' : 'ringing';
        if (isIncoming) return autoAccept ? 'resolving' : 'incoming';
        return 'resolving';
    });
    // incoming | resolving | ringing | connecting | ongoing | ended | missed
    const [connected, setConnected] = useState(false);
    const [duration, setDuration] = useState(0);
    const [muted, setMuted] = useState(false);
    const [speakerOn, setSpeakerOn] = useState(isVideo); // video calls default speaker on
    const [cameraOn, setCameraOn] = useState(isVideo);
    const [remoteUid, setRemoteUid] = useState(null);
    const [lowBalance, setLowBalance] = useState(null); // {remainingSeconds}
    const [endedInfo, setEndedInfo] = useState(null); // {endReason}
    const endingRef = useRef(false);
    const timerRef = useRef(null);

    const avatarUrl = toImageUrl(remoteUser?.profilePicture);
    const name = remoteUser?.name || 'Unknown';

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
    };

    const goBack = () => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('tab', { screen: 'Calls' });
    };

    const startTimer = () => {
        if (timerRef.current) return;
        const startedAt = Date.now();
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

    // ── Ring UI dikh rahi ho tab tak device ka default ringtone bajao,
    // phase kahin bhi badle (accept/reject/ended/unmount) khud band ho jaata hai ──
    useEffect(() => {
        if (phase !== 'incoming') return undefined;
        playRingtone();
        return () => stopRingtone();
    }, [phase]);

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
            await callService.requestCallPermissions(isVideo);
            if (cancelled) return;
            // Server har call ke response mein apna appId bhejta hai — Config
            // wala sirf tab tak fallback hai jab tak server-side AGORA_APP_ID
            // set na ho (doc ke hisaab se tabhi calls/config.available true hota hai).
            callService.init({ appId: agora.appId || Config.AGORA_APP_ID });
            callService.joinChannel({ token: agora.token, channel: agora.channel, uid: agora.uid, isVideo });
            socketService.setCallActive(true);
            if (isIncoming) {
                setConnected(true);
                setPhase('ongoing');
                startTimer();
            }
        })();

        const onUserJoined = (uid) => setRemoteUid(uid);
        const onUserOffline = () => setRemoteUid(null);
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
            teardown();
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
            teardown();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callId]);

    const handleEnd = async () => {
        teardown();
        endCall(callId, 'hangup'); // fire-and-forget — local teardown already happened above
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
            else handleEnd();
            return true;
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
        return () => sub.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    const toggleMute = () => { setMuted((m) => { callService.toggleMute(!m); return !m; }); };
    const toggleSpeaker = () => { setSpeakerOn((s) => { callService.toggleSpeaker(!s); return !s; }); };
    const toggleCamera = () => { setCameraOn((c) => { callService.toggleCamera(!c); return !c; }); };

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

            <View style={styles.infoWrap}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Text style={styles.statusLine}>
                    {phase === 'ringing' ? 'Ringing…' : connected ? fmtDuration(duration) : 'Connecting…'}
                </Text>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity style={styles.ctrlBtn} onPress={toggleMute} activeOpacity={0.8}>
                    <Ionicons name={muted ? 'mic-off' : 'mic'} size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.ctrlBtn} onPress={toggleSpeaker} activeOpacity={0.8}>
                    <Ionicons name={speakerOn ? 'volume-high' : 'volume-mute'} size={24} color="#fff" />
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
    endBtn: { backgroundColor: '#e53935' },
});
