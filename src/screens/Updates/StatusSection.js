import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import Config from '../../services/config';
import { appendFile } from '../../utils/uploadFile';
import { claimPlayback, useExclusivePlayback } from '../../utils/playbackManager';
const STATUS_DURATION = 5000;
const VIDEO_MAX_SECS = 30;
const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const TEXT_BGS = ['#075e54', '#1296f3', '#6d4c9f', '#c62828', '#ef6c00', '#00897b', '#37474f'];

const toArr = (v) => (Array.isArray(v) ? v : []);

// Server relative path deta hai (uploads/...) — usko media host ke saath jodna hota hai.
const imgUrl = (p) => {
    if (!p) return null;
    if (p.startsWith('http')) return p;
    return `${Config.MEDIA_URL}${p}`.replace(/([^:])\/\//g, '$1/');
};

// Server viewedBy me viewers rakhta hai — usi se ring grey/blue decide hota hai.
const isSeenByMe = (status, myUserId) => {
    if (!myUserId) return false;
    if (status?.seen || status?.isViewed) return true;
    const viewers = toArr(status?.viewedBy ?? status?.viewers ?? status?.views);
    return viewers.some((v) => String(v?.user?._id ?? v?.user ?? v?._id ?? v) === String(myUserId));
};
const fmtTime = (d) => {
    if (!d) return '';
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
};
const getMediaType = (status) => {
    const t = status?.mediaType || '';
    if (t === 'video') return 'video';
    if (t === 'image') return 'image';
    const url = status?.mediaUrl || '';
    if (/\.(mp4|mov|avi|mkv|webm)$/i.test(url)) return 'video';
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) return 'image';
    return 'text';
};

