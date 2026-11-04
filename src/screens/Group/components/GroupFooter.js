import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Props:
 *  theme        – ThemeContext theme
 *  isAdmin      – boolean, is current user admin?
 *  isLocked     – boolean, is chat locked?
 *  onExitGroup  – handler for non-admin exit
 *  onDeleteGroup– handler for admin delete
 *  onPriveChat  – handler for private chat
 *  onToggleLock – NEW: handler for lock / unlock
 */
const GroupFooter = ({ theme, isAdmin, canManage = isAdmin, isLocked, onExitGroup, onDeleteGroup, onPriveChat, onToggleLock }) => {
    const accent = theme.main || '#3498db';
    const dark = theme.mode === 'dark';
    const hairline = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const Row = ({ icon, color, label, onPress, right, last, labelColor }) => (
        <TouchableOpacity style={[styles.item, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: hairline }]} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.iconCircle, { backgroundColor: color + '1F' }]}>{icon}</View>
            <Text style={[styles.text, { color: labelColor || theme.text }]}>{label}</Text>
            {right}
        </TouchableOpacity>
    );

    return (
        <View>
            {/* ── Lock / Unlock Chat (owner + admin) ── */}
            {canManage && (
                <Row
                    color={isLocked ? '#f39c12' : accent}
                    icon={<Ionicons name={isLocked ? 'lock-open-outline' : 'lock-closed-outline'} size={19} color={isLocked ? '#f39c12' : accent} />}
                    label={isLocked ? 'Unlock Chat' : 'Lock Chat (only admins can send)'}
                    onPress={onToggleLock}
                    right={isLocked ? (
                        <View style={styles.lockedBadge}><Text style={styles.lockedBadgeText}>LOCKED</Text></View>
                    ) : <Ionicons name="chevron-forward" size={16} color="#9f9f9f" />}
                />
            )}

            {/* Lock indicator for non-admins (read-only) */}
            {!canManage && isLocked && (
                <View style={[styles.item, styles.lockedBanner]}>
                    <View style={[styles.iconCircle, { backgroundColor: '#f39c1226' }]}>
                        <Ionicons name="lock-closed" size={18} color="#f39c12" />
                    </View>
                    <Text style={[styles.text, { color: '#f39c12' }]}>Chat Locked by Admin</Text>
                </View>
            )}

            {/* ── Owner → Delete Group | Member / Admin → Exit Group ── */}
            {isAdmin ? (
                <Row
                    last
                    color="#e74c3c"
                    labelColor="#e74c3c"
                    icon={<Ionicons name="trash-outline" size={19} color="#e74c3c" />}
                    label="Delete Group"
                    onPress={onDeleteGroup}
                />
            ) : (
                <Row
                    last
                    color="#e74c3c"
                    labelColor="#e74c3c"
                    icon={<MaterialCommunityIcons name="exit-to-app" size={20} color="#e74c3c" />}
                    label="Exit Group"
                    onPress={onExitGroup}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    item:            { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
    iconCircle:      { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    text:            { fontSize: 15.5, fontWeight: '600', flex: 1 },
    lockedBadge:     { backgroundColor: '#fff3cd', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#f39c12' },
    lockedBadgeText: { color: '#f39c12', fontSize: 11, fontWeight: '700' },
    lockedBanner:    { backgroundColor: 'rgba(243,156,18,0.08)' },
});

export default GroupFooter;
