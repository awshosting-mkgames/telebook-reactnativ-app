import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Config from '../../services/config';
import { useNameResolver } from '../../services/nameResolver';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const toImageUrl = (v) => (!v ? DEFAULT_AVATAR : /^(https?:|file:|data:)/.test(v) ? v : `${Config.MEDIA_URL}${v}`);

// Pure presentational — IncomingCallManager isko ek global overlay View ke
// andar render karta hai. Koi socket/navigation logic yahan nahi.
export default function IncomingCallOverlay({ caller, type, onAccept, onReject }) {
    const resolveName = useNameResolver();
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.15, duration: 700, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    return (
        <View style={styles.container}>
            <View style={styles.center}>
                <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulse }] }]} />
                <Image source={{ uri: toImageUrl(caller?.profilePicture) }} style={styles.avatar} />
                <Text style={styles.name} numberOfLines={1}>{caller?.mobile ? resolveName(caller).title : (caller?.name || 'Unknown')}</Text>
                {!!caller?.mobile && !resolveName(caller).isSaved && <Text style={styles.sub}>{resolveName(caller).subtitle}</Text>}
                <Text style={styles.sub}>{type === 'video' ? 'Incoming video call' : 'Incoming voice call'}</Text>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, styles.reject]} onPress={onReject} activeOpacity={0.85}>
                    <Ionicons name="call" size={28} color="#fff" style={styles.rejectIcon} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.accept]} onPress={onAccept} activeOpacity={0.85}>
                    <Ionicons name="call" size={28} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'rgba(10,15,20,0.97)', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 80 },
    center: { alignItems: 'center' },
    avatarRing: { position: 'absolute', top: -10, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(37,211,102,0.15)' },
    avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#333' },
    name: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 18 },
    sub: { color: '#cfd8dc', fontSize: 15, marginTop: 6 },
    actions: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', paddingHorizontal: 50 },
    btn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', elevation: 6 },
    reject: { backgroundColor: '#e53935' },
    rejectIcon: { transform: [{ rotate: '135deg' }] },
    accept: { backgroundColor: '#2ecc71' },
});
