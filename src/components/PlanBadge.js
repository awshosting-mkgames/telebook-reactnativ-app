import { Image, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { badgeTextColor } from '../services/badgeConfig';
import { BADGE_ASPECT, BADGE_BORDER_WIDTH, badgeImageFor } from '../utils/badgeImages';

// Profile par plan badge: [icon] + badge naam, bold rangeen border. Tap par onPress (Plans screen).
// Rang/border/icon sab utils/badgeImages.js (BADGE_STYLES) se.
export default function PlanBadge({ badge, onPress, fallbackColor = '#0084ff' }) {
    if (!badge?.profileLabel && !badge?.label) return null;
    const img = badgeImageFor(badge);
    if (img) {
        // Poora badge artwork (icon + naam) — border/alag text nahi
        return (
            <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.imgWrap}>
                <Image source={img} style={styles.img} resizeMode="contain" />
            </TouchableOpacity>
        );
    }
    // Unknown tier (admin ka custom badge): purana simple pill
    const color = badge.color || fallbackColor;
    return (
        <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.pill, { backgroundColor: color, borderColor: color, borderWidth: BADGE_BORDER_WIDTH }]}>
            <Text style={[styles.text, { color: badgeTextColor(color) }]} numberOfLines={1}>{badge.profileLabel || badge.label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingLeft: 8, paddingRight: 16, borderRadius: 22, marginTop: 8, alignSelf: 'center' },
    imgWrap: { marginTop: 8, alignSelf: 'center' },
    img: { width: 140, height: 140 / BADGE_ASPECT },
    text: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
});
