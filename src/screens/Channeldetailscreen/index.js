import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { requestLibraryPermission, saveRemoteFileToDevice, saveToLibrary } from '../../utils/mediaSave';
import * as Sharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';

import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import Config from '../../services/config';
const BASE_URL = Config.Main_url;
const STORAGE_KEY = 'DOWNLOAD_DIR_URI';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W - 24;


const PALETTES = {
    dark: {
        bg: '#0D1117',
        card: '#161D27',
        cardBorder: '#1E2A38',
        topBar: '#0A1628',
        topBarBorder: '#1E2A38',
        accent: '#1A8CFF',
        textPrimary: '#E2E8F0',
        textMuted: '#6B7685',
        textDesc: '#A0AEC0',
        waveBar: '#2E3A4A',
        emptyIcon: '#2E3A4A',
        audioBg: '#161D27',
        imgBg: '#161D27',
        dot: 'rgba(255,255,255,0.25)',
        dotActive: '#1A8CFF',
        statusBar: 'light-content',
        statusBg: '#0A1628',
    },
    light: {
        bg: '#F5F6F8',
        card: '#FFFFFF',
        cardBorder: '#E8ECF0',
        topBar: '#1296f3',
        topBarBorder: 'transparent',
        accent: '#1296f3',
        textPrimary: '#1A1A2E',
        textMuted: '#888FA8',
        textDesc: '#555770',
        waveBar: '#D1D9E6',
        emptyIcon: '#C8CDD8',
        audioBg: '#F0F4FF',
        imgBg: '#F0F0F0',
        dot: 'rgba(0,0,0,0.18)',
        dotActive: '#1296f3',
        statusBar: 'light-content',
        statusBg: '#1296f3',
    },
};

/* ─── Helpers ─────────────────────────────────────────── */
const getImageUrl = (path) => `${Config.MEDIA_URL}${path}`;

