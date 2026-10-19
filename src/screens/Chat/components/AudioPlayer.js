import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef } from 'react';
import {
    ActivityIndicator, Alert,
    Animated,
    Dimensions,
    StyleSheet,
    Text, TouchableOpacity,
    View,
} from 'react-native';
import { claimPlayback, useExclusivePlayback } from '../../../utils/playbackManager';

const { width: SCREEN_W } = Dimensions.get('window');

const AudioPlayer = ({ url }) => {
    // expo-audio ka player. Source badalne par hook khud naya player bana deta hai
    // aur purana unload ho jata hai — manual cleanup ki zarurat nahi.
    const player = useAudioPlayer(url ? { uri: url } : null);
    const status = useAudioPlayerStatus(player);
    const progressAnim = useRef(new Animated.Value(0)).current;

    // Koi dusra audio/video chale to ye apne aap ruk jaye
    useExclusivePlayback(player);

    // expo-audio seconds mein kaam karta hai (expo-av milliseconds mein karta tha)
    const position = status?.currentTime ?? 0;
    const duration = status?.duration ?? 0;
    const isPlaying = status?.playing ?? false;
    const loading = !!url && !status?.isLoaded;

    useEffect(() => {
        const prog = duration > 0 ? Math.min(1, position / duration) : 0;
        Animated.timing(progressAnim, { toValue: prog, duration: 100, useNativeDriver: false }).start();
    }, [position, duration, progressAnim]);

    // Loop kabhi nahi — explicitly false (kuch platform par purana loop flag reh jata tha)
    useEffect(() => {
        try { player.loop = false; } catch (e) { /* player release ho chuka */ }
    }, [player]);

    // Jab audio khud khatam ho jaye to pehle pause, phir cursor shuruat par. Dubara
    // sirf user ke play tap par chalega (auto-replay loop bug fix).
    useEffect(() => {
        if (status?.didJustFinish) {
            try {
                player.pause();
                player.loop = false;
                Promise.resolve(player.seekTo(0)).catch(() => { });
            } catch (e) { /* player release ho chuka */ }
            progressAnim.setValue(0);
        }
    }, [status?.didJustFinish, player, progressAnim]);

    const fmt = (secs) => {
        const s = Math.floor(secs ?? 0);
        return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    };

    const togglePlay = async () => {
        try {
            if (isPlaying) {
                player.pause();
                return;
            }
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
            // Agar audio end par pahunch gaya tha, to shuru se play karein
            if (duration > 0 && position >= duration - 0.1) {
                await player.seekTo(0);
            }
            claimPlayback(player); // pehle se baj raha koi bhi player band karo
            player.play();
        } catch (e) {
            Alert.alert('Error', 'Audio play nahi ho saka');
            console.log(e);
        }
    };

    const barWidth = SCREEN_W * 0.42;

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.playBtn} onPress={togglePlay} disabled={loading}>
                {loading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />}
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={async (e) => {
                        if (duration > 0) {
                            const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / barWidth));
                            await player.seekTo(ratio * duration);
                        }
                    }}
                    style={[styles.trackBg, { width: barWidth }]}
                >
                    <View style={styles.waveRow} pointerEvents="none">
                        {[3,5,8,6,9,7,4,8,5,6,9,7,5,8,6,4,7,9,5,6].map((h, i) =>
                            <View key={i} style={[styles.waveBar, { height: h * 2 }]} />)}
                    </View>
                    <Animated.View
                        pointerEvents="none"
                        style={[styles.progressOverlay, {
                            width: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, barWidth],
                            }),
                        }]}
                    />
                </TouchableOpacity>

                <Text style={styles.timeText}>
                    {fmt(position > 0 ? position : duration)}
                    {duration > 0 && position > 0 ? ` / ${fmt(duration)}` : ''}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 4, minWidth: 220 },
    playBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1296f3', alignItems: 'center', justifyContent: 'center', elevation: 2 },
    trackBg:         { height: 28, backgroundColor: '#e0eeff', borderRadius: 6, overflow: 'hidden', justifyContent: 'center', position: 'relative' },
    waveRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 2, position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 1 },
    waveBar:         { width: 3, borderRadius: 2, backgroundColor: '#90c8f8' },
    progressOverlay: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#1296f360', borderRadius: 6, zIndex: 2 },
    timeText:        { fontSize: 10, color: '#666', marginTop: 2, marginLeft: 2 },
});

export default AudioPlayer;
