import { Image, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { badgeTextColor } from '../services/badgeConfig';
import { badgeImageFor } from '../utils/badgeImages';

// Profile par plan badge: image + label. Tap par onPress (profile se Plans screen).
export default function PlanBadge({ badge, onPress, fallbackColor = '#0084ff' }) {
    if (!badge?.profileLabel) return null;
    const color = badge.color || fallbackColor;
    const img = badgeImageFor(badge);
    return (
        <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.pill, { backgroundColor: color }]}>
            {!!img && <Image source={img} style={styles.img} resizeMode="contain" />}
            <Text style={[styles.text, { color: badgeTextColor(color) }]} numberOfLines={1}>{badge.profileLabel}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 6, paddingRight: 12, borderRadius: 16, marginTop: 8, alignSelf: 'center' },
    img: { width: 22, height: 22 },
    text: { fontSize: 12, fontWeight: '700' },
});
