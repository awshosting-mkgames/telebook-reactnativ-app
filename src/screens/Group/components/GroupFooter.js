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
const GroupFooter = ({ theme, isAdmin, isLocked, onExitGroup, onDeleteGroup, onPriveChat, onToggleLock }) => (
    <View>

        {/* ── Lock / Unlock Chat (admin only) ── */}
        {isAdmin && (
            <TouchableOpacity style={styles.item} onPress={onToggleLock}>
                <View style={[styles.iconCircle, { backgroundColor: isLocked ? '#f39c12' : '#27ae60' }]}>
                    <Ionicons
                        name={isLocked ? 'lock-open-outline' : 'lock-closed-outline'}
                        size={18}
                        color="#fff"
                    />
                </View>
                <Text style={[styles.text, { color: theme.text }]}>
                    {isLocked ? 'Unlock Chat' : 'Lock Chat'}
                </Text>
                {isLocked && (
                    <View style={styles.lockedBadge}>
                        <Text style={styles.lockedBadgeText}>LOCKED</Text>
                    </View>
                )}
            </TouchableOpacity>
        )}

        {/* Lock indicator for non-admins (read-only) */}
        {!isAdmin && isLocked && (
            <View style={[styles.item, styles.lockedBanner]}>
                <View style={[styles.iconCircle, { backgroundColor: '#f39c12' }]}>
                    <Ionicons name="lock-closed" size={18} color="#fff" />
                </View>
                <Text style={[styles.text, { color: '#f39c12' }]}>Chat Locked by Admin</Text>
            </View>
        )}

        {/* ── Admin → Delete Group | Member → Exit Group ── */}
        {isAdmin ? (
            <TouchableOpacity style={styles.item} onPress={onDeleteGroup}>
                <View style={[styles.iconCircle, { backgroundColor: '#e74c3c' }]}>
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                </View>
                <Text style={[styles.text, { color: '#e74c3c' }]}>Delete Group</Text>
            </TouchableOpacity>
        ) : (
            <TouchableOpacity style={styles.item} onPress={onExitGroup}>
                <View style={[styles.iconCircle, { backgroundColor: '#e74c3c' }]}>
                    <MaterialCommunityIcons name="exit-to-app" size={18} color="#fff" />
                </View>
                <Text style={[styles.text, { color: '#e74c3c' }]}>Exit Group</Text>
            </TouchableOpacity>
        )}
    </View>
);

const styles = StyleSheet.create({
    item:            { flexDirection: 'row', padding: 12, alignItems: 'center', marginBottom: 5 },
    iconCircle:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3498db', marginRight: 8 },
    text:            { fontSize: 17, fontWeight: '600', marginLeft: 8, flex: 1 },
    lockedBadge:     { backgroundColor: '#fff3cd', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#f39c12' },
    lockedBadgeText: { color: '#f39c12', fontSize: 11, fontWeight: '700' },
    lockedBanner:    { backgroundColor: '#fff8f0' },
});

export default GroupFooter;
