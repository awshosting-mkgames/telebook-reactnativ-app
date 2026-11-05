import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Animated, AppState, Image, KeyboardAvoidingView, Modal, PanResponder, Platform,
    Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import apiService from '../../services/apiService';
import { claimPlayback, useExclusivePlayback } from '../../utils/playbackManager';
import { useNameResolver } from '../../services/nameResolver';
import StatusViewersSheet from './StatusViewersSheet';
import { queueReaction, queueView } from '../../services/statusSync';
import {
    FALLBACK_AVATAR, STATUS_DURATION, expiresIn, firstUnseenIdx, fmtTime, getMediaType, imgUrl, isSeenByMe, rememberSeen, toArr,
} from './statusUtils';

const DEFAULT_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '🔥', '👍'];
const HOLD_MS = 220;   // itni der dabaye rakho to "hold" (pause)

// ─── StatusViewer — fullscreen, hamesha dark ─────────────────────────────────
//  * Image: timer (cfg.imageSeconds), Video: asli playback position se progress — dono kabhi saath nahi chalte.
//  * Pause ke kai kaaran ho sakte hain (hold, reply box, viewers sheet, background, menu) — sab ek set me;
//    set khali hote hi resume. Isliye "interact karte waqt auto-advance nahi" hamesha sahi rehta hai.
const StatusViewer = ({
    visible, groups, startGroupIdx = 0, myUserId, cfg, navigation,
    onClose, onDelete, onViewed, onMuteChange, onReactionChange,
}) => {
    const resolveName = useNameResolver();
    const insets = useSafeAreaInsets();
    const [groupIdx, setGroupIdx] = useState(startGroupIdx);
    const [statusIdx, setStatusIdx] = useState(0);
    const [videoReady, setVideoReady] = useState(false);
    const [holding, setHolding] = useState(false);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [showViewers, setShowViewers] = useState(false);
    const [myReactions, setMyReactions] = useState({});   // statusId -> emoji (optimistic)
    const progress = useRef(new Animated.Value(0)).current;
    const progressVal = useRef(0);
    const anim = useRef(null);
    const pauses = useRef(new Set());
    const holdTimer = useRef(null);
    const didHold = useRef(false);
    const goNextRef = useRef(() => {});

    const imageMs = Math.max(2, Number(cfg?.imageSeconds) || STATUS_DURATION / 1000) * 1000;
    const reactions = toArr(cfg?.reactions).length ? cfg.reactions : DEFAULT_REACTIONS;

    const currentGroup = groups[groupIdx];
    const currentStatus = currentGroup?.statuses?.[statusIdx];
    const totalInGroup = currentGroup?.statuses?.length ?? 0;
    const isMine = String(currentGroup?.user?._id ?? currentGroup?.user ?? '') === String(myUserId ?? '');
    const mediaType = getMediaType(currentStatus);
    const mediaUrl = imgUrl(currentStatus?.mediaUrl);
    const mediaTypeRef = useRef(mediaType);
    mediaTypeRef.current = mediaType;
    const sid = currentStatus?._id ? String(currentStatus._id) : null;
    const ownerName = isMine ? 'My Status' : resolveName(currentGroup?.user).title;
    const myReaction = sid && sid in myReactions ? myReactions[sid] : (currentStatus?.myReaction || null);

    useEffect(() => {
        const l = progress.addListener(({ value }) => { progressVal.current = value; });
        return () => progress.removeListener(l);
    }, [progress]);

    const player = useVideoPlayer(null, (p) => {
        p.loop = false;
        p.timeUpdateEventInterval = 0.25;
    });
    useExclusivePlayback(player);

    // ── Image timer ──────────────────────────────────────────────────────────
    const runImage = useCallback((from = 0) => {
        anim.current?.stop();
        progress.setValue(from);
        anim.current = Animated.timing(progress, {
            toValue: 1, duration: Math.max(50, imageMs * (1 - from)), useNativeDriver: false,
        });
        anim.current.start(({ finished }) => { if (finished) goNextRef.current(); });
    }, [imageMs, progress]);

    // ── Pause / resume (ek hi jagah) ─────────────────────────────────────────
    const pauseNow = useCallback(() => {
        anim.current?.stop();
        if (mediaTypeRef.current === 'video') { try { player.pause(); } catch (e) { /* released */ } }
    }, [player]);
    const resumeNow = useCallback(() => {
        if (mediaTypeRef.current === 'video') { try { claimPlayback(player); player.play(); } catch (e) { /* released */ } }
        else runImage(progressVal.current);
    }, [player, runImage]);
    const setPause = useCallback((reason, on) => {
        const set = pauses.current;
        const was = set.size > 0;
        if (on) set.add(reason); else set.delete(reason);
        const now = set.size > 0;
        if (!was && now) pauseNow();
        else if (was && !now) resumeNow();
    }, [pauseNow, resumeNow]);

    // ── Navigation ───────────────────────────────────────────────────────────
    const goNext = useCallback(() => {
        anim.current?.stop();
        try { player.pause(); } catch (e) { /* released */ }
        if (statusIdx < totalInGroup - 1) setStatusIdx((i) => i + 1);
        else if (groupIdx < groups.length - 1) {
            const ng = groupIdx + 1;
            setGroupIdx(ng);
            setStatusIdx(String(groups[ng]?.user?._id ?? groups[ng]?.user) === String(myUserId) ? 0 : firstUnseenIdx(groups[ng], myUserId));
        } else onClose();
    }, [statusIdx, totalInGroup, groupIdx, groups, myUserId, player, onClose]);
    goNextRef.current = goNext;

    const goPrev = useCallback(() => {
        anim.current?.stop();
        try { player.pause(); } catch (e) { /* released */ }
        if (statusIdx > 0) setStatusIdx((i) => i - 1);
        else if (groupIdx > 0) { setGroupIdx((g) => g - 1); setStatusIdx(0); }
        else { // sabse pehla status — dobara shuru se
            if (mediaTypeRef.current === 'video') { try { player.currentTime = 0; player.play(); } catch (e) { /* ignore */ } }
            else runImage(0);
        }
    }, [statusIdx, groupIdx, player, runImage]);

    // ── Open / close ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (visible) {
            const g = groups[startGroupIdx];
            setGroupIdx(startGroupIdx);
            const mine = String(g?.user?._id ?? g?.user ?? '') === String(myUserId ?? '');
            setStatusIdx(mine ? 0 : firstUnseenIdx(g, myUserId));   // pehle unseen se shuru, saare seen hon to 0 se
            setReply(''); setShowViewers(false); setMyReactions({});
        } else {
            anim.current?.stop();
            progress.setValue(0);
            pauses.current.clear();
            try { player.pause(); } catch (e) { /* released */ }
        }
    }, [visible, startGroupIdx]);

    // ── Har naye status par: timer/video naye sire se ────────────────────────
    useEffect(() => {
        if (!visible || !sid) return;
        pauses.current.clear();
        setHolding(false);
        setVideoReady(false);
        anim.current?.stop();
        progress.setValue(0);
        // Server ne expire kar diya (24h) to chalao hi mat
        if (currentStatus?.expiresAt && new Date(currentStatus.expiresAt) <= new Date()) { goNextRef.current(); return; }
        if (mediaType === 'video' && mediaUrl) {
            try { player.replace(mediaUrl); } catch (e) { /* ignore */ }
        } else {
            runImage(0);
        }
    }, [visible, groupIdx, statusIdx, sid]);

    // Video: ready → play, asli position se progress, end → next, error → skip
    useEffect(() => {
        if (!visible || mediaType !== 'video' || !mediaUrl) return undefined;
        let errTimer;
        const statusSub = player.addListener('statusChange', ({ status }) => {
            if (status === 'readyToPlay') {
                setVideoReady(true);
                if (pauses.current.size === 0) { claimPlayback(player); player.play(); }
            } else if (status === 'error') {
                errTimer = setTimeout(() => goNextRef.current(), 1500);
            }
        });
        const timeSub = player.addListener('timeUpdate', ({ currentTime }) => {
            const dur = player.duration || currentStatus?.duration || 0;
            if (dur > 0) progress.setValue(Math.min(1, currentTime / dur));
        });
        const endSub = player.addListener('playToEnd', () => { progress.setValue(1); goNextRef.current(); });
        return () => { statusSub.remove(); timeSub.remove(); endSub.remove(); clearTimeout(errTimer); };
    }, [visible, player, mediaType, mediaUrl, sid]);

    // Background me jaye to rukna, wapas aaye to wahin se
    useEffect(() => {
        if (!visible) return undefined;
        const sub = AppState.addEventListener('change', (st) => setPause('bg', st !== 'active'));
        return () => sub.remove();
    }, [visible, setPause]);

    // View record (apne status par nahi). Server fail/der kare to ek baar retry.
    useEffect(() => {
        if (!visible || !sid) return;
        onViewed && onViewed(sid);
        if (isMine) return;
        rememberSeen(sid);
        queueView(sid);   // SQL queue me pehle (offline / app kill par bhi jayega), phir bhejna
    }, [visible, sid, isMine]);

    // ── Touch: tap / hold / swipe-down ───────────────────────────────────────
    const onPressIn = () => {
        didHold.current = false;
        clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(() => { didHold.current = true; setHolding(true); setPause('hold', true); }, HOLD_MS);
    };
    const onPressOut = () => {
        clearTimeout(holdTimer.current);
        if (didHold.current) { setHolding(false); setPause('hold', false); }
    };
    const tap = (fn) => () => { if (!didHold.current) fn(); };

    const pan = useRef(PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => g.dy > 18 && Math.abs(g.dy) > Math.abs(g.dx) * 1.6,
        onPanResponderGrant: () => { clearTimeout(holdTimer.current); },
        onPanResponderRelease: (_e, g) => { if (g.dy > 110) closeRef.current(); },
    })).current;
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    // ── Actions ──────────────────────────────────────────────────────────────
    const handleDelete = () => {
        if (!sid) return;
        setPause('menu', true);
        Alert.alert('Delete status?', 'This status will be removed for everyone.', [
            { text: 'Cancel', style: 'cancel', onPress: () => setPause('menu', false) },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    const res = await apiService({ method: 'DELETE', endpoint: `status/${sid}` });
                    if (res?.success || res?.data?.success) {
                        onDelete && onDelete(sid);
                        pauses.current.clear();
                        if (totalInGroup <= 1) {
                            groupIdx < groups.length - 1 ? goNext() : onClose();
                        } else { setStatusIdx((i) => Math.min(i, totalInGroup - 2)); }
                    } else {
                        setPause('menu', false);
                        Alert.alert('Error', 'Could not delete the status');
                    }
                },
            },
        ], { onDismiss: () => setPause('menu', false) });
    };

    const handleMute = () => {
        const uid = String(currentGroup?.user?._id ?? '');
        const muted = !!currentGroup?.muted;
        setPause('menu', true);
        Alert.alert(
            muted ? `Unmute ${ownerName}?` : `Mute ${ownerName}?`,
            muted ? 'Their status updates will appear in Recent updates again.' : 'Their status updates will move to Muted updates. They will not be told.',
            [
                { text: 'Cancel', style: 'cancel', onPress: () => setPause('menu', false) },
                {
                    text: muted ? 'Unmute' : 'Mute',
                    onPress: async () => {
                        const res = await apiService({ method: muted ? 'DELETE' : 'POST', endpoint: `status/mute/${uid}` });
                        setPause('menu', false);
                        if (res?.success) onMuteChange && onMuteChange(uid, !muted);
                        else Alert.alert('Error', 'Could not update. Please try again.');
                    },
                },
            ],
            { onDismiss: () => setPause('menu', false) },
        );
    };

    const sendReaction = async (emoji) => {
        if (!sid) return;
        const next = myReaction === emoji ? null : emoji;
        setMyReactions((m) => ({ ...m, [sid]: next }));
        const result = await queueReaction(sid, next);   // 'sent' | 'queued' (offline: baad me jayega) | 'rejected'
        if (result === 'rejected') {
            setMyReactions((m) => ({ ...m, [sid]: myReaction }));   // wapas
            Alert.alert('Error', 'Could not send the reaction (the status may have expired)');
        } else onReactionChange && onReactionChange(sid, next);
    };

    const sendReply = async () => {
        const text = reply.trim();
        if (!text || sending || !sid) return;
        setSending(true);
        const res = await apiService({
            method: 'POST', endpoint: `status/${sid}/reply`,
            data: { content: text, clientMessageId: `sr_${sid}_${Date.now()}` },
        });
        setSending(false);
        const data = res?.data?.data;
        if (res?.success && data?.chatId) {
            setReply('');
            const other = currentGroup?.user;
            onClose();
            navigation?.navigate?.('Chat', {
                chatId: data.chatId, chatName: ownerName, chatImage: other?.profilePicture, isGroup: false, otherUserId: String(other?._id ?? ''),
            });
        } else {
            Alert.alert('Error', res?.status === 410 ? 'This status has expired' : 'Could not send the reply. Please try again.');
        }
    };

    if (!visible || !currentGroup) return null;
    const avatar = imgUrl(currentGroup?.user?.profilePicture) || FALLBACK_AVATAR;
    const viewCount = currentStatus?.viewCount ?? toArr(currentStatus?.viewedBy).length;
    const receiptsOff = !!currentStatus?.receiptsOff;
    const reactionCount = currentStatus?.reactionCount ?? toArr(currentStatus?.reactions).length;

    return (
        <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={vs.container} {...pan.panHandlers}>
                    <View style={[vs.progressRow, { paddingTop: insets.top + 8 }]}>
                        {currentGroup.statuses.map((_, i) => (
                            <View key={i} style={vs.track}>
                                <Animated.View style={[vs.fill, {
                                    width: i < statusIdx ? '100%'
                                        : i === statusIdx
                                            ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                                            : '0%',
                                }]} />
                            </View>
                        ))}
                    </View>

                    <View style={[vs.header, { paddingTop: insets.top + 20 }]}>
                        <Image source={{ uri: avatar }} style={vs.avatar} />
                        <View style={{ flex: 1 }}>
                            <Text style={vs.name} numberOfLines={1}>{ownerName}</Text>
                            <Text style={vs.time}>{fmtTime(currentStatus?.createdAt)}</Text>
                        </View>
                        {mediaType === 'video' && (
                            <View style={vs.videoBadge}>
                                <Ionicons name="videocam" size={12} color="#fff" />
                                <Text style={vs.videoBadgeText}>Video</Text>
                            </View>
                        )}
                        {isMine ? (
                            <TouchableOpacity onPress={handleDelete} style={vs.iconBtn}>
                                <Ionicons name="trash-outline" size={22} color="#ff5252" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={handleMute} style={vs.iconBtn}>
                                <Ionicons name={currentGroup?.muted ? 'volume-high-outline' : 'volume-mute-outline'} size={22} color="#fff" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={onClose} style={vs.iconBtn}>
                            <Ionicons name="close" size={26} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {mediaType === 'image' && mediaUrl && (
                        <Image source={{ uri: mediaUrl }} style={vs.media} resizeMode="contain" />
                    )}
                    {mediaType === 'video' && mediaUrl && (
                        <>
                            {!videoReady && !!currentStatus?.thumbnailUrl && (
                                <Image source={{ uri: imgUrl(currentStatus.thumbnailUrl) }} style={[vs.media, StyleSheet.absoluteFill]} resizeMode="contain" />
                            )}
                            <VideoView player={player} style={vs.media} contentFit="contain" nativeControls={false} />
                            {!videoReady && (
                                <View style={vs.loader} pointerEvents="none"><ActivityIndicator color="#fff" size="large" /></View>
                            )}
                        </>
                    )}
                    {mediaType === 'text' && (
                        <View style={[vs.media, vs.textBg, { backgroundColor: currentStatus?.backgroundColor || '#075e54' }]}>
                            <Text style={vs.statusText}>{currentStatus?.content || ''}</Text>
                        </View>
                    )}

                    {/* Tap zones: bayen 35% = pehle wala, baaki = agla. Hold = pause. Bottom controls inke upar (zIndex) */}
                    <View style={vs.tapRow} pointerEvents="box-none">
                        <Pressable style={vs.tapLeft} onPressIn={onPressIn} onPressOut={onPressOut} onPress={tap(goPrev)} />
                        <Pressable style={vs.tapRight} onPressIn={onPressIn} onPressOut={onPressOut} onPress={tap(goNext)} />
                    </View>
                    {holding && (
                        <View style={vs.pausedPill} pointerEvents="none"><Ionicons name="pause" size={14} color="#fff" /><Text style={vs.pausedText}>Paused</Text></View>
                    )}

                    <View style={[vs.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
                        {!!currentStatus?.content && mediaType !== 'text' && (
                            <Text style={vs.caption}>{currentStatus.content}</Text>
                        )}
                        {isMine ? (
                            <TouchableOpacity
                                style={vs.ownerRow} activeOpacity={0.8}
                                onPress={() => { setShowViewers(true); setPause('sheet', true); }}
                            >
                                <Ionicons name="eye-outline" size={18} color="#fff" />
                                <Text style={vs.viewsText}>
                                    {receiptsOff ? 'Views hidden (read receipts off)' : `${viewCount ?? 0} ${viewCount === 1 ? 'view' : 'views'}`}
                                </Text>
                                {reactionCount > 0 && <Text style={vs.viewsText}>· {reactionCount} {reactionCount === 1 ? 'reaction' : 'reactions'}</Text>}
                                <View style={{ flex: 1 }} />
                                <Text style={vs.expiry}>{expiresIn(currentStatus?.expiresAt)}</Text>
                                <Ionicons name="chevron-up" size={16} color="#fff" />
                            </TouchableOpacity>
                        ) : (
                            <>
                                <View style={vs.reactRow}>
                                    {reactions.map((e) => (
                                        <TouchableOpacity key={e} onPress={() => sendReaction(e)} style={[vs.reactBtn, myReaction === e && vs.reactActive]}>
                                            <Text style={vs.reactEmoji}>{e}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <View style={vs.replyRow}>
                                    <TextInput
                                        style={vs.replyInput}
                                        value={reply}
                                        onChangeText={setReply}
                                        placeholder={`Reply to ${ownerName}`}
                                        placeholderTextColor="rgba(255,255,255,0.6)"
                                        onFocus={() => setPause('input', true)}
                                        onBlur={() => setPause('input', false)}
                                        maxLength={1000}
                                        returnKeyType="send"
                                        onSubmitEditing={sendReply}
                                    />
                                    <TouchableOpacity onPress={sendReply} disabled={!reply.trim() || sending} style={[vs.sendBtn, (!reply.trim() || sending) && { opacity: 0.4 }]}>
                                        {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>

                    <StatusViewersSheet
                        visible={showViewers}
                        statusId={sid}
                        navigation={navigation}
                        onClose={() => { setShowViewers(false); setPause('sheet', false); }}
                        onNavigate={onClose}
                    />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const vs = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
    track: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
    avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#fff' },
    name: { color: '#fff', fontWeight: '700', fontSize: 15 },
    time: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    iconBtn: { padding: 6, marginLeft: 2 },
    videoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
    videoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    media: { flex: 1, width: '100%' },
    loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    textBg: { justifyContent: 'center', alignItems: 'center', padding: 32 },
    statusText: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center', lineHeight: 36 },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingTop: 10, backgroundColor: 'rgba(0,0,0,0.5)', gap: 8, zIndex: 8 },
    caption: { color: '#fff', fontSize: 14 },
    ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
    viewsText: { color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: '600' },
    expiry: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginRight: 6 },
    reactRow: { flexDirection: 'row', justifyContent: 'space-between' },
    reactBtn: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 16 },
    reactActive: { backgroundColor: 'rgba(255,255,255,0.28)' },
    reactEmoji: { fontSize: 24 },
    replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    replyInput: { flex: 1, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 8, fontSize: 14 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1296f3', alignItems: 'center', justifyContent: 'center' },
    tapRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5 },
    tapLeft: { flex: 35 },
    tapRight: { flex: 65 },
    pausedPill: { position: 'absolute', alignSelf: 'center', top: '45%', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, zIndex: 9 },
    pausedText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

export default StatusViewer;
