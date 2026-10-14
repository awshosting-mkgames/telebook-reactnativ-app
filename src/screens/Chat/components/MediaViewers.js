import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import { requestLibraryPermission, saveRemoteFileToDevice, saveToLibrary } from '../../../utils/mediaSave';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { claimPlayback, useExclusivePlayback } from '../../../utils/playbackManager';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ───────────────── DOWNLOAD ─────────────────
// Extension URL (uploads/…/file.mp4) se — pehle video bhi .jpg / image/jpeg ban kar save hota tha
const MIME_BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', '3gp': 'video/3gpp', webm: 'video/webm' };
const fileInfo = (uri, fallbackExt) => {
    const last = (uri ?? '').split('?')[0].split('/').pop() ?? '';
    const ext = (last.includes('.') ? last.split('.').pop() : fallbackExt).toLowerCase();
    return { ext, mime: MIME_BY_EXT[ext] ?? (fallbackExt === 'mp4' ? 'video/mp4' : 'image/jpeg') };
};

const downloadFile = async (uri, setLoading, fallbackExt = 'jpg') => {
    const { ext, mime } = fileInfo(uri, fallbackExt);
    try {
        setLoading(true);
        // Web: let the browser download it. No-op (false) on native.
        if (await saveRemoteFileToDevice(uri)) {
            // handled by the browser
        } else if (FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (!permissions.granted) return;

            const fileName = `download_${Date.now()}.${ext}`;
            const tempUri = FileSystem.cacheDirectory + fileName;
            const { uri: localUri } = await FileSystem.downloadAsync(uri, tempUri);
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, mime);
            const fileData = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
            await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, fileData, { encoding: FileSystem.EncodingType.Base64 });
        } else {
            if (!(await requestLibraryPermission())) return;
            const fileUri = FileSystem.documentDirectory + `file_${Date.now()}.${ext}`;
            const { uri: localUri } = await FileSystem.downloadAsync(uri, fileUri);
            await saveToLibrary(localUri);
        }
        Alert.alert('Success ✅', 'Downloaded');
    } catch (e) {
        Alert.alert('Error', 'Download failed');
    } finally {
        setLoading(false);
    }
};

// ───────────────── SHARE ─────────────────
const shareFile = async (uri, fallbackExt = 'jpg') => {
    try {
        if (!(await Sharing.isAvailableAsync())) { Alert.alert('Error', 'Sharing not supported'); return; }
        // expo-sharing sirf local file share karta hai — pehle cache me download karo
        let localUri = uri;
        if (/^https?:/.test(uri ?? '')) {
            const { ext } = fileInfo(uri, fallbackExt);
            ({ uri: localUri } = await FileSystem.downloadAsync(uri, `${FileSystem.cacheDirectory}share_${Date.now()}.${ext}`));
        }
        await Sharing.shareAsync(localUri);
    } catch (e) {
        Alert.alert('Error', 'Share failed');
    }
};

// ───────────────── IMAGE VIEWER ─────────────────
export const ImageViewer = ({ visible, uri, onClose }) => {
    const [downloading, setDownloading] = useState(false);

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close-circle" size={38} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.actions}>
                        <TouchableOpacity onPress={() => downloadFile(uri, setDownloading)} disabled={downloading}>
                            {downloading
                                ? <ActivityIndicator color="#fff" />
                                : <Ionicons name="download-outline" size={30} color="#fff" />
                            }
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => shareFile(uri)}>
                            <Ionicons name="share-social-outline" size={30} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
                {uri ? <Image source={{ uri }} style={styles.img} resizeMode="contain" /> : null}
            </View>
        </Modal>
    );
};

// ───────────────── VIDEO VIEWER ─────────────────
export const VideoModal = ({ visible, uri, onClose }) => {
    const [downloading, setDownloading] = useState(false);

    const player = useVideoPlayer(
        uri ? { uri } : null,
        (player) => {
            player.loop = false;
            claimPlayback(player);
            player.play();
        }
    );

    useExclusivePlayback(player);

    useEffect(() => {
        if (!visible && player) {
            player.pause();
        }
    }, [visible, player]);

    const handleClose = () => {
        player?.pause();
        onClose?.();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={handleClose}>
                        <Ionicons
                            name="close-circle"
                            size={36}
                            color="#fff"
                        />
                    </TouchableOpacity>
                    <View style={styles.actions}>
                        <TouchableOpacity
                            onPress={() =>
                                downloadFile(uri, setDownloading, 'mp4')
                            }
                            disabled={downloading} >
                            {downloading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Ionicons
                                    name="download-outline"
                                    size={28}
                                    color="#fff"
                                />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => shareFile(uri, 'mp4')}
                        >
                            <Ionicons
                                name="share-social-outline"
                                size={28}
                                color="#fff"
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {uri ? (
                    <VideoView
                        player={player}
                        style={styles.video}
                        nativeControls
                        contentFit="contain"
                        allowsFullscreen
                        allowsPictureInPicture
                    />
                ) : null}
            </View>
        </Modal>
    );
};


const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 56 : 36,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
    },
    actions: {
        flexDirection: 'row',
        gap: 18,
        alignItems: 'center',
    },
    img: {
        width: SCREEN_W,
        height: SCREEN_H * 0.8,
    },
    video: {
        width: SCREEN_W,
        height: SCREEN_W * (9 / 16),
    },
});