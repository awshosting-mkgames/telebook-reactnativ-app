// components/NewPostModal.js
import { Ionicons } from '@expo/vector-icons';
import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
    useAudioRecorder,
} from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useContext, useState } from 'react';
import {
    ActivityIndicator, Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import apiService from '../../../services/apiService';
import { ThemeContext } from '../../../components/ThemeContext';
import { appendFile } from '../../../utils/uploadFile';

export default function NewPostModal({ visible, onClose, channelId, onPosted }) {
    const { theme } = useContext(ThemeContext);
    const isLight = theme?.mode === 'light';
    const styles = getStyles(isLight);
    const sheetStyles = getSheetStyles(isLight);

    const [content, setContent] = useState('');
    const [media, setMedia] = useState([]);
    const [sending, setSending] = useState(false);

    // ── Audio state ──
    const [recordingStatus, setRecordingStatus] = useState('idle'); // idle | recording | done
    const [recordedAudio, setRecordedAudio] = useState(null);
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const audioPlayer = useAudioPlayer(recordedAudio?.uri ? { uri: recordedAudio.uri } : null);
    const audioPlayerStatus = useAudioPlayerStatus(audioPlayer);
    const audioPlaying = audioPlayerStatus?.playing ?? false;

    // ── Action Sheet state ──
    const [activeSheet, setActiveSheet] = useState(null); // 'photo' | 'video' | 'audio'

    const reset = () => {
        setContent('');
        setMedia([]);
        setRecordedAudio(null);
        setRecordingStatus('idle');
        setActiveSheet(null);
        stopRecording(true);
    };

    // ── Photo: Camera ─────────────────────────────────────────────────────────
    const takePhoto = async () => {
        setActiveSheet(null);
        const { granted } = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted) { Alert.alert('Camera permission chahiye'); return; }
        const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
        });
        if (!res.canceled && res.assets?.[0]) {
            const a = res.assets[0];
            setMedia(p => [...p, { uri: a.uri, type: 'image/jpeg', name: `photo_${Date.now()}.jpg` }].slice(0, 5));
        }
    };

    // ── Photo: Gallery ────────────────────────────────────────────────────────
    const pickPhoto = async () => {
        setActiveSheet(null);
        const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!granted) { Alert.alert('Gallery permission chahiye'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.85,
        });
        if (!res.canceled) {
            const files = res.assets.map(a => ({
                uri: a.uri,
                type: 'image/jpeg',
                name: a.fileName || `img_${Date.now()}.jpg`,
            }));
            setMedia(p => [...p, ...files].slice(0, 5));
        }
    };

    // ── Video: Camera ─────────────────────────────────────────────────────────
    const takeVideo = async () => {
        setActiveSheet(null);
        const { granted } = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted) { Alert.alert('Camera permission chahiye'); return; }
        const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            videoMaxDuration: 60,
            quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        });
        if (!res.canceled && res.assets?.[0]) {
            const a = res.assets[0];
            setMedia(p => [...p, { uri: a.uri, type: 'video/mp4', name: `video_${Date.now()}.mp4` }].slice(0, 5));
        }
    };

    // ── Video: Gallery ────────────────────────────────────────────────────────
    const pickVideo = async () => {
        setActiveSheet(null);
        const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!granted) { Alert.alert('Gallery permission chahiye'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 1,
        });
        if (!res.canceled && res.assets?.[0]) {
            const a = res.assets[0];
            setMedia(p => [...p, { uri: a.uri, type: 'video/mp4', name: `video_${Date.now()}.mp4` }].slice(0, 5));
        }
    };

    // ── Audio: Gallery ────────────────────────────────────────────────────────
    const handleAudioGallery = async () => {
        setActiveSheet(null);
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: 'audio/*',
                copyToCacheDirectory: true,
            });
            if (!res.canceled && res.assets?.[0]) {
                const file = res.assets[0];
                setRecordedAudio({
                    uri: file.uri,
                    name: file.name || `audio_${Date.now()}.m4a`,
                    duration: null,
                    source: 'picked',
                });
                setRecordingStatus('done');
            }
        } catch (err) {
            Alert.alert('Error', 'Audio file pick nahi hua');
        }
    };

    // ── Audio: Start Recording ────────────────────────────────────────────────
    const handleAudioRecord = async () => {
        setActiveSheet(null);
        await startRecording();
    };

    // ── Recording functions ───────────────────────────────────────────────────
    const startRecording = async () => {
        try {
            const { granted } = await requestRecordingPermissionsAsync();
            if (!granted) { Alert.alert('Mic permission chahiye'); return; }

            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
                interruptionMode: 'duckOthers',
                shouldRouteThroughEarpiece: false,
            });

            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
            setRecordingStatus('recording');
        } catch (err) {
            Alert.alert('Recording shuru nahi hui', err.message);
        }
    };

    const stopRecording = async (discard = false) => {
        if (!audioRecorder.isRecording) return;
        try {
            // Duration stop() se pehle padhna zaruri hai
            const status = audioRecorder.getStatus();
            await audioRecorder.stop();
            if (!discard) {
                setRecordedAudio({
                    uri: audioRecorder.uri,
                    name: `recording_${Date.now()}.m4a`,
                    duration: status?.durationMillis
                        ? Math.round(status.durationMillis / 1000)
                        : null,
                    source: 'recorded',
                });
                setRecordingStatus('done');
            } else {
                setRecordingStatus('idle');
                setRecordedAudio(null);
            }
        } catch (err) {
            console.log('stopRecording error', err);
        } finally {
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        }
    };

    const discardAudio = () => {
        stopRecording(true);
        setRecordedAudio(null);
        setRecordingStatus('idle');
        audioPlayer.pause();
    };

    // ── Preview playback ──────────────────────────────────────────────────────
    const togglePlay = async () => {
        if (!recordedAudio?.uri) return;
        try {
            if (audioPlaying) {
                audioPlayer.pause();
                return;
            }
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
            await audioPlayer.seekTo(0);
            audioPlayer.play();
        } catch (err) {
            Alert.alert('Playback error', err.message);
        }
    };

    // ── Post ──────────────────────────────────────────────────────────────────
    const handlePost = async () => {
        if (!content.trim() && media.length === 0 && !recordedAudio) {
            Alert.alert('Kuch toh add karo');
            return;
        }
        setSending(true);
        try {
            const form = new FormData();
            if (content.trim()) form.append('content', content.trim());

            let msgType = 'text';
            if (recordedAudio) msgType = 'audio';
            else if (media.length > 0) msgType = 'image';
            form.append('messageType', msgType);

            for (const f of media) {
                await appendFile(form, 'files', f);
            }

            if (recordedAudio) {
                await appendFile(form, 'files', {
                    ...recordedAudio,
                    type: 'audio/m4a',
                    name: recordedAudio.name,
                });
            }

            const res = await apiService({
                method: 'POST',
                endpoint: `channels/${channelId}/messages`,
                data: form,
                isMultipart: true,
            });

            onPosted(res?.message ?? null);
            reset();
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Post nahi hua');
        } finally {
            setSending(false);
        }
    };

    const formatDuration = (secs) => {
        if (!secs) return '';
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // ── Action Sheet config ───────────────────────────────────────────────────
    const sheetConfig = {
        photo: {
            title: 'Photo',
            color: '#1296f3',
            options: [
                { label: 'Camera', icon: 'camera-outline', onPress: takePhoto, disabled: !!recordedAudio },
                { label: 'Gallery', icon: 'images-outline', onPress: pickPhoto, disabled: !!recordedAudio },
            ],
        },
        video: {
            title: 'Video',
            color: '#e53935',
            options: [
                { label: 'Camera', icon: 'videocam-outline', onPress: takeVideo, disabled: !!recordedAudio },
                { label: 'Gallery', icon: 'folder-open-outline', onPress: pickVideo, disabled: !!recordedAudio },
            ],
        },
        audio: {
            title: 'Audio',
            color: '#8e44ad',
            options: [
                { label: 'Gallery', icon: 'musical-notes-outline', onPress: handleAudioGallery, disabled: media.length > 0 },
                { label: 'Record', icon: 'mic-outline', onPress: handleAudioRecord, disabled: media.length > 0 },
            ],
        },
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={() => { reset(); onClose(); }}
        >
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => { reset(); onClose(); }}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.container}
                >
                    <View style={styles.sheet}>

                        {/* ── Header ── */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
                                <Text style={styles.cancelTxt}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.title}>New Post</Text>
                            <TouchableOpacity
                                style={[styles.postBtn, sending && { opacity: 0.6 }]}
                                onPress={handlePost}
                                disabled={sending}
                            >
                                {sending
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={styles.postTxt}>Post</Text>
                                }
                            </TouchableOpacity>
                        </View>

                        {/* ── Text input ── */}
                        <TextInput
                            style={styles.input}
                            placeholder="Kuch share karein..."
                            placeholderTextColor={isLight ? '#bbb' : '#666'}
                            value={content}
                            onChangeText={setContent}
                            multiline
                            maxLength={1000}
                            editable={!sending}
                        />

                        {/* ── Image / Video preview ── */}
                        {media.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaList}>
                                {media.map((f, i) => (
                                    <View key={i} style={styles.thumbWrapper}>
                                        <Image source={{ uri: f.uri }} style={styles.thumb} />
                                        <TouchableOpacity
                                            style={styles.removeBtn}
                                            onPress={() => setMedia(p => p.filter((_, idx) => idx !== i))}
                                        >
                                            <Ionicons name="close-circle" size={22} color="#e53935" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        )}

                        {/* ── Audio preview ── */}
                        {recordedAudio && (
                            <View style={styles.audioPreview}>
                                <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
                                    <Ionicons
                                        name={audioPlaying ? 'pause' : 'play'}
                                        size={20}
                                        color="#fff"
                                    />
                                </TouchableOpacity>
                                <View style={styles.audioInfo}>
                                    <Text style={styles.audioName} numberOfLines={1}>
                                        {recordedAudio.source === 'recorded'
                                            ? '🎙 Recording'
                                            : '🎵 ' + recordedAudio.name}
                                    </Text>
                                    {recordedAudio.duration && (
                                        <Text style={styles.audioDuration}>
                                            {formatDuration(recordedAudio.duration)}
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity onPress={discardAudio}>
                                    <Ionicons name="close-circle" size={22} color="#e53935" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ── Three action buttons ── */}
                        <View style={styles.actionRow}>
                            {/* Photo */}
                            <TouchableOpacity
                                style={[
                                    styles.actionBtn,
                                    { borderColor: '#1296f3' },
                                    (sending || !!recordedAudio) && styles.disabledBtn,
                                ]}
                                onPress={() => setActiveSheet('photo')}
                                disabled={sending || !!recordedAudio}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="image-outline" size={20} color="#1296f3" />
                                <Text style={[styles.actionTxt, { color: '#1296f3' }]}>Photo</Text>
                            </TouchableOpacity>

                            {/* Video */}
                            <TouchableOpacity
                                style={[
                                    styles.actionBtn,
                                    { borderColor: '#e53935' },
                                    (sending || !!recordedAudio) && styles.disabledBtn,
                                ]}
                                onPress={() => setActiveSheet('video')}
                                disabled={sending || !!recordedAudio}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="videocam-outline" size={20} color="#e53935" />
                                <Text style={[styles.actionTxt, { color: '#e53935' }]}>Video</Text>
                            </TouchableOpacity>

                            {/* Audio */}
                            <TouchableOpacity
                                style={[
                                    styles.actionBtn,
                                    { borderColor: '#8e44ad' },
                                    (sending || media.length > 0 || recordingStatus === 'recording') && styles.disabledBtn,
                                ]}
                                onPress={() => setActiveSheet('audio')}
                                disabled={sending || media.length > 0 || recordingStatus === 'recording'}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="mic-outline" size={20} color="#8e44ad" />
                                <Text style={[styles.actionTxt, { color: '#8e44ad' }]}>Audio</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ── Recording live indicator ── */}
                        {recordingStatus === 'recording' && (
                            <View style={styles.recordingIndicator}>
                                <View style={styles.recordingDot} />
                                <Text style={styles.recordingTxt}>Recording...</Text>
                                <TouchableOpacity
                                    style={styles.stopInlineBtn}
                                    onPress={() => stopRecording(false)}
                                >
                                    <Ionicons name="stop-circle" size={16} color="#fff" />
                                    <Text style={styles.stopInlineTxt}>Stop</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </View>

            {/* ── Action Sheet Modal ── */}
            {activeSheet && (
                <Modal
                    visible={!!activeSheet}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setActiveSheet(null)}
                >
                    <TouchableOpacity
                        style={sheetStyles.overlay}
                        activeOpacity={1}
                        onPress={() => setActiveSheet(null)}
                    >
                        <TouchableOpacity
                            style={sheetStyles.sheet}
                            activeOpacity={1}
                            onPress={() => { }}
                        >
                            {/* Handle */}
                            <View style={sheetStyles.handle} />

                            {/* Title */}
                            <Text style={[sheetStyles.sheetTitle, { color: sheetConfig[activeSheet].color }]}>
                                {sheetConfig[activeSheet].title} select karo
                            </Text>

                            {/* Options */}
                            <View style={sheetStyles.optionsRow}>
                                {sheetConfig[activeSheet].options.map((opt, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[
                                            sheetStyles.optionBtn,
                                            opt.disabled && sheetStyles.optionDisabled,
                                        ]}
                                        onPress={opt.onPress}
                                        disabled={opt.disabled}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[
                                            sheetStyles.iconBox,
                                            { borderColor: opt.disabled ? (isLight ? '#ddd' : '#3a3d44') : sheetConfig[activeSheet].color },
                                        ]}>
                                            <Ionicons
                                                name={opt.icon}
                                                size={28}
                                                color={opt.disabled ? (isLight ? '#ccc' : '#5a5e66') : sheetConfig[activeSheet].color}
                                            />
                                        </View>
                                        <Text style={[
                                            sheetStyles.optionLabel,
                                            { color: opt.disabled ? (isLight ? '#ccc' : '#5a5e66') : (isLight ? '#333' : '#e5e5e5') },
                                        ]}>
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Cancel */}
                            <TouchableOpacity
                                style={sheetStyles.cancelBtn}
                                onPress={() => setActiveSheet(null)}
                            >
                                <Text style={sheetStyles.cancelTxt}>Cancel</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>
            )}
        </Modal>
    );
}

const getStyles = (isLight) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: { width: '100%', alignItems: 'center' },
    sheet: {
        backgroundColor: isLight ? '#fff' : '#1a1d23',
        borderRadius: 24,
        padding: 20,
        width: '100%',
        maxWidth: 450,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    cancelTxt: { fontSize: 15, color: isLight ? '#999' : '#8a8f96', fontWeight: '500' },
    title: { fontSize: 18, fontWeight: '800', color: isLight ? '#111' : '#f5f5f5' },
    postBtn: { backgroundColor: '#1296f3', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    postTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
    input: {
        borderWidth: 1.5,
        borderColor: isLight ? '#f0f0f0' : '#2a2d33',
        borderRadius: 16,
        padding: 15,
        fontSize: 16,
        color: isLight ? '#111' : '#f5f5f5',
        minHeight: 120,
        backgroundColor: isLight ? '#fafafa' : '#22252b',
        textAlignVertical: 'top',
    },
    mediaList: { marginVertical: 15 },
    thumbWrapper: { marginRight: 12, position: 'relative' },
    thumb: { width: 85, height: 85, borderRadius: 12 },
    removeBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: isLight ? '#fff' : '#1a1d23', borderRadius: 11 },

    // ── Audio preview ──
    audioPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isLight ? '#f3f0ff' : '#241f33',
        borderRadius: 14,
        padding: 12,
        marginTop: 14,
        gap: 10,
        borderWidth: 1,
        borderColor: isLight ? '#d5c8ff' : '#4a3f66',
    },
    playBtn: {
        backgroundColor: '#8e44ad',
        width: 36, height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioInfo: { flex: 1 },
    audioName: { color: isLight ? '#333' : '#e5e5e5', fontSize: 13, fontWeight: '600' },
    audioDuration: { color: isLight ? '#888' : '#9aa0a6', fontSize: 11, marginTop: 2 },

    // ── Action buttons ──
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingVertical: 12,
    },
    actionTxt: { fontWeight: '700', fontSize: 13 },
    disabledBtn: { opacity: 0.35 },

    // ── Recording indicator ──
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 12,
    },
    recordingDot: {
        width: 10, height: 10,
        borderRadius: 5,
        backgroundColor: '#e53935',
    },
    recordingTxt: { color: '#e53935', fontSize: 13, fontWeight: '600' },
    stopInlineBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#e53935',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginLeft: 4,
    },
    stopInlineTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

const getSheetStyles = (isLight) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: isLight ? '#fff' : '#1a1d23',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 40,
    },
    handle: {
        width: 40, height: 4,
        backgroundColor: isLight ? '#e0e0e0' : '#3a3d44',
        borderRadius: 10,
        alignSelf: 'center',
        marginBottom: 18,
    },
    sheetTitle: {
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 28,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 50,
        marginBottom: 28,
    },
    optionBtn: { alignItems: 'center', gap: 10 },
    optionDisabled: { opacity: 0.4 },
    iconBox: {
        width: 72, height: 72,
        borderRadius: 20,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: isLight ? '#fafafa' : '#22252b',
    },
    optionLabel: { fontSize: 13, fontWeight: '600', color: isLight ? '#333' : '#e5e5e5' },
    cancelBtn: {
        borderWidth: 1.5,
        borderColor: isLight ? '#e0e0e0' : '#2a2d33',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
    },
    cancelTxt: { color: isLight ? '#999' : '#8a8f96', fontSize: 15, fontWeight: '600' },
});