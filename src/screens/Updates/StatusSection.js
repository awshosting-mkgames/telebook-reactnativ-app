import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useNameResolver } from '../../services/nameResolver';
import socketService from '../../services/socketService';
import { deleteStatusLocal, setOwnerMutedLocal } from '../../services/statusDb';
import { fetchRemote, flushPending, loadLocal } from '../../services/statusSync';
import {
    FALLBACK_AVATAR, STATUS_DURATION, TEXT_BGS, VIDEO_MAX_SECS, expiresIn, fmtTime, getMediaType, imgUrl,
    isSeenByMe, loadSeenIds, rememberSeen, toArr,
} from './statusUtils';
import StatusViewer from './StatusViewer';
import StatusComposer from './StatusComposer';
import { launchCameraAsync } from '../../services/cameraGuard';
// ─── MediaPickerSheet — theme-aware ──────────────────────────────────────────
const MediaPickerSheet = ({ visible, uploading, onClose, onCamera, onGallery, onVideoGallery, onText, isDark }) => {
    const { theme } = useContext(ThemeContext);
    return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={mp.overlay} activeOpacity={1} onPress={onClose}>
            <TouchableOpacity activeOpacity={1} style={[mp.sheet, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
                <View style={[mp.handle, { backgroundColor: isDark ? '#3a3a3a' : '#ddd' }]} />
                <Text style={[mp.title, { color: isDark ? '#e0e0e0' : '#222' }]}>Add Status</Text>
                {uploading ? (
                    <View style={mp.loadingBox}>
                        <ActivityIndicator size="large" color={theme.main} />
                        <Text style={[mp.loadingText, { color: isDark ? '#aaa' : '#555' }]}>Uploading...</Text>
                    </View>
                ) : (
                    <View style={mp.optionsRow}>
                        <TouchableOpacity style={mp.option} onPress={onCamera}>
                            <View style={[mp.iconBox, { backgroundColor: isDark ? '#0d1e2e' : '#f0f6ff' }]}>
                                <Ionicons name="camera-outline" size={30} color={theme.main} />
                            </View>
                            <Text style={[mp.label, { color: isDark ? '#ccc' : '#333' }]}>Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={mp.option} onPress={onGallery}>
                            <View style={[mp.iconBox, { backgroundColor: isDark ? '#0d1e2e' : '#f0f6ff' }]}>
                                <Ionicons name="image-outline" size={30} color={theme.main} />
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
};

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
    const { theme } = useContext(ThemeContext);
    const resolveName = useNameResolver();
    const statuses = toArr(group?.statuses);
    const firstStatus = statuses[0];
    const mediaType = getMediaType(firstStatus);
    const bg = mediaType === 'text' ? null : imgUrl(firstStatus?.mediaUrl);
    const avatar = imgUrl(group?.user?.profilePicture) || FALLBACK_AVATAR;
    const allSeen = statuses.length > 0 && statuses.every((st) => isSeenByMe(st, myUserId));
    const name = isMe ? 'My Status' : resolveName(group?.user).title;

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
                    <View style={[sc.plusBadge, { backgroundColor: theme.main }]}>
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
                <View style={[sc.ring, { borderColor: allSeen ? '#c4c4c4' : theme.main }]}>
                    <Image source={{ uri: avatar }} style={sc.avatar} />
                </View>
                {isMe && (
                    <TouchableOpacity style={[sc.plusBadge, { backgroundColor: theme.main }]} onPress={onAddPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
    const [statusCfg, setStatusCfg] = useState(null);       // server se limits/reactions
    const [composerAsset, setComposerAsset] = useState(null);   // upload se pehle preview+caption
    const [showTextComposer, setShowTextComposer] = useState(false);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerStartIdx, setViewerStartIdx] = useState(0);
    // Viewer khulte waqt groups ka snapshot le lete hain — warna view karte karte
    // koi group "unviewed" se "viewed" section me chala jaye to live-filtered
    // array se index shift ho jata aur viewer galat status dikhane lagta.
    const [viewerSnapshot, setViewerSnapshot] = useState([]);

    const myProfile = useSelector((state) => state.totalappData?.user ?? null);

    const hasLocal = useRef(false);
    const [offline, setOffline] = useState(false);   // server tak nahi pahunche — saved (cached) data dikh raha hai

    const myFallbackUser = useCallback(() => ({
        _id: myUserId,
        name: myProfile?.name || 'My Status',
        profilePicture: myProfile?.profilePicture,
    }), [myUserId, myProfile?.name, myProfile?.profilePicture]);

    const applyFeed = useCallback((feed) => {
        setAllGroups(toArr(feed.others));
        setMyGroup(feed.mine?.statuses?.length ? { user: feed.mine.user || myFallbackUser(), statuses: feed.mine.statuses } : null);
        if (feed.cfg) setStatusCfg(feed.cfg);
    }, [myFallbackUser]);

    // Screen → SQL (turant) → API → SQL → UI. Cache hone par loader nahi; API fail (offline) par cache hi dikhta rehta hai.
    const fetchStatuses = useCallback(async (quiet = false) => {
        try {
            await loadSeenIds();
            if (!hasLocal.current) {
                const local = await loadLocal(myUserId);
                if (local.others.length || local.mine) { hasLocal.current = true; applyFeed(local); setLoading(false); }
            }
            if (quiet !== true && !hasLocal.current) setLoading(true);
            const remote = await fetchRemote(myUserId, myFallbackUser());
            if (remote) {
                hasLocal.current = true;
                setOffline(false);
                applyFeed(remote);
                flushPending();   // offline me jama views/reactions ab bhej do
            } else {
                setOffline(true);
            }
        } catch (e) {
            console.error('Status fetch:', e);
            setOffline(true);
        } finally {
            setLoading(false);
        }
    }, [myUserId, myFallbackUser, applyFeed]);

    useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

    // Screen par wapas aane par aur parent ke pull-to-refresh par dobara lao —
    // warna naya status ya seen/unseen ring stale reh jata tha.
    useFocusEffect(
        useCallback(() => { fetchStatuses(); }, [fetchStatuses])
    );

    // Live: koi status delete / view / reaction hua → quietly taaza (list me loader nahi)
    useEffect(() => {
        const refresh = () => fetchStatuses(true);
        const events = ['status-deleted', 'status-viewed', 'status-reaction'];
        events.forEach((e) => socketService.on(e, refresh));
        return () => events.forEach((e) => socketService.off(e, refresh));
    }, [fetchStatuses]);

    // 24h expiry: server list me expire hue status nahi deta; screen khuli rahe to bhi har minute purane hata do
    useEffect(() => {
        const prune = () => {
            const alive = (st) => !st?.expiresAt || new Date(st.expiresAt) > new Date();
            const strip = (groups) => groups.map((g) => ({ ...g, statuses: toArr(g.statuses).filter(alive) })).filter((g) => g.statuses.length);
            setAllGroups((prev) => (prev.some((g) => toArr(g.statuses).some((st) => !alive(st))) ? strip(prev) : prev));
            setMyGroup((prev) => {
                if (!prev || !toArr(prev.statuses).some((st) => !alive(st))) return prev;
                const left = toArr(prev.statuses).filter(alive);
                return left.length ? { ...prev, statuses: left } : null;
            });
        };
        const t = setInterval(prune, 60000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (refreshSignal) fetchStatuses();
    }, [refreshSignal, fetchStatuses]);

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

    // Picker se asset aaya → seedha upload nahi; pehle preview + caption (StatusComposer)
    const toComposer = (a) => {
        if (!a) return;
        const isVid = a.type === 'video';
        setComposerAsset({
            uri: a.uri, type: isVid ? 'video' : 'image', mimeType: a.mimeType,
            duration: isVid ? (Number(a.duration) || 0) / 1000 : 0,   // picker ms deta hai
            fileSize: a.fileSize,
        });
    };
    const maxSecs = Number(statusCfg?.maxVideoSeconds) || VIDEO_MAX_SECS;

    const openCamera = async () => {
        setShowPicker(false);
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission required', 'Please allow camera access'); return; }
        const res = await launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.85, videoMaxDuration: maxSecs });
        if (!res.canceled) toComposer(res.assets[0]);
    };

    const openImageGallery = async () => {
        setShowPicker(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission required', 'Please allow gallery access'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
        if (!res.canceled) toComposer(res.assets[0]);
    };

    const openVideoGallery = async () => {
        setShowPicker(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission required', 'Please allow gallery access'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: maxSecs });
        if (!res.canceled) toComposer(res.assets[0]);
    };

    const handleDelete = (deletedId) => {
        deleteStatusLocal(deletedId).catch(() => {});
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
        rememberSeen(String(statusId));
        setAllGroups(prev => prev.map(g => ({
            ...g,
            statuses: g.statuses.map(s => {
                if (s._id !== statusId || isSeenByMe(s, myUserId)) return s;
                return { ...s, viewedBy: [...toArr(s.viewedBy), { user: myUserId, viewedAt: new Date().toISOString() }] };
            }),
        })));
    }, [myUserId]);

    // Mute/unmute (viewer se) — list turant badle, server pehle hi save kar chuka
    const handleMuteChange = (uid, muted) => {
        setOwnerMutedLocal(uid, muted).catch(() => {});
        const patch = (groups) => groups.map((g) => (String(g?.user?._id) === String(uid) ? { ...g, muted } : g));
        setAllGroups((prev) => patch(prev));
        setViewerSnapshot((prev) => patch(prev));
    };

    // "Status" = kam se kam ek status abhi tak unseen; "Viewed Status" = group ke
    // saare statuses already seen — StatusCard ki ring-color logic (allSeen) ke
    // saath consistent rakha hai.
    const mutedGroups = useMemo(() => allGroups.filter((g) => g?.muted), [allGroups]);
    const unviewedGroups = useMemo(
        () => allGroups.filter((g) => !g?.muted && !toArr(g?.statuses).every((s) => isSeenByMe(s, myUserId))),
        [allGroups, myUserId]
    );
    const viewedGroups = useMemo(
        () => allGroups.filter((g) => !g?.muted && toArr(g?.statuses).length > 0 && toArr(g?.statuses).every((s) => isSeenByMe(s, myUserId))),
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
                <Text style={[ss.title, { color: isDark ? '#d0d0d0' : '#222' }]}>Recent updates</Text>
                <TouchableOpacity
                    onPress={() => navigation?.navigate?.('StatusPrivacy')}
                    hitSlop={8}
                    style={{ marginLeft: 'auto', marginRight: 10 }}
                >
                    <Ionicons name="lock-closed-outline" size={19} color={isDark ? '#9aa0a6' : '#667'} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[ss.addChip, { backgroundColor: isDark ? '#0d1e2e' : '#e8f4fd' }]}
                    onPress={() => setShowPicker(true)}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add" size={15} color={theme.main} />
                    <Text style={[ss.addChipText, { color: theme.main }]}>Add</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator color={theme.main} style={{ marginVertical: 20 }} />
            ) : (
                <>
                    {offline && (
                        <Text style={[ss.myInfo, { color: '#e67e22' }]}>Offline — showing saved updates</Text>
                    )}
                    {!!myGroup?.statuses?.length && (
                        <Text style={[ss.myInfo, { color: isDark ? '#9aa0a6' : '#667' }]}>
                            My status: {myGroup.statuses.length} active
                            {myGroup.statuses.every((x) => x.viewCount == null) ? '' : ` · ${myGroup.statuses.reduce((n, x) => n + (x.viewCount || 0), 0)} views`}
                            {' · last '}{fmtTime(myGroup.statuses[myGroup.statuses.length - 1]?.createdAt)}
                        </Text>
                    )}
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
                        <Text style={[ss.title, { color: isDark ? '#d0d0d0' : '#222' }]}>Viewed updates</Text>
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

            {/* Muted updates — mute kiye hue contacts; yahan se dekhne par bhi viewed tabhi mark hota hai jab asli me khule */}
            {!loading && mutedGroups.length > 0 && (
                <>
                    <View style={ss.titleRow}>
                        <Text style={[ss.title, { color: isDark ? '#d0d0d0' : '#222' }]}>Muted updates</Text>
                    </View>
                    <FlatList
                        data={mutedGroups}
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
                                onPress={() => openViewer(index, mutedGroups)}
                            />
                        )}
                    />
                </>
            )}

            <MediaPickerSheet
                visible={showPicker}
                uploading={false}
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
            <StatusComposer
                visible={!!composerAsset}
                asset={composerAsset}
                cfg={statusCfg}
                onClose={() => setComposerAsset(null)}
                onDone={() => fetchStatuses(true)}
            />
            <StatusViewer
                visible={viewerVisible}
                groups={viewerSnapshot}
                startGroupIdx={viewerStartIdx}
                myUserId={myUserId}
                cfg={statusCfg}
                navigation={navigation}
                onClose={() => { setViewerVisible(false); fetchStatuses(true); }}
                onDelete={handleDelete}
                onViewed={markStatusViewed}
                onMuteChange={handleMuteChange}
            />
        </View>
    );
};

const ss = StyleSheet.create({
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
    title: { fontSize: 16, fontWeight: '600' },
    addChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    addChipText: { color: '#1296f3', fontSize: 13, fontWeight: '600' },
    myInfo: { fontSize: 12, paddingHorizontal: 16, paddingBottom: 8 },
    emptyText: { fontSize: 12, paddingHorizontal: 16, paddingBottom: 10 },
});

export default StatusSection;