import { Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import { appendFile } from '../../utils/uploadFile';
import { VIDEO_MAX_SECS } from './statusUtils';

const EXT = { 'image/png': 'png', 'image/webp': 'webp', 'video/quicktime': 'mov', 'video/3gpp': '3gp', 'video/webm': 'webm' };
const newClientId = () => `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Video ko preview ke liye alag chhota component (player sirf video par banta hai)
const VideoPreview = ({ uri }) => {
    const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; p.play(); });
    useEffect(() => () => { try { player.pause(); } catch (e) { /* released */ } }, [player]);
    return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
};

/**
 * Status upload se pehle: preview + caption → upload (progress, cancel, retry).
 *  asset: { uri, type: 'image'|'video', mimeType, duration (sec), fileSize }
 * Retry par wahi clientStatusId jaata hai — server duplicate status nahi banata (double tap par bhi).
 */
export default function StatusComposer({ visible, asset, cfg, onClose, onDone }) {
    const { theme } = useContext(ThemeContext);
    const insets = useSafeAreaInsets();
    const [caption, setCaption] = useState('');
    const [phase, setPhase] = useState('idle');   // idle | uploading | error
    const [pct, setPct] = useState(0);
    const [err, setErr] = useState('');
    const clientId = useRef(newClientId());
    const abortRef = useRef(null);
    const busy = useRef(false);

    const isVideo = asset?.type === 'video';
    const maxSecs = Number(cfg?.maxVideoSeconds) || VIDEO_MAX_SECS;
    const maxVideoMB = Number(cfg?.maxVideoMB) || 64;
    const maxImageMB = Number(cfg?.maxImageMB) || 10;
    const maxCaption = Number(cfg?.maxCaptionLength) || 700;

    useEffect(() => {
        if (visible) { setCaption(''); setPhase('idle'); setPct(0); setErr(''); clientId.current = newClientId(); busy.current = false; }
        else { abortRef.current?.abort(); }
    }, [visible, asset?.uri]);

    // Client-side jaanch (server bhi wahi jaanchta hai)
    const problem = (() => {
        if (!asset) return '';
        const dur = Number(asset.duration) || 0;
        if (isVideo && dur > maxSecs + 0.5) {
            return `This video is ${Math.round(dur)} seconds. Status videos can be at most ${maxSecs} seconds. Please choose or trim a shorter video.`;
        }
        const mb = (Number(asset.fileSize) || 0) / (1024 * 1024);
        if (isVideo && mb > maxVideoMB) return `This video is ${Math.round(mb)} MB. The limit is ${maxVideoMB} MB.`;
        if (!isVideo && mb > maxImageMB) return `This image is ${Math.round(mb)} MB. The limit is ${maxImageMB} MB.`;
        return '';
    })();

    const upload = async () => {
        if (busy.current || !asset || problem) return;   // double tap par ek hi upload
        busy.current = true;
        setPhase('uploading'); setPct(0); setErr('');
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        try {
            const mime = asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');
            const form = new FormData();
            await appendFile(form, 'media', { uri: asset.uri, name: `status_${Date.now()}.${EXT[mime] || (isVideo ? 'mp4' : 'jpg')}`, type: mime });
            if (isVideo) {
                try {
                    const t = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 0, quality: 0.7 });
                    if (t?.uri) await appendFile(form, 'thumbnail', { uri: t.uri, name: `thumb_${Date.now()}.jpg`, type: 'image/jpeg' });
                } catch (e) { /* thumbnail na bane to bhi status chalega */ }
                if (asset.duration) form.append('duration', String(asset.duration));
            }
            form.append('mediaType', isVideo ? 'video' : 'image');
            form.append('clientStatusId', clientId.current);
            if (caption.trim()) form.append('content', caption.trim());

            const res = await apiService({
                method: 'POST', endpoint: 'status', data: form, isMultipart: true, signal: ctrl.signal,
                onUploadProgress: (e) => { if (e?.total) setPct(Math.min(99, Math.round((e.loaded / e.total) * 100))); },
            });
            if (ctrl.signal.aborted) { setPhase('idle'); return; }
            if (res?.success && res.data?.success) {
                setPct(100);
                onDone && onDone(res.data.status);
                onClose();
            } else {
                setPhase('error');
                setErr(res?.error?.message || (typeof res?.error === 'string' ? res.error : '') || 'Upload failed. Check your connection and retry.');
            }
        } catch (e) {
            if (ctrl.signal.aborted) setPhase('idle');
            else { setPhase('error'); setErr('Upload failed. Check your connection and retry.'); }
        } finally {
            busy.current = false;
        }
    };

    const cancelUpload = () => { abortRef.current?.abort(); setPhase('idle'); busy.current = false; };
    const close = () => { if (phase === 'uploading') cancelUpload(); onClose(); };

    if (!asset) return null;
    return (
        <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
            <StatusBar hidden />
            <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.preview}>
                    {isVideo ? <VideoPreview uri={asset.uri} /> : <Image source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />}
                </View>

                <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity onPress={close} style={styles.round}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
                    {isVideo && !!asset.duration && (
                        <View style={styles.pill}><Ionicons name="videocam" size={13} color="#fff" /><Text style={styles.pillText}>{Math.round(asset.duration)}s</Text></View>
                    )}
                </View>

                {!!problem && (
                    <View style={styles.problem}>
                        <Ionicons name="alert-circle" size={22} color="#ffb300" />
                        <Text style={styles.problemText}>{problem}</Text>
                        <TouchableOpacity onPress={onClose} style={[styles.btn, { backgroundColor: theme.main }]}><Text style={styles.btnText}>Choose another</Text></TouchableOpacity>
                    </View>
                )}

                <View style={[styles.bottom, { paddingBottom: 12 + insets.bottom }]}>
                    {phase === 'uploading' && (
                        <View style={styles.progressWrap}>
                            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: theme.main }]} /></View>
                            <Text style={styles.progressText}>Uploading… {pct}%</Text>
                        </View>
                    )}
                    {phase === 'error' && <Text style={styles.errText}>{err}</Text>}

                    <View style={styles.row}>
                        <TextInput
                            style={styles.input}
                            value={caption}
                            onChangeText={setCaption}
                            placeholder="Add a caption…"
                            placeholderTextColor="rgba(255,255,255,0.6)"
                            maxLength={maxCaption}
                            editable={phase !== 'uploading'}
                            multiline
                        />
                        {phase === 'uploading' ? (
                            <TouchableOpacity onPress={cancelUpload} style={[styles.sendBtn, { backgroundColor: '#e53935' }]}>
                                <Ionicons name="stop" size={20} color="#fff" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={upload} disabled={!!problem} style={[styles.sendBtn, { backgroundColor: theme.main }, !!problem && { opacity: 0.4 }]}>
                                {phase === 'error' ? <Ionicons name="refresh" size={22} color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    preview: { ...StyleSheet.absoluteFillObject },
    top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14 },
    round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
    pillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    problem: { position: 'absolute', left: 20, right: 20, top: '35%', backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 16, padding: 18, alignItems: 'center', gap: 10 },
    problemText: { color: '#fff', textAlign: 'center', fontSize: 14, lineHeight: 20 },
    btn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    btnText: { color: '#fff', fontWeight: '700' },
    bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingTop: 10, gap: 8 },
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    input: { flex: 1, color: '#fff', maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 8, fontSize: 15 },
    sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
    progressWrap: { gap: 4 },
    progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
    progressFill: { height: '100%' },
    progressText: { color: '#fff', fontSize: 12 },
    errText: { color: '#ff8a80', fontSize: 13 },
});