const formatTime = (ms) => {
    if (!ms) return '0:00';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const formatCount = (n) => {
    if (!n && n !== 0) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString();
};

const isVideo = (att) => (att?.fileType || '').startsWith('video') || (att?.url || '').match(/\.(mp4|mov|webm|avi)$/i);
const isAudio = (att) => (att?.fileType || '').startsWith('audio') || (att?.url || '').match(/\.(mp3|wav|aac|ogg|m4a)$/i);


const handleMediaDownload = async (url, filename, type) => {
    try {


        const extFromUrl = url.split('.').pop()?.split('?')[0];
        const ext =
            extFromUrl ||
            (type === 'video' ? 'mp4' : type === 'image' ? 'jpg' : 'file');

        const fileName = `${filename}_${Date.now()}.${ext}`;

        // Web: let the browser download it. No-op (false) on native.
        if (await saveRemoteFileToDevice(url, fileName)) return;

        const tempFileUri = FileSystem.cacheDirectory + fileName;


        const downloadRes = await FileSystem.downloadAsync(url, tempFileUri);


        if (FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
            let directoryUri = await AsyncStorage.getItem(STORAGE_KEY);

            if (!directoryUri) {
                const permissions =
                    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

                if (!permissions.granted) {
                    Alert.alert("Permission Required", "Please select a folder.");
                    return;
                }

                directoryUri = permissions.directoryUri;
                await AsyncStorage.setItem(STORAGE_KEY, directoryUri);
            }


            const mimeType =
                type === 'video'
                    ? 'video/mp4'
                    : type === 'image'
                        ? 'image/jpeg'
                        : 'application/octet-stream';


            const fileUri =
                await FileSystem.StorageAccessFramework.createFileAsync(
                    directoryUri,
                    fileName,
                    mimeType
                );

            // 📤 Write file
            const fileData = await FileSystem.readAsStringAsync(downloadRes.uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            await FileSystem.StorageAccessFramework.writeAsStringAsync(
                fileUri,
                fileData,
                { encoding: FileSystem.EncodingType.Base64 }
            );

            Alert.alert("Success ✅", "Downloaded successfully");

        } else {

            if (type === 'image' || type === 'video') {
                if (!(await requestLibraryPermission())) {
                    Alert.alert("Permission Required", "Allow gallery access");
                    return;
                }

                await saveToLibrary(downloadRes.uri);

                Alert.alert("Success ✅", "Saved to gallery");
            } else {
                // 📤 Share other files
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(downloadRes.uri);
                } else {
                    Alert.alert("Error", "Sharing not available");
                }
            }
        }
    } catch (error) {
        console.error("Download Error:", error);

        // ⚠️ Reset broken directory
        await AsyncStorage.removeItem(STORAGE_KEY);

        Alert.alert("Error", "Download failed. Try again.");
    } finally {

    }
};

/* ─── Modals (Zoom & Video) ───────────────────────────── */
function ZoomSliderModal({ visible, attachments, startIndex = 0, onClose }) {
    const [activeIdx, setActiveIdx] = useState(startIndex);
    const [dlLoading, setDlLoading] = useState(false);
    const flatRef = useRef(null);

    useEffect(() => {
        if (visible) {
            setActiveIdx(startIndex);
            setTimeout(() => flatRef.current?.scrollToIndex({ index: startIndex, animated: false }), 100);
        }
    }, [visible, startIndex]);

    const current = attachments?.[activeIdx];
    const type = isVideo(current) ? 'video' : isAudio(current) ? 'audio' : 'image';

    const onDownload = async () => {
        setDlLoading(true);
        const url = getImageUrl(current?.url || current);
        await handleMediaDownload(url, current?.filename || `file_${activeIdx}`, type);
        setDlLoading(false);
    };

    const renderZoomSlide = ({ item }) => {
        const uri = getImageUrl(item?.url || item);
        if (isVideo(item)) return <View style={zs.slide}><VideoSlide uri={uri} fullscreen={true} /></View>;
        if (isAudio(item)) return <View style={zs.slide}><AudioSlide uri={uri} fullscreen={true} pal={PALETTES.dark} /></View>;
        return (
            <View style={zs.slide}>
                <ScrollView maximumZoomScale={6} minimumZoomScale={1} centerContent>
                    <Image source={{ uri }} style={zs.zoomImg} resizeMode="contain" />
                </ScrollView>
            </View>
        );
    };

    return (
        <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <StatusBar backgroundColor="#000" barStyle="light-content" />
            <View style={zs.container}>
                <View style={zs.topBar}>
                    <TouchableOpacity onPress={onClose} style={zs.headerBtn}><Ionicons name="close" size={26} color="#fff" /></TouchableOpacity>
                    <Text style={zs.counterText}>{activeIdx + 1} / {attachments?.length}</Text>
                    <TouchableOpacity onPress={onDownload} style={[zs.headerBtn, { backgroundColor: '#1A8CFF' }]}>
                        {dlLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={22} color="#fff" />}
                    </TouchableOpacity>
                </View>
                <FlatList
                    ref={flatRef}
                    data={attachments}
                    renderItem={renderZoomSlide}
                    keyExtractor={(_, i) => `z-${i}`}
                    horizontal pagingEnabled
                    onScroll={e => setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
                    getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
                />
            </View>
        </Modal>
    );
}

function VideoZoomModal({ visible, uri, onClose }) {
    const [dlLoading, setDlLoading] = useState(false);

    const player = useVideoPlayer(uri || null, (p) => {
        p.loop = false;
    });

    // Keep the player's source in sync with whichever attachment was tapped
    useEffect(() => {
        if (uri) {
            player.replace(uri);
        }
    }, [uri]);

    useEffect(() => {
        if (visible) {
            player.play();
        } else {
            player.pause();
        }
    }, [visible]);

    return (
        <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <StatusBar backgroundColor="#000" barStyle="light-content" />
            <View style={videoModal.container}>
                <View style={videoModal.topBar}>
                    <TouchableOpacity onPress={onClose} style={videoModal.headerBtn}><Ionicons name="close" size={26} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity
                        onPress={async () => { setDlLoading(true); await handleMediaDownload(uri, "video.mp4", 'video'); setDlLoading(false); }}
                        style={[videoModal.headerBtn, { backgroundColor: '#1A8CFF' }]}
                    >
                        {dlLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={22} color="#fff" />}
                    </TouchableOpacity>
                </View>
                <VideoView
                    player={player}
                    style={videoModal.video}
                    nativeControls
                    contentFit="contain"
                    allowsFullscreen
                    allowsPictureInPicture
                />
            </View>
        </Modal>
    );
}

/* ─── Media Types Components ─────────────────────────── */
function VideoSlide({ uri, fullscreen }) {
    const [playing, setPlaying] = useState(false);
    const w = fullscreen ? SCREEN_W : CARD_W - 25;

    const player = useVideoPlayer(uri, (p) => {
        p.loop = false;
    });

    useEffect(() => {
        const sub = player.addListener('playingChange', ({ isPlaying }) => {
            setPlaying(isPlaying);
        });
        return () => sub.remove();
    }, [player]);

    return (
        <TouchableWithoutFeedback onPress={() => { playing ? player.pause() : player.play(); }}>
            <View style={[vs.container, { width: w, height: w }]}>
                <VideoView
                    player={player}
                    style={vs.video}
                    contentFit="contain"
                    nativeControls={false}
                    allowsFullscreen={fullscreen}
                />
                {!playing && !fullscreen && (
                    <View style={vs.playOverlay}><View style={vs.playCircle}><Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} /></View></View>
                )}
            </View>
        </TouchableWithoutFeedback>
    );
}

function AudioSlide({ uri, fullscreen, pal }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [position, setPosition] = useState(0); // seconds
    const [duration, setDuration] = useState(0); // seconds

    const player = useVideoPlayer(uri, (p) => {
        p.loop = false;
        p.timeUpdateEventInterval = 0.5;
    });

    useEffect(() => {
        const playingSub = player.addListener('playingChange', ({ isPlaying }) => setIsPlaying(isPlaying));
        const timeSub = player.addListener('timeUpdate', ({ currentTime }) => {
            setPosition(currentTime);
            if (player.duration) setDuration(player.duration);
        });
        return () => {
            playingSub.remove();
            timeSub.remove();
        };
    }, [player]);

    const progress = duration > 0 ? position / duration : 0;

    return (
        <View style={[au.container, { backgroundColor: pal.audioBg, borderColor: pal.cardBorder }, fullscreen && au.fullscreen]}>
            <View style={au.waveRow}>
                {Array.from({ length: 25 }).map((_, i) => (
                    <View key={i} style={[au.bar, { height: 10 + Math.random() * 20, backgroundColor: (i / 25 < progress) ? pal.accent : pal.waveBar }]} />
                ))}
            </View>
            <View style={au.controls}>
                <TouchableOpacity onPress={() => isPlaying ? player.pause() : player.play()} style={[au.playBtn, { backgroundColor: pal.accent }]}>
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={[au.timeText, { color: pal.textMuted }]}>{formatTime(position * 1000)} / {formatTime(duration * 1000)}</Text>
            </View>
        </View>
    );
}

function MediaSlider({ attachments, onOpenZoom, onOpenVideoZoom, pal }) {
    const [activeIdx, setActiveIdx] = useState(0);
    if (!attachments?.length) return null;
    const current = attachments[activeIdx];

    return (
        <View style={sl.wrapper}>
            <FlatList
                data={attachments}
                keyExtractor={(_, i) => String(i)}
                horizontal pagingEnabled
                onScroll={e => setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / CARD_W))}
                renderItem={({ item, index }) => {
                    const uri = getImageUrl(item?.url || item);
                    if (isAudio(item)) return <TouchableOpacity onPress={() => onOpenZoom(index)}><AudioSlide uri={uri} pal={pal} /></TouchableOpacity>;
                    if (isVideo(item)) return <TouchableOpacity onPress={() => onOpenVideoZoom(index)}><VideoSlide uri={uri} /><View style={sl.expandIcon}><Ionicons name="expand" size={14} color="#fff" /></View></TouchableOpacity>;
                    return (
                        <TouchableOpacity onPress={() => onOpenZoom(index)}>
                            <Image source={{ uri }} style={[sl.img, { backgroundColor: pal.imgBg, width: CARD_W - 26 }]} resizeMode="cover" />
                            <View style={sl.expandIcon}><Ionicons name="expand" size={14} color="#fff" /></View>
                        </TouchableOpacity>
                    );
                }}
            />
            <View style={sl.badge}>
                <Text style={sl.badgeText}>{attachments.length > 1 ? `${activeIdx + 1}/${attachments.length}` : 'Media'}</Text>
            </View>
        </View>
    );
}