// ─── StatusViewer — fullscreen, no theme needed (always dark) ────────────────
const StatusViewer = ({ visible, groups, startGroupIdx = 0, myUserId, onClose, onDelete, onViewed }) => {
    const insets = useSafeAreaInsets();
    const [groupIdx, setGroupIdx] = useState(startGroupIdx);
    const [statusIdx, setStatusIdx] = useState(0);
    const [videoDone, setVideoDone] = useState(false);
    const progress = useRef(new Animated.Value(0)).current;
    const anim = useRef(null);

    const currentGroup = groups[groupIdx];
    const currentStatus = currentGroup?.statuses?.[statusIdx];
    const totalInGroup = currentGroup?.statuses?.length ?? 0;
    const isMine = String(currentGroup?.user?._id ?? currentGroup?.user ?? '') === String(myUserId ?? '');
    const mediaType = getMediaType(currentStatus);
    const mediaUrl = imgUrl(currentStatus?.mediaUrl);
    const viewCount = toArr(currentStatus?.viewedBy ?? currentStatus?.viewers).length;

    const player = useVideoPlayer(null, (p) => {
        p.loop = false;
        p.timeUpdateEventInterval = 0.5;
    });

    useExclusivePlayback(player);

    // Video source ko current status ke saath sync rakho
    useEffect(() => {
        if (mediaType === 'video' && mediaUrl) {
            player.replace(mediaUrl);
        }
    }, [mediaUrl, mediaType]);

    useEffect(() => {
        if (!visible) {
            player.pause();
            anim.current?.stop();
            progress.setValue(0);
        }
    }, [visible]);

    useEffect(() => {
        if (!visible || !currentStatus?._id) return;
        apiService({ method: 'PUT', endpoint: `status/${currentStatus._id}/view` }).catch(() => { });
        // Parent ko turant batao taaki "Status" list se card "Viewed Status" me
        // move ho jaye bina pura refetch kiye — backend call fire-and-forget hi rehta hai.
        onViewed && onViewed(currentStatus._id);
    }, [visible, currentStatus?._id, onViewed]);

    useEffect(() => {
        if (visible) { setGroupIdx(startGroupIdx); setStatusIdx(0); }
        else { anim.current?.stop(); progress.setValue(0); }
    }, [visible, startGroupIdx]);

    const stopVideo = useCallback(() => {
        player.pause();
    }, [player]);

    const goNext = useCallback(() => {
        anim.current?.stop();
        stopVideo();
        if (statusIdx < totalInGroup - 1) setStatusIdx(i => i + 1);
        else if (groupIdx < groups.length - 1) { setGroupIdx(g => g + 1); setStatusIdx(0); }
        else onClose();
    }, [statusIdx, totalInGroup, groupIdx, groups.length, stopVideo]);

    const goPrev = useCallback(() => {
        anim.current?.stop();
        stopVideo();
        if (statusIdx > 0) setStatusIdx(i => i - 1);
        else if (groupIdx > 0) { setGroupIdx(g => g - 1); setStatusIdx(0); }
    }, [statusIdx, groupIdx, stopVideo]);

    const startProgress = useCallback((durationMs = STATUS_DURATION) => {
        progress.setValue(0);
        anim.current?.stop();
        anim.current = Animated.timing(progress, {
            toValue: 1, duration: durationMs, useNativeDriver: false,
        });
        anim.current.start(({ finished }) => { if (finished) goNext(); });
    }, [goNext]);

    // Image/text ke liye timer-based progress; video apna real progress khud track karta hai
    useEffect(() => {
        if (!visible) return;
        setVideoDone(false);
        anim.current?.stop();
        progress.setValue(0);
        if (mediaType === 'image' || mediaType === 'text') {
            startProgress(STATUS_DURATION);
        }
    }, [visible, groupIdx, statusIdx]);

    // Video ready hote hi autoplay karo
    useEffect(() => {
        if (mediaType !== 'video' || !mediaUrl) return;
        const statusSub = player.addListener('statusChange', ({ status }) => {
            if (status === 'readyToPlay') {
                claimPlayback(player);
                player.play();
            }
        });
        return () => statusSub.remove();
    }, [player, mediaType, mediaUrl]);

    // Video ka real-time progress bar + end par next status
    useEffect(() => {
        if (mediaType !== 'video') return;
        const timeSub = player.addListener('timeUpdate', ({ currentTime }) => {
            const dur = player.duration || 0;
            if (dur > 0) progress.setValue(currentTime / dur);
        });
        const endSub = player.addListener('playToEnd', () => {
            if (!videoDone) { setVideoDone(true); progress.setValue(1); setTimeout(goNext, 300); }
        });
        return () => {
            timeSub.remove();
            endSub.remove();
        };
    }, [player, mediaType, videoDone, goNext]);

    const handleDelete = () => {
        if (!currentStatus?._id) return;
        Alert.alert('Delete status?', 'This status will be removed for everyone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    anim.current?.stop();
                    stopVideo();
                    const res = await apiService({ method: 'DELETE', endpoint: `status/${currentStatus._id}` });
                    if (res?.success || res?.data?.success) {
                        onDelete && onDelete(currentStatus._id);
                        if (totalInGroup <= 1) {
                            groupIdx < groups.length - 1
                                ? (setGroupIdx(g => g + 1), setStatusIdx(0))
                                : onClose();
                        } else goNext();
                    } else {
                        Alert.alert('Error', 'Could not delete the status');
                    }
                },
            },
        ]);
    };

    if (!visible || !currentGroup) return null;

    // status/my me user sirf id hoti hai — isliye apne status par naam fallback
    const userName = isMine ? 'My Status' : (currentGroup?.user?.name || currentGroup?.user?.mobile || 'User');
    const avatar = imgUrl(currentGroup?.user?.profilePicture) || FALLBACK_AVATAR;

    return (
        <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <View style={vs.container}>
                <View style={vs.progressRow}>
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

                <View style={vs.header}>
                    <Image source={{ uri: avatar }} style={vs.avatar} />
                    <View style={{ flex: 1 }}>
                        <Text style={vs.name}>{userName}</Text>
                        <Text style={vs.time}>{fmtTime(currentStatus?.createdAt)}</Text>
                    </View>
                    {mediaType === 'video' && (
                        <View style={vs.videoBadge}>
                            <Ionicons name="videocam" size={12} color="#fff" />
                            <Text style={vs.videoBadgeText}>Video</Text>
                        </View>
                    )}
                    {isMine && (
                        <TouchableOpacity onPress={handleDelete} style={vs.iconBtn}>
                            <Ionicons name="trash-outline" size={22} color="#f90000" />
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
                    <VideoView
                        player={player}
                        style={vs.media}
                        contentFit="contain"
                        nativeControls={false}
                    />
                )}
                {mediaType === 'text' && (
                    <View style={[vs.media, vs.textBg, { backgroundColor: currentStatus?.backgroundColor || '#075e54' }]}>
                        <Text style={vs.statusText}>{currentStatus?.content || ''}</Text>
                    </View>
                )}
                {/* Caption + (apne status par) views count — server viewedBy rakhta hai */}
                {((!!currentStatus?.content && mediaType !== 'text') || isMine) && (
                    <View style={[vs.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
                        {!!currentStatus?.content && mediaType !== 'text' && (
                            <Text style={vs.caption}>{currentStatus.content}</Text>
                        )}
                        {isMine && (
                            <View style={vs.viewsRow}>
                                <Ionicons name="eye-outline" size={15} color="rgba(255,255,255,0.9)" />
                                <Text style={vs.viewsText}>
                                    {viewCount} {viewCount === 1 ? 'view' : 'views'}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
                <View style={vs.tapRow} pointerEvents="box-none">
                    <Pressable style={vs.tapHalf} onPress={goPrev} />
                    <Pressable style={vs.tapHalf} onPress={goNext} />
                </View>
            </View>
        </Modal>
    );
};

const vs = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24) + 8, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
    track: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: Platform.OS === 'ios' ? 66 : (StatusBar.currentHeight || 24) + 20, paddingBottom: 10, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
    avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#fff' },
    name: { color: '#fff', fontWeight: '700', fontSize: 15 },
    time: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    iconBtn: { padding: 6, marginLeft: 4 },
    videoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
    videoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    media: { flex: 1, width: '100%' },
    textBg: { justifyContent: 'center', alignItems: 'center', padding: 32 },
    statusText: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center', lineHeight: 36 },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 16, backgroundColor: 'rgba(0,0,0,0.45)', gap: 8, zIndex: 6 },
    caption: { color: '#fff', fontSize: 14 },
    viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    viewsText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
    tapRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5 },
    tapHalf: { flex: 1, height: '100%' },
});

// ─── MediaPickerSheet — theme-aware ──────────────────────────────────────────
const MediaPickerSheet = ({ visible, uploading, onClose, onCamera, onGallery, onVideoGallery, onText, isDark }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={mp.overlay} activeOpacity={1} onPress={onClose}>
            <TouchableOpacity activeOpacity={1} style={[mp.sheet, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
                <View style={[mp.handle, { backgroundColor: isDark ? '#3a3a3a' : '#ddd' }]} />
                <Text style={[mp.title, { color: isDark ? '#e0e0e0' : '#222' }]}>Add Status</Text>
                {uploading ? (
                    <View style={mp.loadingBox}>
                        <ActivityIndicator size="large" color="#1296f3" />
                        <Text style={[mp.loadingText, { color: isDark ? '#aaa' : '#555' }]}>Uploading...</Text>
                    </View>
                ) : (
                    <View style={mp.optionsRow}>
                        <TouchableOpacity style={mp.option} onPress={onCamera}>
                            <View style={[mp.iconBox, { backgroundColor: isDark ? '#0d1e2e' : '#f0f6ff' }]}>
                                <Ionicons name="camera-outline" size={30} color="#1296f3" />
                            </View>
                            <Text style={[mp.label, { color: isDark ? '#ccc' : '#333' }]}>Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={mp.option} onPress={onGallery}>
                            <View style={[mp.iconBox, { backgroundColor: isDark ? '#0d1e2e' : '#f0f6ff' }]}>
                                <Ionicons name="image-outline" size={30} color="#1296f3" />
                            </View>
                            <Text style={[mp.label, { color: isDark ? '#ccc' : '#333' }]}>Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={mp.option} onPress={onVideoGallery}>
                            <View style={[mp.iconBox, { backgroundColor: isDark ? '#2e0d0d' : '#fff0f0' }]}>
                                <Ionicons name="videocam-outline" size={30} color="#e74c3c" />
                            </View>
                            <Text style={[mp.label, { color: isDark ? '#ccc' : '#333' }]}>Video</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={mp.option} onPress={onText}>
                            <View style={[mp.iconBox, { backgroundColor: isDark ? '#132a25' : '#eaf7f3' }]}>
                                <Ionicons name="text-outline" size={30} color="#00897b" />
                            </View>
                            <Text style={[mp.label, { color: isDark ? '#ccc' : '#333' }]}>Text</Text>
                        </TouchableOpacity>
                    </View>
                )}
                <TouchableOpacity style={[mp.cancelBtn, { backgroundColor: isDark ? '#2a2a2a' : '#f1f1f1' }]} onPress={onClose}>
                    <Text style={[mp.cancelText, { color: isDark ? '#aaa' : '#555' }]}>Cancel</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        </TouchableOpacity>
    </Modal>
);

const mp = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 14 },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    title: { fontSize: 17, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
    optionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    option: { alignItems: 'center', gap: 10, flex: 1 },
    iconBox: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 13, fontWeight: '600' },
    loadingBox: { alignItems: 'center', paddingVertical: 32, gap: 12 },
    loadingText: { fontSize: 14 },
    cancelBtn: { padding: 14, borderRadius: 16, alignItems: 'center' },
    cancelText: { fontSize: 15, fontWeight: '600' },
});

