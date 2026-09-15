import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { requestLibraryPermission, saveRemoteFileToDevice, saveToLibrary } from '../../../utils/mediaSave';
import * as Sharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ThemeContext } from '../../../components/ThemeContext';
import Config from '../../../services/config';

const { width: SCREEN_W } = Dimensions.get('window');
const SLIDER_W = SCREEN_W - 32;
const STORAGE_KEY = 'DOWNLOAD_DIR_URI';

const getImg = (path) => `${Config.MEDIA_URL}${path}`;
const formatTime = (ms) => {
    if (!ms) return '00:00';
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / 1000 / 60) % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};
const getFileType = (att) => {
    const type = att?.fileType || '';
    if (type.startsWith('image')) return 'image';
    if (type.startsWith('video')) return 'video';
    if (type.startsWith('audio')) return 'audio';
    return 'doc';
};
const viewListData = (data) => data?.length || 0;

/* ─── Universal Media Modal ───────────────────────────── */
function MediaModal({ visible, item, onClose }) {
    const videoViewRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [position, setPosition] = useState(0); // seconds
    const [duration, setDuration] = useState(0); // seconds
    const [loading, setLoading] = useState(false);

    const type = item ? getFileType(item) : null;
    const uri = item ? getImg(item.url) : null;
    const isPlayable = type === 'video' || type === 'audio';

    const player = useVideoPlayer(null, (p) => {
        p.loop = false;
        p.timeUpdateEventInterval = 0.5;
    });

    // Naya item select hone par player source update karo
    useEffect(() => {
        if (isPlayable && uri) {
            player.replace(uri);
        }
    }, [uri, isPlayable]);

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

    // Video ready hote hi (jaise pehle presentFullscreenPlayerAsync hota tha) fullscreen open karo
    useEffect(() => {
        if (type !== 'video') return;
        const statusSub = player.addListener('statusChange', ({ status }) => {
            if (status === 'readyToPlay') {
                videoViewRef.current?.enterFullscreen?.();
            }
        });
        return () => statusSub.remove();
    }, [player, type]);

    // Modal close → video pause karo
    useEffect(() => {
        if (!visible) {
            player.pause();
            setPosition(0);
            setDuration(0);
        }
    }, [visible]);

    // Item change → status reset karo
    useEffect(() => {
        setPosition(0);
        setDuration(0);
    }, [item]);

    const handleDownload = async () => {
        if (!item) return;
        try {
            setLoading(true);
            const ext = item?.filename?.split('.').pop() || 'file';
            const fileName = item?.filename || `download_${Date.now()}.${ext}`;

            // Web: let the browser download it. No-op (false) on native.
            if (await saveRemoteFileToDevice(uri, fileName)) return;

            const tempUri = FileSystem.cacheDirectory + fileName;
            const { uri: localUri } = await FileSystem.downloadAsync(uri, tempUri);

            if (FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
                let directoryUri = await AsyncStorage.getItem(STORAGE_KEY);
                if (!directoryUri) {
                    const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                    if (!perms.granted) { Alert.alert('Permission Required', 'Please select a folder.'); return; }
                    directoryUri = perms.directoryUri;
                    await AsyncStorage.setItem(STORAGE_KEY, directoryUri);
                }
                const mimeType =
                    type === 'image' ? 'image/jpeg' :
                        type === 'video' ? 'video/mp4' :
                            type === 'audio' ? 'audio/mpeg' : 'application/octet-stream';

                const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(directoryUri, fileName, mimeType);
                const fileData = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
                await FileSystem.StorageAccessFramework.writeAsStringAsync(newFileUri, fileData, { encoding: FileSystem.EncodingType.Base64 });
                Alert.alert('Success ✅', 'File downloaded successfully');
            } else {
                if (type === 'image' || type === 'video') {
                    if (!(await requestLibraryPermission())) { Alert.alert('Permission Required', 'Allow gallery access.'); return; }
                    await saveToLibrary(localUri);
                    Alert.alert('Success', 'Saved to Gallery!');
                } else {
                    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(localUri);
                    else Alert.alert('Error', 'Sharing not available');
                }
            }
        } catch (error) {
            await AsyncStorage.removeItem(STORAGE_KEY);
            Alert.alert('Error', 'Could not save file.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        player.pause();
        setPosition(0);
        setDuration(0);
        onClose();
    };

    if (!item) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <StatusBar backgroundColor="#000" barStyle="light-content" />
            <View style={zm.overlay}>
                <View style={zm.header}>
                    <TouchableOpacity style={zm.headerBtn} onPress={handleClose}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[zm.headerBtn, { backgroundColor: '#F5C518' }]}
                        onPress={handleDownload}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator size="small" color="#000" />
                            : <Ionicons name="download-outline" size={22} color="#000" />
                        }
                    </TouchableOpacity>
                </View>

                {type === 'image' ? (
                    <ScrollView maximumZoomScale={4} minimumZoomScale={1} centerContent>
                        <Image source={{ uri }} style={zm.img} resizeMode="contain" />
                    </ScrollView>
                ) : (
                    <View style={zm.contentCenter}>
                        <View style={type === 'audio' ? zm.audioCard : null}>
                            {type === 'audio' && <Ionicons name="musical-notes" size={60} color="#F5C518" />}
                            {type === 'doc' && <Ionicons name="document-text" size={80} color="#F5C518" />}
                            {isPlayable && (
                                <>
                                    <VideoView
                                        ref={videoViewRef}
                                        player={player}
                                        style={type === 'video' ? zm.videoPlayer : zm.audioLine}
                                        contentFit="contain"
                                        nativeControls
                                        allowsFullscreen
                                        onFullscreenExit={() => player.pause()}
                                    />
                                    <View style={zm.timerRow}>
                                        <Text style={zm.timeTxt}>
                                            {formatTime(position * 1000)} / {formatTime(duration * 1000)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={zm.playBtn}
                                        onPress={() => isPlaying ? player.pause() : player.play()}
                                    >
                                        <Ionicons name={isPlaying ? 'pause' : 'play'} size={35} color="#fff" />
                                    </TouchableOpacity>
                                </>
                            )}
                            <Text style={zm.fileName}>{item.filename}</Text>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
}

/* ─── Media Slider ─────────────────────────────────────── */
function MediaSlider({ attachments }) {
    const [activeIdx, setActiveIdx] = useState(0);
    const [selectedItem, setSelectedItem] = useState(null);

    const renderSlide = ({ item }) => {
        const type = getFileType(item);
        const uri = getImg(item.url);
        return (
            <TouchableOpacity activeOpacity={0.9} onPress={() => setSelectedItem(item)} style={sl.slideBox}>
                {type === 'image' && <Image source={{ uri }} style={sl.media} resizeMode="cover" />}
                {type === 'video' && (
                    <View style={sl.placeholder}>
                        <Ionicons name="play-circle" size={50} color="#fff" />
                        <Text style={sl.hint}>Video Post</Text>
                    </View>
                )}
                {type === 'audio' && (
                    <View style={sl.placeholder}>
                        <Ionicons name="mic" size={45} color="#F5C518" />
                        <Text style={sl.hint}>Audio Recording</Text>
                    </View>
                )}
                {type === 'doc' && (
                    <View style={sl.placeholder}>
                        <Ionicons name="document-attach" size={45} color="#F5C518" />
                        <Text style={sl.hint} numberOfLines={1}>{item.filename}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View>
            <FlatList
                data={attachments}
                renderItem={renderSlide}
                keyExtractor={(_, i) => String(i)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={e => setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / SLIDER_W))}
            />
            {attachments.length > 1 && (
                <View style={sl.badge}>
                    <Text style={sl.badgeTxt}>{activeIdx + 1}/{attachments.length}</Text>
                </View>
            )}
            <MediaModal
                visible={!!selectedItem}
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
            />
        </View>
    );
}

/* ─── Main Export ─────────────────────────────────────── */
export default function PostCard({ item, onDelete }) {
    const { theme } = useContext(ThemeContext);
    const isLight = theme?.mode === 'light';
    const styles = getStyles(isLight);

    const viewCount = viewListData(item?.viewedBy);
    return (
        <View style={styles.card}>
            <MediaSlider attachments={item?.attachments ?? []} />
            <View style={styles.body}>
                {!!item.content && <Text style={styles.text}>{item.content}</Text>}
                <View style={styles.footer}>
                    <Text style={styles.date}>
                        <Ionicons name="eye" size={18} color={isLight ? '#969494' : '#8a8f96'} /> {viewCount}
                    </Text>
                    <TouchableOpacity onPress={() => onDelete(item._id)}>
                        <Ionicons name="trash-outline" size={18} color="#ff4444" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

/* ─── Styles ─────────────────────────────────────────── */
// Modal + slider are shown over dark/black overlays regardless of theme,
// so their styles stay constant.
const zm = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
    header: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
    headerBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    contentCenter: { alignItems: 'center', justifyContent: 'center' },
    img: { width: SCREEN_W, height: 500 },
    videoPlayer: { width: SCREEN_W, height: 320 },
    audioCard: { width: SCREEN_W - 60, backgroundColor: '#1A1A1A', borderRadius: 20, padding: 30, alignItems: 'center' },
    audioLine: { width: '100%', height: 40 },
    timerRow: { marginVertical: 15 },
    timeTxt: { color: '#F5C518', fontSize: 16, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    playBtn: { backgroundColor: '#F5C518', width: 65, height: 65, borderRadius: 33, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    fileName: { color: '#fff', marginTop: 20, fontSize: 13, opacity: 0.6, textAlign: 'center' },
});

const sl = StyleSheet.create({
    slideBox: { width: SLIDER_W, height: 230, backgroundColor: '#111' },
    media: { width: '100%', height: '100%' },
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    hint: { color: '#F5C518', marginTop: 10, fontSize: 12, fontWeight: 'bold' },
    badge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeTxt: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
});

const getStyles = (isLight) => StyleSheet.create({
    card: { backgroundColor: isLight ? '#fff' : '#1a1d23', marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: isLight ? 0.1 : 0.4, shadowRadius: 10 },
    body: { padding: 16 },
    text: { fontSize: 15, color: isLight ? '#222' : '#e5e5e5', lineHeight: 22, marginBottom: 12 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: isLight ? '#b4b4b4' : '#2a2d33', paddingTop: 12 },
    date: { color: isLight ? '#747171' : '#9aa0a6', fontSize: 16, fontWeight: '400' },
});