const MessageBubble = ({ item, pal }) => {
    const attachments = item?.attachments ?? [];
    const [zoomOpen, setZoomOpen] = useState(false);
    const [videoZoomOpen, setVideoZoomOpen] = useState(false);
    const [zoomStart, setZoomStart] = useState(0);
    const [currentVideoUri, setCurrentVideoUri] = useState('');

    return (
        <View style={[mb.wrap, { backgroundColor: pal.card, borderColor: pal.cardBorder }]}>
            {attachments.length > 0 && (
                <>
                    <MediaSlider attachments={attachments} onOpenZoom={(i) => { setZoomStart(i); setZoomOpen(true); }} onOpenVideoZoom={(i) => { setCurrentVideoUri(getImageUrl(attachments[i]?.url || attachments[i])); setVideoZoomOpen(true); }} pal={pal} />
                    <ZoomSliderModal visible={zoomOpen} attachments={attachments} startIndex={zoomStart} onClose={() => setZoomOpen(false)} />
                    <VideoZoomModal visible={videoZoomOpen} uri={currentVideoUri} onClose={() => setVideoZoomOpen(false)} />
                </>
            )}
            {!!item?.content && <Text style={[mb.text, { color: pal.textPrimary }]}>{item.content}</Text>}
            <View style={mb.footer}><Text style={[mb.time, { color: pal.textMuted }]}>{timeAgo(item?.createdAt)}</Text></View>
        </View>
    );
};