// ─── TextStatusComposer — viewer text status dikha raha tha par banane ka
// koi rasta nahi tha, isliye ye composer add kiya hai ────────────────────────
const TextStatusComposer = ({ visible, posting, onClose, onPost }) => {
    const insets = useSafeAreaInsets();
    const [text, setText] = useState('');
    const [bg, setBg] = useState(TEXT_BGS[0]);

    useEffect(() => {
        if (visible) { setText(''); setBg(TEXT_BGS[0]); }
    }, [visible]);

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <KeyboardAvoidingView
                style={[tc.container, { backgroundColor: bg }]}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={tc.header}>
                    <TouchableOpacity onPress={onClose} style={tc.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close" size={26} color="#fff" />
                    </TouchableOpacity>
                    <Text style={tc.headerTitle}>Text status</Text>
                    <Text style={tc.counter}>{text.length}/280</Text>
                </View>

                <TextInput
                    style={tc.input}
                    placeholder="Type a status"
                    placeholderTextColor="rgba(255,255,255,0.65)"
                    value={text}
                    onChangeText={setText}
                    multiline
                    autoFocus
                    maxLength={280}
                    textAlign="center"
                />

                <View style={[tc.footer, { paddingBottom: 14 + insets.bottom }]}>
                    <View style={tc.colorRow}>
                        {TEXT_BGS.map((c) => (
                            <TouchableOpacity
                                key={c}
                                onPress={() => setBg(c)}
                                style={tc.swatchWrap}
                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                activeOpacity={0.8}
                            >
                                <View style={[tc.swatch, { backgroundColor: c }, bg === c && tc.swatchActive]} />
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TouchableOpacity
                        style={[tc.postBtn, (!text.trim() || posting) && { opacity: 0.5 }]}
                        onPress={() => onPost(text.trim(), bg)}
                        disabled={!text.trim() || posting}
                        activeOpacity={0.85}
                    >
                        {posting
                            ? <ActivityIndicator size="small" color={bg} />
                            : <Ionicons name="send" size={20} color={bg} />
                        }
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const tc = StyleSheet.create({
    container: { flex: 1, paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24) + 10 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, gap: 12 },
    headerBtn: { padding: 4 },
    headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600' },
    counter: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
    input: { flex: 1, color: '#fff', fontSize: 26, fontWeight: '700', lineHeight: 34, paddingHorizontal: 28, textAlignVertical: 'center' },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    colorRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    // Tap target 40px — 26px ka circle ismein center hota hai
    swatchWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
    swatchActive: { borderColor: '#fff', width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
    postBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});

// ─── StatusCard ───────────────────────────────────────────────────────────────
const StatusCard = ({ group, isMe, myUserId, onPress, onAddPress, isDark }) => {
    const statuses = toArr(group?.statuses);
    const firstStatus = statuses[0];
    const mediaType = getMediaType(firstStatus);
    const bg = mediaType === 'text' ? null : imgUrl(firstStatus?.mediaUrl);
    const avatar = imgUrl(group?.user?.profilePicture) || FALLBACK_AVATAR;
    const allSeen = statuses.length > 0 && statuses.every((st) => isSeenByMe(st, myUserId));
    const name = isMe ? 'My Status' : (group?.user?.name || group?.user?.mobile || 'User');

    // Mera card, koi status nahi — pehle khali grey block dikhta tha.
    // Ab saaf "Add status" card hai jo seedha picker kholta hai.
    if (isMe && !firstStatus) {
        return (
            <TouchableOpacity
                style={[
                    sc.card,
                    sc.addCard,
                    {
                        backgroundColor: isDark ? '#121212' : '#f4f7f9',
                        borderColor: isDark ? '#2a2a2a' : '#dbe6ee',
                    },
                ]}
                onPress={onAddPress}
                activeOpacity={0.85}
            >
                <View style={sc.addAvatarWrap}>
                    <Image source={{ uri: avatar }} style={sc.addAvatar} />
                    <View style={sc.plusBadge}>
                        <Ionicons name="add" size={13} color="#fff" />
                    </View>
                </View>
                <Text style={[sc.addLabel, { color: isDark ? '#e0e0e0' : '#111' }]}>Add status</Text>
                <Text style={[sc.addHint, { color: isDark ? '#666' : '#8a9aa6' }]}>Photo, video or text</Text>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity style={sc.card} onPress={onPress} activeOpacity={0.85}>
            {bg ? (
                <View style={StyleSheet.absoluteFill}>
                    <Image source={{ uri: bg }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    <View style={sc.scrim} />
                    {mediaType === 'video' && (
                        <View style={sc.playOverlay}>
                            <Ionicons name="play-circle" size={38} color="rgba(255,255,255,0.9)" />
                        </View>
                    )}
                </View>
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: firstStatus?.backgroundColor || (isDark ? '#1e1e1e' : '#0f6e63') }]}>
                    {mediaType === 'text' && !!firstStatus?.content && (
                        <Text style={sc.textPreview} numberOfLines={4}>{firstStatus.content}</Text>
                    )}
                </View>
            )}

            {statuses.length > 1 ? (
                <View style={sc.typeBadge}>
                    <Text style={sc.countText}>{statuses.length}</Text>
                </View>
            ) : mediaType !== 'text' ? (
                <View style={sc.typeBadge}>
                    <Ionicons name={mediaType === 'video' ? 'videocam' : 'image'} size={11} color="#fff" />
                </View>
            ) : null}

            <View style={sc.avatarWrap}>
                <View style={[sc.ring, { borderColor: allSeen ? '#c4c4c4' : '#1296f3' }]}>
                    <Image source={{ uri: avatar }} style={sc.avatar} />
                </View>
                {isMe && (
                    <TouchableOpacity style={sc.plusBadge} onPress={onAddPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="add" size={13} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            <View style={sc.nameBox}>
                <Text style={sc.name} numberOfLines={1}>{name}</Text>
                <Text style={sc.nameSub} numberOfLines={1}>{fmtTime(firstStatus?.createdAt)}</Text>
            </View>
        </TouchableOpacity>
    );
};

const sc = StyleSheet.create({
    card: { width: 108, height: 182, borderRadius: 14, marginRight: 12, overflow: 'hidden', backgroundColor: '#eee', justifyContent: 'flex-end' },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.12)' },
    playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    typeBadge: { position: 'absolute', top: 8, right: 8, zIndex: 3, backgroundColor: 'rgba(0,0,0,0.55)', minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
    countText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    textPreview: { color: '#fff', fontSize: 13, fontWeight: '600', padding: 10, paddingTop: 58, textAlign: 'center' },

    // Avatar + plus ek hi wrapper me — pehle plus ring ke beech me aa jata tha
    avatarWrap: { position: 'absolute', top: 8, left: 8, zIndex: 4 },
    ring: { borderWidth: 2.5, borderRadius: 23, padding: 2 },
    avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ddd' },
    plusBadge: {
        position: 'absolute', right: -3, bottom: -3,
        backgroundColor: '#1296f3', width: 19, height: 19, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
    },

    nameBox: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.42)' },
    name: { color: '#fff', fontSize: 12, fontWeight: '700' },
    nameSub: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 1 },

    // "Add status" card
    addCard: { borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
    addAvatarWrap: { marginBottom: 10 },
    addAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#ddd' },
    addLabel: { fontSize: 13, fontWeight: '700' },
    addHint: { fontSize: 10, textAlign: 'center', paddingHorizontal: 8 },
});

// ─── StatusSection — main export ──────────────────────────────────────────────
const StatusSection = ({ navigation, myUserId, refreshSignal = 0 }) => {
    const { theme } = useContext(ThemeContext);
    const isDark = theme.text === '#FFFFFF';

    const [allGroups, setAllGroups] = useState([]);
    const [myGroup, setMyGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [posting, setPosting] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [showTextComposer, setShowTextComposer] = useState(false);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerStartIdx, setViewerStartIdx] = useState(0);
    // Viewer khulte waqt groups ka snapshot le lete hain — warna view karte karte
    // koi group "unviewed" se "viewed" section me chala jaye to live-filtered
    // array se index shift ho jata aur viewer galat status dikhane lagta.
    const [viewerSnapshot, setViewerSnapshot] = useState([]);

    const myProfile = useSelector((state) => state.totalappData?.user ?? null);

    const fetchStatuses = useCallback(async () => {
        try {
            setLoading(true);
            const [allRes, myRes] = await Promise.all([
                apiService({ method: 'GET', endpoint: 'status' }),
                apiService({ method: 'GET', endpoint: 'status/my' }),
            ]);
            const groups = toArr(allRes?.data?.statuses ?? allRes?.data);
            setAllGroups(groups.filter(g => g?.user?._id !== myUserId));
            const myStatuses = toArr(myRes?.data?.statuses ?? myRes?.data);
            if (myStatuses.length > 0) {
                // API is list me user sirf id deta hai, isliye apni profile
                // Redux se lete hain — warna viewer me "Unknown" dikhta tha.
                const rawUser = myStatuses[0]?.user;
                const user = typeof rawUser === 'object' && rawUser
                    ? rawUser
                    : {
                        _id: myUserId,
                        name: myProfile?.name || 'My Status',
                        profilePicture: myProfile?.profilePicture,
                    };
                setMyGroup({ user, statuses: myStatuses });
            } else {
                setMyGroup(null);
            }
        } catch (e) {
            console.error('Status fetch:', e);
        } finally {
            setLoading(false);
        }
    }, [myUserId, myProfile?.name, myProfile?.profilePicture]);

    useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

    // Screen par wapas aane par aur parent ke pull-to-refresh par dobara lao —
    // warna naya status ya seen/unseen ring stale reh jata tha.
    useFocusEffect(
        useCallback(() => { fetchStatuses(); }, [fetchStatuses])
    );

    useEffect(() => {
        if (refreshSignal) fetchStatuses();
    }, [refreshSignal, fetchStatuses]);

    const uploadStatus = async (uri, type = 'image') => {
        try {
            setUploading(true);
            setShowPicker(false);
            const isVideo = type === 'video';
            const formData = new FormData();
            await appendFile(formData, 'media', {
                uri,
                name: `status_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
                type: isVideo ? 'video/mp4' : 'image/jpeg',
            });
            formData.append('mediaType', isVideo ? 'video' : 'image');
            // Global fetch RN ke { uri } FormData part ko handle nahi karta — apiService use karo
            const apiRes = await apiService({ method: 'POST', endpoint: 'status', data: formData, isMultipart: true });
            const res = apiRes?.data;
            if (res?.success) {
                fetchStatuses();
            } else {
                Alert.alert('Error', res?.message || 'Upload failed');
            }
        } catch (e) {
            Alert.alert('Error', 'Could not upload the status. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    // Text status — server mediaType 'text' + backgroundColor ke saath rakhta hai
    const postTextStatus = async (content, backgroundColor) => {
        if (!content) return;
        try {
            setPosting(true);
            const apiRes = await apiService({
                method: 'POST',
                endpoint: 'status',
                data: { content, backgroundColor, mediaType: 'text' },
            });
            if (apiRes?.data?.success) {
                setShowTextComposer(false);
                fetchStatuses();
            } else {
                Alert.alert('Error', apiRes?.data?.message || 'Could not post the status');
            }
        } catch (e) {
            Alert.alert('Error', 'Could not post the status. Please try again.');
        } finally {
            setPosting(false);
        }
    };

    const openCamera = async () => {
        setShowPicker(false);
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission required', 'Please allow camera access'); return; }
        const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.85, videoMaxDuration: VIDEO_MAX_SECS });
        if (!res.canceled) { const a = res.assets[0]; uploadStatus(a.uri, a.type === 'video' ? 'video' : 'image'); }
    };

    const openImageGallery = async () => {
        setShowPicker(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission required', 'Please allow gallery access'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
        if (!res.canceled) uploadStatus(res.assets[0].uri, 'image');
    };

    const openVideoGallery = async () => {
        setShowPicker(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission required', 'Please allow gallery access'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, videoMaxDuration: VIDEO_MAX_SECS });
        if (!res.canceled) uploadStatus(res.assets[0].uri, 'video');
    };

    const handleDelete = (deletedId) => {
        const stripDeleted = (groups) =>
            groups.map(g => ({ ...g, statuses: g.statuses.filter(s => s._id !== deletedId) }))
                .filter(g => g.statuses.length > 0);

        if (myGroup) {
            const updated = myGroup.statuses.filter(s => s._id !== deletedId);
            setMyGroup(updated.length > 0 ? { ...myGroup, statuses: updated } : null);
        }
        setAllGroups(prev => stripDeleted(prev));
        setViewerSnapshot(prev => stripDeleted(prev));
    };

    // Status PUT .../view fire hote hi yahan bhi mark kar dete hain — isi se
    // StatusCard ki "allSeen" check turant badal jaati hai aur card "Status" se
    // "Viewed Status" section me chala jaata hai, bina fetchStatuses() call kiye.
    const markStatusViewed = useCallback((statusId) => {
        setAllGroups(prev => prev.map(g => ({
            ...g,
            statuses: g.statuses.map(s => {
                if (s._id !== statusId || isSeenByMe(s, myUserId)) return s;
                return { ...s, viewedBy: [...toArr(s.viewedBy), { user: myUserId, viewedAt: new Date().toISOString() }] };
            }),
        })));
    }, [myUserId]);

    // "Status" = kam se kam ek status abhi tak unseen; "Viewed Status" = group ke
    // saare statuses already seen — StatusCard ki ring-color logic (allSeen) ke
    // saath consistent rakha hai.
    const unviewedGroups = useMemo(
        () => allGroups.filter((g) => !toArr(g?.statuses).every((s) => isSeenByMe(s, myUserId))),
        [allGroups, myUserId]
    );
    const viewedGroups = useMemo(
        () => allGroups.filter((g) => toArr(g?.statuses).length > 0 && toArr(g?.statuses).every((s) => isSeenByMe(s, myUserId))),
        [allGroups, myUserId]
    );

    const myCardGroup = myGroup || {
        user: { _id: myUserId, name: 'My Status', profilePicture: myProfile?.profilePicture },
        statuses: [],
    };
    const unviewedWithMe = [...(myGroup ? [myGroup] : []), ...unviewedGroups];

    const openViewer = (idx, groups) => {
        setViewerSnapshot(groups);
        setViewerStartIdx(idx);
        setViewerVisible(true);
    };

    return (
        <View style={{ backgroundColor: theme.background }}>
            <View style={ss.titleRow}>
                <Text style={[ss.title, { color: isDark ? '#d0d0d0' : '#222' }]}>Status</Text>
                <TouchableOpacity
                    style={[ss.addChip, { backgroundColor: isDark ? '#0d1e2e' : '#e8f4fd' }]}
                    onPress={() => setShowPicker(true)}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add" size={15} color="#1296f3" />
                    <Text style={ss.addChipText}>Add</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator color="#1296f3" style={{ marginVertical: 20 }} />
            ) : (
                <>
                    <FlatList
                        data={unviewedGroups}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
                        keyExtractor={(item, i) => item?.user?._id || i.toString()}
                        ListHeaderComponent={
                            <StatusCard
                                group={myCardGroup}
                                isMe
                                myUserId={myUserId}
                                isDark={isDark}
                                onPress={() => (myGroup?.statuses?.length ? openViewer(0, unviewedWithMe) : setShowPicker(true))}
                                onAddPress={() => setShowPicker(true)}
                            />
                        }
                        renderItem={({ item, index }) => (
                            <StatusCard
                                group={item}
                                isMe={false}
                                myUserId={myUserId}
                                isDark={isDark}
                                onPress={() => openViewer(myGroup ? index + 1 : index, unviewedWithMe)}
                            />
                        )}
                    />
                    {/* Pehle ye line horizontal list ke andar aati thi aur card ke
                        bagal me adhoori dikhti thi — ab row ke neeche hai */}
                    {unviewedGroups.length === 0 && viewedGroups.length === 0 && (
                        <Text style={[ss.emptyText, { color: isDark ? '#555' : '#9aa5ad' }]}>
                            No recent updates from your contacts
                        </Text>
                    )}
                </>
            )}

            {/* Viewed Status — status jo maine already dekh li hain, Status ke neeche. */}
            {!loading && viewedGroups.length > 0 && (
                <>
                    <View style={ss.titleRow}>
                        <Text style={[ss.title, { color: isDark ? '#d0d0d0' : '#222' }]}>Viewed Status</Text>
                    </View>
                    <FlatList
                        data={viewedGroups}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
                        keyExtractor={(item, i) => item?.user?._id || i.toString()}
                        renderItem={({ item, index }) => (
                            <StatusCard
                                group={item}
                                isMe={false}
                                myUserId={myUserId}
                                isDark={isDark}
                                onPress={() => openViewer(index, viewedGroups)}
                            />
                        )}
                    />
                </>
            )}

            <MediaPickerSheet
                visible={showPicker}
                uploading={uploading}
                isDark={isDark}
                onClose={() => setShowPicker(false)}
                onCamera={openCamera}
                onGallery={openImageGallery}
                onVideoGallery={openVideoGallery}
                onText={() => { setShowPicker(false); setShowTextComposer(true); }}
            />
            <TextStatusComposer
                visible={showTextComposer}
                posting={posting}
                onClose={() => setShowTextComposer(false)}
                onPost={postTextStatus}
            />
            <StatusViewer
                visible={viewerVisible}
                groups={viewerSnapshot}
                startGroupIdx={viewerStartIdx}
                myUserId={myUserId}
                onClose={() => setViewerVisible(false)}
                onDelete={handleDelete}
                onViewed={markStatusViewed}
            />
        </View>
    );
};

const ss = StyleSheet.create({
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
    title: { fontSize: 16, fontWeight: '600' },
    addChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    addChipText: { color: '#1296f3', fontSize: 13, fontWeight: '600' },
    emptyText: { fontSize: 12, paddingHorizontal: 16, paddingBottom: 10 },
});

export default StatusSection;