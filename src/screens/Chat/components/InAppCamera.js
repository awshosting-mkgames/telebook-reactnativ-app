import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FLASH_ORDER = ['off', 'on', 'auto'];
const FLASH_ICON = { off: 'flash-off', on: 'flash', auto: 'flash-outline' };

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/**
 * Chat ka apna camera (system camera ka UI badla nahi ja sakta, isliye Gallery button usme nahi tha).
 * Photo + video, flash, front/back flip, aur neeche DAAYEN kone me Gallery button.
 *   onCaptured({ uri, type: 'image'|'video', mimeType, fileName })
 *   onOpenGallery() — camera band hota hai, Chat gallery picker (multi-select) kholta hai
 */
export default function InAppCamera({ visible, onClose, onCaptured, onOpenGallery }) {
    const insets = useSafeAreaInsets();
    const camRef = useRef(null);
    const timerRef = useRef(null);
    const [camPerm, requestCam] = useCameraPermissions();
    const [micPerm, requestMic] = useMicrophonePermissions();
    const [facing, setFacing] = useState('back');
    const [flash, setFlash] = useState('off');
    const [mode, setMode] = useState('picture'); // picture | video
    const [recording, setRecording] = useState(false);
    const [secs, setSecs] = useState(0);
    const [busy, setBusy] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (visible && camPerm && !camPerm.granted && camPerm.canAskAgain) requestCam();
    }, [visible, camPerm]);
    useEffect(() => {
        if (visible) { setMode('picture'); setRecording(false); setSecs(0); setReady(false); }
        return () => clearInterval(timerRef.current);
    }, [visible]);

    const switchMode = async (m) => {
        if (recording) return;
        if (m === 'video' && micPerm && !micPerm.granted) await requestMic();
        setMode(m);
    };

    const takePhoto = async () => {
        if (busy || !camRef.current) return;
        setBusy(true);
        try {
            const pic = await camRef.current.takePictureAsync({ quality: 0.8, skipProcessing: false });
            if (pic?.uri) onCaptured?.({ uri: pic.uri, type: 'image', mimeType: 'image/jpeg', fileName: `photo_${Date.now()}.jpg` });
        } catch (e) { console.log('takePicture error:', e?.message); }
        setBusy(false);
    };

    const toggleRecord = async () => {
        if (!camRef.current) return;
        if (recording) { camRef.current.stopRecording(); return; }
        setRecording(true); setSecs(0);
        timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
        try {
            const vid = await camRef.current.recordAsync(); // stopRecording par resolve hota hai
            if (vid?.uri) onCaptured?.({ uri: vid.uri, type: 'video', mimeType: 'video/mp4', fileName: `video_${Date.now()}.mp4` });
        } catch (e) { console.log('recordAsync error:', e?.message); }
        clearInterval(timerRef.current);
        setRecording(false);
    };

    const onShutter = () => (mode === 'picture' ? takePhoto() : toggleRecord());

    const close = () => { if (recording) camRef.current?.stopRecording?.(); onClose?.(); };

    const renderBody = () => {
        if (!camPerm) return <View style={styles.fill} />;
        if (!camPerm.granted) {
            return (
                <View style={[styles.fill, styles.center]}>
                    <Ionicons name="camera-outline" size={44} color="#fff" />
                    <Text style={styles.permText}>Camera permission chahiye</Text>
                    <TouchableOpacity style={styles.permBtn} onPress={requestCam}><Text style={styles.permBtnText}>Allow</Text></TouchableOpacity>
                </View>
            );
        }
        return (
            <CameraView
                ref={camRef}
                style={styles.fill}
                facing={facing}
                flash={flash}
                mode={mode}
                onCameraReady={() => setReady(true)}
            />
        );
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
            <StatusBar hidden />
            <View style={styles.root}>
                {renderBody()}

                {/* Top bar */}
                <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity onPress={close} style={styles.roundBtn}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
                    {recording ? <View style={styles.recPill}><View style={styles.recDot} /><Text style={styles.recText}>{fmt(secs)}</Text></View> : <View />}
                    <TouchableOpacity onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} style={styles.roundBtn} disabled={recording}>
                        <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Bottom controls: flash | shutter | GALLERY (bottom-right) */}
                <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
                    <View style={styles.modeRow}>
                        {[['picture', 'PHOTO'], ['video', 'VIDEO']].map(([m, label]) => (
                            <TouchableOpacity key={m} onPress={() => switchMode(m)} disabled={recording}>
                                <Text style={[styles.modeText, mode === m && styles.modeActive]}>{label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.controls}>
                        <TouchableOpacity
                            onPress={() => setFlash((f) => FLASH_ORDER[(FLASH_ORDER.indexOf(f) + 1) % FLASH_ORDER.length])}
                            style={styles.sideBtn} disabled={mode === 'video'}
                        >
                            <Ionicons name={FLASH_ICON[flash]} size={26} color={mode === 'video' ? '#888' : '#fff'} />
                            {mode !== 'video' && <Text style={styles.sideLabel}>{flash}</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onShutter} disabled={!ready || busy} activeOpacity={0.8}
                            style={[styles.shutterOuter, mode === 'video' && { borderColor: '#ff3b30' }]}>
                            {busy ? <ActivityIndicator color="#000" />
                                : <View style={[styles.shutterInner, mode === 'video' && styles.shutterVideo, recording && styles.shutterStop]} />}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { if (!recording) onOpenGallery?.(); }} style={styles.sideBtn}>
                            <View style={styles.galleryIcon}><Ionicons name="images" size={22} color="#fff" /></View>
                            <Text style={styles.sideLabel}>Gallery</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    fill: { ...StyleSheet.absoluteFillObject },
    center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
    permText: { color: '#fff', fontSize: 15 },
    permBtn: { backgroundColor: '#1296f3', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20 },
    permBtnText: { color: '#fff', fontWeight: '600' },
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
    roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
    recPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#ff3b30' },
    recText: { color: '#fff', fontWeight: '600' },
    bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.25)', paddingTop: 10 },
    modeRow: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginBottom: 12 },
    modeText: { color: '#bbb', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
    modeActive: { color: '#ffd400' },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28 },
    sideBtn: { width: 64, alignItems: 'center', gap: 4 },
    sideLabel: { color: '#fff', fontSize: 11 },
    galleryIcon: { width: 44, height: 44, borderRadius: 10, borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    shutterOuter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
    shutterVideo: { backgroundColor: '#ff3b30' },
    shutterStop: { width: 30, height: 30, borderRadius: 6 },
});