export default function ChannelDetailScreen({ navigation, route }) {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);

    const pal = PALETTES[theme?.mode] ?? PALETTES.light;
    const { channelId } = route.params ?? {};
    const [channel, setChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [imageUri, setimageUri] = useState('');

    const [following, setFollowing] = useState(false);
    const [loadingFollow, setLoadingFollow] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const cRes = await apiService({ method: 'GET', endpoint: `channels/${channelId}` });
            const channelData = cRes?.data?.channel || cRes;
            setChannel(channelData);
            setFollowing(channelData?.isSubscribed);
            const imageUri1 = channelData.channelIcon ? `${BASE_URL?.MEDIA_URL}${channelData.channelIcon}` : 'https://api.dicebear.com/9.x/thumbs/png?seed=Community';
            setimageUri(imageUri1)

        } finally { setLoading(false); }
    }, [channelId]);
    const fetchDatatwo = useCallback(async () => {

        try {
            const mRes = await apiService({ method: 'GET', endpoint: `channels/${channelId}/messages` });
            setMessages(mRes?.messages || mRes?.data?.messages || []);
        } finally { }
    }, [channelId]);


    useEffect(() => { fetchData(); fetchDatatwo(); }, [fetchData]);

    const handleFollow = async () => {
        try {
            await apiService({
                method: 'PUT',
                endpoint: following
                    ? `channels/${channel._id}/unsubscribe`
                    : `channels/${channel._id}/subscribe`,
                data: {},
            });
            fetchData();
        } catch (e) {

        } finally {
            setLoadingFollow(false);
        }
    };

    return (
        <SafeAreaView style={[sc.container, { backgroundColor: pal.bg }]}>
            <StatusBar backgroundColor={pal.statusBg} barStyle={pal.statusBar} />
            <View style={sc.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                <View style={sc.topInfo}>
                    <View>
                        <Image source={{ uri: imageUri }} style={sc.avatar} />
                    </View>
                    <View>
                        <Text style={sc.topTitle}>{channel?.channelName || 'Channel'}</Text>
                        <Text style={sc.topSubCount}>{formatCount(channel?.subscriberCount || 0)} subscribers</Text>
                    </View>

                </View>
            </View>
            {loading ? <ActivityIndicator size="large" color={pal.accent} style={{ marginTop: 50 }} /> : (
                <FlatList
                    data={messages}
                    keyExtractor={(it, i) => it?._id || String(i)}
                    renderItem={({ item }) => <MessageBubble item={item} pal={pal} />}
                    contentContainerStyle={{ paddingBottom: 50 }}
                />
            )}
            <View style={sc.followFooter}>
                <TouchableOpacity
                    onPress={handleFollow}
                    disabled={loadingFollow}
                    style={following} >
                    <Text style={[sc.followText, { color: '#fff' }]}>
                        {following ? t('Unfollow') : t('Follow')}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}


const zs = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 15, position: 'absolute', top: 0, width: '100%', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)' },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    counterText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    slide: { width: SCREEN_W, height: SCREEN_H, justifyContent: 'center' },
    zoomImg: { width: SCREEN_W, height: SCREEN_H },
});

const videoModal = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
    topBar: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 20 },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    video: { width: SCREEN_W, height: SCREEN_H * 0.8 },
});

const vs = StyleSheet.create({
    container: { backgroundColor: '#000', borderRadius: 10, overflow: 'hidden' },
    video: { width: '100%', height: '100%' },
    playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
    playCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(18,150,243,0.9)', justifyContent: 'center', alignItems: 'center' },
});

const au = StyleSheet.create({
    container: { borderRadius: 12, padding: 15, width: CARD_W - 25, borderWidth: 1 },
    fullscreen: { width: SCREEN_W * 0.9, alignSelf: 'center' },
    waveRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 12, height: 40 },
    bar: { width: 4, borderRadius: 2 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    playBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    timeText: { fontSize: 13, fontWeight: '600' },
});

const sl = StyleSheet.create({
    wrapper: { marginBottom: 10 },
    img: { height: 230, borderRadius: 12 },
    badge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    expandIcon: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, padding: 6 },
});

const mb = StyleSheet.create({
    wrap: { marginHorizontal: 12, marginVertical: 6, borderRadius: 15, padding: 12, borderWidth: 1 },
    text: { fontSize: 15, lineHeight: 22 },
    footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
    time: { fontSize: 11 },
});

const sc = StyleSheet.create({
    container: { flex: 1 },
    topBar: { flexDirection: 'row', alignItems: 'center', padding: 15, paddingTop: 45, backgroundColor: "#1296f3" },
    topInfo: { marginLeft: 15, flexDirection: "row", gap: 10 },
    topTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    topSubCount: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    followFooter: { position: "absolute", bottom: 50, right: 20, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: "#1296f3", borderRadius: 25, borderBottomWidth: StyleSheet.hairlineWidth },
    followBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, alignItems: 'center', justifyContent: 'center', minWidth: 90 },
    followText: { fontSize: 13, fontWeight: '700' },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
    },
});