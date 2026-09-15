import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    Modal,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import Config from '../../services/config';
import { appendFile } from '../../utils/uploadFile';
const BASE_URL = Config.Main_url;

const STATUS_DURATION = 5000;
const VIDEO_MAX_SECS = 30;
const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const toArr = (v) => (Array.isArray(v) ? v : []);
const imgUrl = (p) => {
    if (!p) return null;
    if (p.startsWith('http')) return p;
    return `${BASE_URL?.MEDIA_URL}${p}`.replace(/([^:])\/\//g, '$1/');
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
const StatusViewer = ({ visible, groups, startGroupIdx = 0, myUserId, onClose, onDelete }) => {
    const [groupIdx, setGroupIdx] = useState(startGroupIdx);
    const [statusIdx, setStatusIdx] = useState(0);
    const [videoDone, setVideoDone] = useState(false);
    const progress = useRef(new Animated.Value(0)).current;
    const anim = useRef(null);

    const currentGroup = groups[groupIdx];
    const currentStatus = currentGroup?.statuses?.[statusIdx];
    const totalInGroup = currentGroup?.statuses?.length ?? 0;
    const isMine = currentGroup?.user === myUserId;
    const mediaType = getMediaType(currentStatus);
    const mediaUrl = imgUrl(currentStatus?.mediaUrl);

    const player = useVideoPlayer(null, (p) => {
        p.loop = false;
        p.timeUpdateEventInterval = 0.5;
    });

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
    }, [visible, currentStatus?._id]);

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
        Alert.alert('Delete Status', 'Is status ko delete karo?', [
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
                        Alert.alert('Error', 'Delete nahi hua');
                    }
                },
            },
        ]);
    };

    if (!visible || !currentGroup) return null;

    const userName = currentGroup?.user?.name || 'Unknown';
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
                {!!currentStatus?.content && mediaType !== 'text' && (
                    <View style={vs.captionBox}>
                        <Text style={vs.caption}>{currentStatus.content}</Text>
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
    captionBox: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.45)' },
    caption: { color: '#fff', fontSize: 14 },
    tapRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5 },
    tapHalf: { flex: 1, height: '100%' },
});

// ─── MediaPickerSheet — theme-aware ──────────────────────────────────────────
const MediaPickerSheet = ({ visible, uploading, onClose, onCamera, onGallery, onVideoGallery, isDark }) => (
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
    optionsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
    option: { alignItems: 'center', gap: 10 },
    iconBox: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 13, fontWeight: '600' },
    loadingBox: { alignItems: 'center', paddingVertical: 32, gap: 12 },
    loadingText: { fontSize: 14 },
    cancelBtn: { padding: 14, borderRadius: 16, alignItems: 'center' },
    cancelText: { fontSize: 15, fontWeight: '600' },
});

// ─── StatusCard ───────────────────────────────────────────────────────────────
const StatusCard = ({ group, isMe, onPress, onAddPress, isDark }) => {
    const firstStatus = group?.statuses?.[0];
    const mediaType = getMediaType(firstStatus);
    const bg = imgUrl(firstStatus?.mediaUrl);
    const avatar = imgUrl(group?.user?.profilePicture) || FALLBACK_AVATAR;
    const allSeen = group?.statuses?.every(s => s?.seen);
    const name = isMe ? 'My Status' : (group?.user?.name || 'Unknown');

    return (
        <TouchableOpacity style={sc.card} onPress={onPress} activeOpacity={0.85}>
            {bg ? (
                <View style={StyleSheet.absoluteFill}>
                    <Image source={{ uri: bg }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    {mediaType === 'video' && (
                        <View style={sc.playOverlay}>
                            <Ionicons name="play-circle" size={38} color="rgba(255,255,255,0.9)" />
                        </View>
                    )}
                </View>
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: isMe ? (isDark ? '#2a2a2a' : '#dedede') : (isDark ? '#1e1e1e' : '#f0f0f0') }]} />
            )}
            {firstStatus && mediaType !== 'text' && (
                <View style={sc.typeBadge}>
                    <Ionicons name={mediaType === 'video' ? 'videocam' : 'image'} size={11} color="#fff" />
                </View>
            )}
            {isMe ? (
                <>
                    <TouchableOpacity onPress={onAddPress} style={[sc.ring, { borderColor: allSeen ? '#aaa' : '#1296f3' }]}>
                        <Image source={{ uri: avatar }} style={sc.avatar} />
                    </TouchableOpacity>
                    <TouchableOpacity style={sc.plusBtn} onPress={onAddPress}>
                        <Ionicons name="add" size={13} color="#fff" />
                    </TouchableOpacity>
                </>
            ) : (
                <View style={[sc.ring, { borderColor: allSeen ? '#aaa' : '#1296f3' }]}>
                    <Image source={{ uri: avatar }} style={sc.avatar} />
                </View>
            )}
            <View style={sc.nameBox}>
                <Text style={sc.name} numberOfLines={1}>{name}</Text>
            </View>
        </TouchableOpacity>
    );
};

