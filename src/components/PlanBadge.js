import { Image, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { badgeTextColor } from '../services/badgeConfig';
import { BADGE_BORDER_WIDTH, BADGE_ICON_SIZE, badgeStyleFor } from '../utils/badgeImages';

// Profile par plan badge: [icon] + badge naam, bold rangeen border. Tap par onPress (Plans screen).
// Rang/border/icon sab utils/badgeImages.js (BADGE_STYLES) se.
export default function PlanBadge({ badge, onPress, fallbackColor = '#0084ff' }) {
    if (!badge?.profileLabel && !badge?.label) return null;
    const st = badgeStyleFor(badge);
    if (st) {
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPress}
                style={[styles.pill, { borderColor: st.border, backgroundColor: st.bg, borderWidth: BADGE_BORDER_WIDTH }]}
            >
                <Image source={st.icon} style={styles.icon} resizeMode="contain" />
                <Text style={[styles.text, { color: st.text }]} numberOfLines={1}>{st.name}</Text>
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
    icon: { width: BADGE_ICON_SIZE, height: BADGE_ICON_SIZE },
    text: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
});
