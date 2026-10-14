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
    Platform,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeContext } from '../../components/ThemeContext';
import { claimPlayback, useExclusivePlayback } from '../../utils/playbackManager';
import apiService from '../../services/apiService';
import Config from '../../services/config';
const STORAGE_KEY = 'DOWNLOAD_DIR_URI';
const HIT = { top: 10, bottom: 10, left: 10, right: 10 };
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W - 24;
// Media ki width = slider ki page width, warna multi-media post me slide adhi ruk jati thi
const MEDIA_W = CARD_W - 26;
// Feed me media ka box — pehle video square (w x w) tha, isliye portrait video ke
// upar-neeche bahut kaali jagah bachti thi
const MEDIA_H = Math.round(MEDIA_W * 0.78);


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

    useExclusivePlayback(player);

    // Keep the player's source in sync with whichever attachment was tapped
    useEffect(() => {
        if (uri) {
            player.replace(uri);
        }
    }, [uri]);

    useEffect(() => {
        if (visible) {
            claimPlayback(player);
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
function VideoSlide({ uri, fullscreen, onPlayingChange }) {
    const [playing, setPlaying] = useState(false);
    const w = fullscreen ? SCREEN_W : MEDIA_W;
    const h = fullscreen ? SCREEN_H : MEDIA_H;

    const player = useVideoPlayer(uri, (p) => {
        p.loop = false;
    });

    useExclusivePlayback(player);

    useEffect(() => {
        const sub = player.addListener('playingChange', ({ isPlaying }) => {
            setPlaying(isPlaying);
            onPlayingChange?.(isPlaying);
        });
        return () => sub.remove();
    }, [player, onPlayingChange]);

    return (
        <TouchableWithoutFeedback onPress={() => {
            if (playing) { player.pause(); return; }
            claimPlayback(player);
            player.play();
        }}>
            <View style={[vs.container, { width: w, height: h }]}>
                <VideoView
                    player={player}
                    style={vs.video}
                    contentFit="contain"
                    nativeControls={false}
                    allowsFullscreen={fullscreen}
                    // Android par default SurfaceView RN ke views ke upar draw hota hai,
                    // isliye play button video ke peeche chala jata tha
                    surfaceType={Platform.OS === 'android' && !fullscreen ? 'textureView' : 'surfaceView'}
                />
                {/* Play button ab caller (FeedVideo) render karta hai — Android par
                    video surface apne bheetar ke overlay ko dhak leta hai */}
                {!playing && !fullscreen && !onPlayingChange && (
                    <View style={vs.playOverlay}>
                        <View style={vs.playCircle}>
                            <Ionicons name="play" size={26} color="#fff" style={{ marginLeft: 3 }} />
                        </View>
                    </View>
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

    useExclusivePlayback(player);

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
                <TouchableOpacity
                    onPress={() => {
                        if (isPlaying) { player.pause(); return; }
                        claimPlayback(player);
                        player.play();
                    }}
                    style={[au.playBtn, { backgroundColor: pal.accent }]}
                >
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={[au.timeText, { color: pal.textMuted }]}>{formatTime(position * 1000)} / {formatTime(duration * 1000)}</Text>
            </View>
        </View>
    );
}

// Feed ka video: play button aur expand dono video ke bahar sibling hain,
// warna Android par video surface unhe dhak leta hai
function FeedVideo({ uri, onExpand }) {
    const [playing, setPlaying] = useState(false);
    return (
        // Wrapper ki size video jitni — absolute overlay isi ke andar rahe
        <View style={{ width: MEDIA_W, height: MEDIA_H }}>
            <VideoSlide uri={uri} onPlayingChange={setPlaying} />
            {/* Android par poore size ka overlay video surface ke peeche chala jata
                hai — isliye play button chhota absolute view hai */}
            {!playing && (
                <View pointerEvents="none" style={vs.playCircleFloating}>
                    <Ionicons name="play" size={26} color="#fff" style={{ marginLeft: 3 }} />
                </View>
            )}
            <TouchableOpacity style={sl.expandIcon} onPress={onExpand} hitSlop={HIT}>
                <Ionicons name="expand" size={14} color="#fff" />
            </TouchableOpacity>
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
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={MEDIA_W}
                decelerationRate="fast"
                onScroll={e => setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / MEDIA_W))}
                scrollEventThrottle={16}
                renderItem={({ item, index }) => {
                    const uri = getImageUrl(item?.url || item);
                    if (isAudio(item)) return <TouchableOpacity onPress={() => onOpenZoom(index)}><AudioSlide uri={uri} pal={pal} /></TouchableOpacity>;
                    if (isVideo(item)) return <FeedVideo uri={uri} onExpand={() => onOpenVideoZoom(index)} />;
                    return (
                        <TouchableOpacity onPress={() => onOpenZoom(index)} activeOpacity={0.9}>
                            <Image source={{ uri }} style={[sl.img, { backgroundColor: pal.imgBg, width: MEDIA_W }]} resizeMode="cover" />
                            <View style={sl.expandIcon}><Ionicons name="expand" size={14} color="#fff" /></View>
                        </TouchableOpacity>
                    );
                }}
            />
            {attachments.length > 1 ? (
                <View style={sl.badge}>
                    <Text style={sl.badgeText}>{activeIdx + 1}/{attachments.length}</Text>
                </View>
            ) : (isVideo(current) || isAudio(current)) ? (
                <View style={sl.badge}>
                    <Ionicons name={isAudio(current) ? 'musical-notes' : 'videocam'} size={12} color="#fff" />
                </View>
            ) : null}
        </View>
    );
}

const MessageBubble = ({ item, pal }) => {
    const attachments = item?.attachments ?? [];
    const viewCount = item?.views || item?.viewedBy?.length || 0;
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
            <View style={mb.footer}>
                {/* views server ke viewedBy se — pehle post par koi stat nahi dikhti thi */}
                <Ionicons name="eye-outline" size={13} color={pal.textMuted} />
                <Text style={[mb.time, { color: pal.textMuted }]}>{formatCount(viewCount)}</Text>
                <View style={[mb.dotSep, { backgroundColor: pal.textMuted }]} />
                <Text style={[mb.time, { color: pal.textMuted }]}>{timeAgo(item?.createdAt)}</Text>
            </View>
        </View>
    );
};

export default function ChannelDetailScreen({ navigation, route }) {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const insets = useSafeAreaInsets();

    const pal = PALETTES[theme?.mode] ?? PALETTES.light;
    const { channelId } = route.params ?? {};
    const [channel, setChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [imageUri, setimageUri] = useState('');
    const [showInfo, setShowInfo] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const [following, setFollowing] = useState(false);
    const [loadingFollow, setLoadingFollow] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const cRes = await apiService({ method: 'GET', endpoint: `channels/${channelId}` });
            const channelData = cRes?.data?.channel || cRes?.data || null;
            if (!channelData) return;
            setChannel(channelData);
            setFollowing(!!channelData?.isSubscribed);
            setimageUri(channelData.channelIcon ? `${Config.MEDIA_URL}${channelData.channelIcon}` : '');
        } catch (e) {
            console.log('Channel fetch error:', e);
        }
    }, [channelId]);

    const fetchMessages = useCallback(async () => {
        try {
            const mRes = await apiService({ method: 'GET', endpoint: `channels/${channelId}/messages` });
            setMessages(mRes?.data?.messages ?? []);
        } catch (e) {
            console.log('Channel messages error:', e);
        }
    }, [channelId]);

    const loadAll = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true); else setLoading(true);
        await Promise.all([fetchData(), fetchMessages()]);
        setLoading(false);
        setRefreshing(false);
    }, [fetchData, fetchMessages]);

    useEffect(() => { loadAll(); }, [loadAll]);

    // Screen par wapas aane par naye posts / subscriber count aa jayein
    useFocusEffect(
        useCallback(() => { loadAll({ silent: true }); }, [loadAll])
    );

    const doFollow = async (nextFollowing) => {
        const prevFollowing = following;
        const delta = nextFollowing ? 1 : -1;

        setFollowing(nextFollowing);
        setChannel(prev => prev && ({
            ...prev,
            isSubscribed: nextFollowing,
            subscriberCount: Math.max(0, (prev.subscriberCount ?? 0) + delta),
        }));
        setLoadingFollow(true);

        try {
            // apiService throw nahi karta — success check ke bina fail hone par bhi
            // button badla hua dikhta rehta tha
            const res = await apiService({
                method: 'PUT',
                endpoint: nextFollowing
                    ? `channels/${channelId}/subscribe`
                    : `channels/${channelId}/unsubscribe`,
                data: {},
            });
            if (!res?.success) throw new Error(res?.error?.message || 'failed');
            fetchData();
        } catch (e) {
            setFollowing(prevFollowing);
            setChannel(prev => prev && ({
                ...prev,
                isSubscribed: prevFollowing,
                subscriberCount: Math.max(0, (prev.subscriberCount ?? 0) - delta),
            }));
            Alert.alert('Error', 'Something went wrong, please try again');
        } finally {
            setLoadingFollow(false);
        }
    };

    const handleFollow = () => {
        if (loadingFollow) return;
        if (!following) return doFollow(true);

        Alert.alert('Unsubscribe?', `You will stop receiving posts from ${channel?.channelName ?? 'this channel'}.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Unsubscribe', style: 'destructive', onPress: () => doFollow(false) },
        ]);
    };

    const shareChannel = async () => {
        setShowMenu(false);
        try {
            const link = channel?.inviteLink
                ? `${Config.Main_url}c/${channel.inviteLink}`
                : Config.Main_url;
            await Share.share({
                title: channel?.channelName,
                message: `Check out "${channel?.channelName}" on Telebook: ${link}`,
            });
        } catch (e) {
            console.log('Share error:', e);
        }
    };

    const copyInviteLink = () => {
        if (!channel?.inviteLink) return;
        Clipboard.setString(`${Config.Main_url}c/${channel.inviteLink}`);
        Alert.alert('Copied', 'Invite link copied to clipboard');
    };

    const subscriberCount = channel?.subscriberCount ?? channel?.subscribers?.length ?? 0;
    const postCount = channel?.totalMessages ?? messages.length;

    const ChannelIcon = ({ size }) => (
        imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        ) : (
            <View style={[
                { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
                { backgroundColor: 'rgba(255,255,255,0.25)' },
            ]}>
                <Ionicons name="megaphone" size={size * 0.45} color="#fff" />
            </View>
        )
    );

    return (
        <View style={[sc.container, { backgroundColor: pal.bg }]}>
            <StatusBar backgroundColor={pal.statusBg} barStyle={pal.statusBar} />

            {/* HEADER — baaki app ke header jaisa (avatar + naam + subscribers + menu) */}
            <View style={sc.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={sc.iconBtn} hitSlop={HIT}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={sc.topInfo} activeOpacity={0.7} onPress={() => setShowInfo(true)}>
                    <ChannelIcon size={38} />
                    <View style={{ flex: 1 }}>
                        <Text style={sc.topTitle} numberOfLines={1}>{channel?.channelName || 'Channel'}</Text>
                        <Text style={sc.topSubCount} numberOfLines={1}>
                            {formatCount(subscriberCount)} {subscriberCount === 1 ? 'subscriber' : 'subscribers'}
                        </Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowMenu(true)} style={sc.iconBtn} hitSlop={HIT}>
                    <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={pal.accent} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={messages}
                    keyExtractor={(it, i) => it?._id || String(i)}
                    renderItem={({ item }) => <MessageBubble item={item} pal={pal} />}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: 110 + insets.bottom, flexGrow: 1 }}
                    refreshing={refreshing}
                    onRefresh={() => loadAll({ silent: true })}
                    ListEmptyComponent={
                        <View style={sc.emptyWrap}>
                            <View style={[sc.emptyIconWrap, { backgroundColor: pal.card, borderColor: pal.cardBorder }]}>
                                <Ionicons name="megaphone-outline" size={34} color={pal.accent} />
                            </View>
                            <Text style={[sc.emptyTitle, { color: pal.textPrimary }]}>No posts yet</Text>
                            <Text style={[sc.emptyText, { color: pal.textMuted }]}>
                                New posts from this channel will show up here
                            </Text>
                        </View>
                    }
                />
            )}

            {/* SUBSCRIBE BAR — pehle ek floating pill tha jiska style hi apply nahi hota tha */}
            <View style={[
                sc.footerBar,
                { backgroundColor: pal.card, borderTopColor: pal.cardBorder, paddingBottom: 12 + insets.bottom },
            ]}>
                <TouchableOpacity
                    onPress={handleFollow}
                    disabled={loadingFollow}
                    activeOpacity={0.85}
                    style={[
                        sc.followBtn,
                        following
                            ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: pal.accent }
                            : { backgroundColor: pal.accent },
                        loadingFollow && { opacity: 0.6 },
                    ]}
                >
                    {loadingFollow ? (
                        <ActivityIndicator size="small" color={following ? pal.accent : '#fff'} />
                    ) : (
                        <>
                            <Ionicons
                                name={following ? 'checkmark-circle' : 'add-circle-outline'}
                                size={18}
                                color={following ? pal.accent : '#fff'}
                            />
                            <Text style={[sc.followText, { color: following ? pal.accent : '#fff' }]}>
                                {following ? 'Subscribed' : 'Subscribe'}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* MENU */}
            <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
                <TouchableOpacity style={sc.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
                    <View style={[sc.menuBox, { backgroundColor: pal.card }]}>
                        <TouchableOpacity style={sc.menuItem} onPress={() => { setShowMenu(false); setShowInfo(true); }} activeOpacity={0.7}>
                            <Ionicons name="information-circle-outline" size={18} color={pal.accent} />
                            <Text style={[sc.menuText, { color: pal.textPrimary }]}>Channel info</Text>
                        </TouchableOpacity>
                        <View style={[sc.menuDivider, { backgroundColor: pal.cardBorder }]} />
                        <TouchableOpacity style={sc.menuItem} onPress={shareChannel} activeOpacity={0.7}>
                            <Ionicons name="share-social-outline" size={18} color={pal.accent} />
                            <Text style={[sc.menuText, { color: pal.textPrimary }]}>Share channel</Text>
                        </TouchableOpacity>
                        {following && (
                            <>
                                <View style={[sc.menuDivider, { backgroundColor: pal.cardBorder }]} />
                                <TouchableOpacity style={sc.menuItem} onPress={() => { setShowMenu(false); handleFollow(); }} activeOpacity={0.7}>
                                    <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                                    <Text style={[sc.menuText, { color: '#EF4444' }]}>Unsubscribe</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* INFO SHEET — description/category/invite link pehle kahin dikhte hi nahi the */}
            <Modal visible={showInfo} transparent animationType="slide" onRequestClose={() => setShowInfo(false)}>
                <TouchableOpacity style={sc.sheetOverlay} activeOpacity={1} onPress={() => setShowInfo(false)}>
                    <TouchableOpacity
                        activeOpacity={1}
                        style={[sc.sheet, { backgroundColor: pal.card, paddingBottom: 20 + insets.bottom }]}
                    >
                        <View style={[sc.sheetHandle, { backgroundColor: pal.cardBorder }]} />

                        <View style={sc.sheetHead}>
                            <View style={sc.sheetIcon}><ChannelIcon size={72} /></View>
                            <Text style={[sc.sheetTitle, { color: pal.textPrimary }]} numberOfLines={2}>
                                {channel?.channelName || 'Channel'}
                            </Text>
                            <Text style={[sc.sheetSub, { color: pal.textMuted }]}>
                                {formatCount(subscriberCount)} {subscriberCount === 1 ? 'subscriber' : 'subscribers'}
                                {postCount ? ` · ${formatCount(postCount)} ${postCount === 1 ? 'post' : 'posts'}` : ''}
                            </Text>
                        </View>

                        {!!channel?.channelDescription && (
                            <Text style={[sc.sheetDesc, { color: pal.textDesc }]}>{channel.channelDescription}</Text>
                        )}

                        <View style={sc.chipRow}>
                            {!!channel?.category && (
                                <View style={[sc.chip, { borderColor: pal.cardBorder }]}>
                                    <Ionicons name="pricetag-outline" size={13} color={pal.textMuted} />
                                    <Text style={[sc.chipText, { color: pal.textMuted }]}>{channel.category}</Text>
                                </View>
                            )}
                            <View style={[sc.chip, { borderColor: pal.cardBorder }]}>
                                <Ionicons name={channel?.isPrivate ? 'lock-closed-outline' : 'earth-outline'} size={13} color={pal.textMuted} />
                                <Text style={[sc.chipText, { color: pal.textMuted }]}>
                                    {channel?.isPrivate ? 'Private' : 'Public'}
                                </Text>
                            </View>
                            {!!channel?.createdAt && (
                                <View style={[sc.chip, { borderColor: pal.cardBorder }]}>
                                    <Ionicons name="calendar-outline" size={13} color={pal.textMuted} />
                                    <Text style={[sc.chipText, { color: pal.textMuted }]}>
                                        {new Date(channel.createdAt).toLocaleDateString()}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {!!channel?.inviteLink && (
                            <TouchableOpacity
                                style={[sc.linkRow, { borderColor: pal.cardBorder }]}
                                onPress={copyInviteLink}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="link-outline" size={18} color={pal.accent} />
                                <Text style={[sc.linkText, { color: pal.textDesc }]} numberOfLines={1}>
                                    {`${Config.Main_url}c/${channel.inviteLink}`}
                                </Text>
                                <Ionicons name="copy-outline" size={17} color={pal.textMuted} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[sc.sheetBtn, { backgroundColor: pal.accent }]}
                            onPress={shareChannel}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="share-social-outline" size={18} color="#fff" />
                            <Text style={sc.sheetBtnText}>Share channel</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
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
    playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    playCircleFloating: {
        position: 'absolute',
        top: MEDIA_H / 2 - 27,
        left: MEDIA_W / 2 - 27,
        width: 54, height: 54, borderRadius: 27,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
    },
    playCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
});

const au = StyleSheet.create({
    container: { borderRadius: 12, padding: 15, width: MEDIA_W, borderWidth: 1 },
    fullscreen: { width: SCREEN_W * 0.9, alignSelf: 'center' },
    waveRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 12, height: 40 },
    bar: { width: 4, borderRadius: 2 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    playBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    timeText: { fontSize: 13, fontWeight: '600' },
});

const sl = StyleSheet.create({
    wrapper: { marginBottom: 10 },
    img: { height: MEDIA_H, borderRadius: 12 },
    badge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    expandIcon: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 15, padding: 6 },
});

const mb = StyleSheet.create({
    wrap: { marginHorizontal: 12, marginVertical: 6, borderRadius: 15, padding: 12, borderWidth: 1 },
    text: { fontSize: 15, lineHeight: 22 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, gap: 5 },
    time: { fontSize: 11 },
    dotSep: { width: 3, height: 3, borderRadius: 2, opacity: 0.6 },
});

const sc = StyleSheet.create({
    container: { flex: 1 },

    // Header — Chat/Broadcast screens jaisa
    topBar: {
        height: 90,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
        backgroundColor: '#1296f3',
        gap: 8,
    },
    iconBtn: { padding: 6 },
    topInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    topTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
    topSubCount: { color: '#d0eeff', fontSize: 12, marginTop: 1 },

    // Empty state
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8, paddingBottom: 60 },
    emptyIconWrap: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 4 },
    emptyTitle: { fontSize: 16, fontWeight: '700' },
    emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

    // Subscribe bar
    footerBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
    followBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
    followText: { fontSize: 15, fontWeight: '700' },

    // Menu
    menuOverlay: {
        flex: 1,
        paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 44) + 50,
        paddingRight: 10,
        alignItems: 'flex-end',
    },
    menuBox: {
        borderRadius: 12, paddingVertical: 6, minWidth: 195,
        elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8,
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    menuText: { fontSize: 15, fontWeight: '500' },
    menuDivider: { height: 0.5, marginHorizontal: 8 },

    // Info sheet
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, maxHeight: '88%' },
    sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    sheetHead: { alignItems: 'center', gap: 6 },
    sheetIcon: { marginBottom: 6 },
    sheetTitle: { fontSize: 19, fontWeight: '700', textAlign: 'center' },
    sheetSub: { fontSize: 13 },
    sheetDesc: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 14 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
    chipText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, marginTop: 18 },
    linkText: { flex: 1, fontSize: 12 },

    sheetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginTop: 14 },
    sheetBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