const sc = StyleSheet.create({
    card: { width: 108, height: 182, borderRadius: 14, marginRight: 12, overflow: 'hidden', backgroundColor: '#eee', justifyContent: 'flex-end' },
    playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    typeBadge: { position: 'absolute', top: 8, right: 8, zIndex: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 4 },
    ring: { position: 'absolute', top: 8, left: 8, borderWidth: 2.5, borderRadius: 22, padding: 2 },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    plusBtn: { position: 'absolute', top: 32, left: 30, backgroundColor: '#1296f3', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
    nameBox: { padding: 8, paddingTop: 4, backgroundColor: 'rgba(0,0,0,0.32)' },
    name: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

// ─── StatusSection — main export ──────────────────────────────────────────────
const StatusSection = ({ navigation, myUserId }) => {
    const { theme } = useContext(ThemeContext);
    const isDark = theme.text === '#FFFFFF';

    const [allGroups, setAllGroups] = useState([]);
    const [myGroup, setMyGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerStartIdx, setViewerStartIdx] = useState(0);

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
                const firstUser = myStatuses[0]?.user || { _id: myUserId };
                setMyGroup({ user: firstUser, statuses: myStatuses });
            } else {
                setMyGroup(null);
            }
        } catch (e) {
            console.error('Status fetch:', e);
        } finally {
            setLoading(false);
        }
    }, [myUserId]);

    useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

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
                Alert.alert('✅ Done', `${isVideo ? 'Video' : 'Photo'} status upload ho gaya!`);
                fetchStatuses();
            } else {
                Alert.alert('Error', res?.message || 'Upload failed');
            }
        } catch (e) {
            Alert.alert('Error', 'Status upload nahi hua, dobara try karo');
        } finally {
            setUploading(false);
        }
    };

    const openCamera = async () => {
        setShowPicker(false);
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission chahiye', 'Camera allow karo'); return; }
        const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.85, videoMaxDuration: VIDEO_MAX_SECS });
        if (!res.canceled) { const a = res.assets[0]; uploadStatus(a.uri, a.type === 'video' ? 'video' : 'image'); }
    };

    const openImageGallery = async () => {
        setShowPicker(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission chahiye', 'Gallery allow karo'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
        if (!res.canceled) uploadStatus(res.assets[0].uri, 'image');
    };

    const openVideoGallery = async () => {
        setShowPicker(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission chahiye', 'Gallery allow karo'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, videoMaxDuration: VIDEO_MAX_SECS });
        if (!res.canceled) uploadStatus(res.assets[0].uri, 'video');
    };

    const handleDelete = (deletedId) => {
        if (myGroup) {
            const updated = myGroup.statuses.filter(s => s._id !== deletedId);
            setMyGroup(updated.length > 0 ? { ...myGroup, statuses: updated } : null);
        }
        setAllGroups(prev =>
            prev.map(g => ({ ...g, statuses: g.statuses.filter(s => s._id !== deletedId) }))
                .filter(g => g.statuses.length > 0)
        );
    };

    const openViewer = (idx) => { setViewerStartIdx(idx); setViewerVisible(true); };
    const viewerGroups = [...(myGroup ? [myGroup] : []), ...allGroups];

    return (
        <View style={{ backgroundColor: theme.background }}>
            <Text style={[ss.title, { color: isDark ? '#d0d0d0' : '#222' }]}>Status</Text>
            {loading ? (
                <ActivityIndicator color="#1296f3" style={{ marginVertical: 20 }} />
            ) : (
                <FlatList
                    data={allGroups}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
                    keyExtractor={(item, i) => item?.user?._id || i.toString()}
                    ListHeaderComponent={
                        <StatusCard
                            group={myGroup || { user: { name: 'My Status' }, statuses: [] }}
                            isMe={true}
                            isDark={isDark}
                            onPress={() => myGroup?.statuses?.length ? openViewer(0) : setShowPicker(true)}
                            onAddPress={() => setShowPicker(true)}
                        />
                    }
                    renderItem={({ item, index }) => (
                        <StatusCard
                            group={item}
                            isMe={false}
                            isDark={isDark}
                            onPress={() => openViewer(myGroup ? index + 1 : index)}
                        />
                    )}
                    ListEmptyComponent={
                        <View style={ss.empty}>
                            <Ionicons name="radio-button-off-outline" size={28} color={isDark ? '#444' : '#ccc'} />
                            <Text style={[ss.emptyText, { color: isDark ? '#555' : '#aaa' }]}>Koi status nahi abhi</Text>
                        </View>
                    }
                />
            )}
            <MediaPickerSheet
                visible={showPicker}
                uploading={uploading}
                isDark={isDark}
                onClose={() => setShowPicker(false)}
                onCamera={openCamera}
                onGallery={openImageGallery}
                onVideoGallery={openVideoGallery}
            />
            <StatusViewer
                visible={viewerVisible}
                groups={viewerGroups}
                startGroupIdx={viewerStartIdx}
                myUserId={myUserId}
                onClose={() => setViewerVisible(false)}
                onDelete={handleDelete}
            />
        </View>
    );
};

const ss = StyleSheet.create({
    title: { fontSize: 16, fontWeight: '600', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
    empty: { paddingLeft: 12, alignItems: 'center', paddingVertical: 20, gap: 6 },
    emptyText: { fontSize: 13 },
});

export default StatusSection;