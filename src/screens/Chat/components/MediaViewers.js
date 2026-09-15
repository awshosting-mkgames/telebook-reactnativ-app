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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ───────────────── DOWNLOAD ─────────────────
const downloadFile = async (uri, setLoading) => {
    try {
        setLoading(true);
        // Web: let the browser download it. No-op (false) on native.
        if (await saveRemoteFileToDevice(uri)) {
            // handled by the browser
        } else if (FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (!permissions.granted) return;

            const fileName = `download_${Date.now()}.jpg`;
            const tempUri = FileSystem.cacheDirectory + fileName;
            const { uri: localUri } = await FileSystem.downloadAsync(uri, tempUri);
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, 'image/jpeg');
            const fileData = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
            await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, fileData, { encoding: FileSystem.EncodingType.Base64 });
        } else {
            if (!(await requestLibraryPermission())) return;
            const fileUri = FileSystem.documentDirectory + `file_${Date.now()}.jpg`;
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
const shareFile = async (uri) => {
    try {
        if (!(await Sharing.isAvailableAsync())) { Alert.alert('Error', 'Sharing not supported'); return; }
        await Sharing.shareAsync(uri);
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
            player.play();
        }
    );

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
                                downloadFile(uri, setDownloading)
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
                            onPress={() => shareFile(uri)}
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