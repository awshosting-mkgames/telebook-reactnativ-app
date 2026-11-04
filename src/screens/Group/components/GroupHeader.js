import { Ionicons } from '@expo/vector-icons';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { getImageUrl } from './helpers';

// Group ka hero: bada avatar (theme ring), naam (tap = edit), member count aur quick actions.
const GroupHeader = ({ groupDetails, theme, onImagePress, onViewImage, onNamePress, onAddMember, canManage, isLocked, onToggleLock }) => {
    const accent = theme.main || '#3498db';
    const dark = theme.mode === 'dark';
    const uri = getImageUrl(groupDetails?.groupIcon);
    const name = groupDetails?.chatName || 'Group';
    const subBg = dark ? 'rgba(255,255,255,0.08)' : accent + '14';
    const actionBg = dark ? 'rgba(255,255,255,0.08)' : accent + '12';

    return (
        <View style={styles.wrap}>
            <TouchableOpacity onPress={uri ? onViewImage : (canManage ? onImagePress : undefined)} disabled={!uri && !canManage} activeOpacity={0.85} style={[styles.ring, { borderColor: accent }]}>
                {uri ? (
                    <Image source={{ uri }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: accent }]}>
                        <Text style={styles.avatarInitial}>{name.trim().charAt(0).toUpperCase()}</Text>
                    </View>
                )}
                {canManage && (
                    <TouchableOpacity onPress={onImagePress} activeOpacity={0.8} style={[styles.cameraBadge, { backgroundColor: accent, borderColor: dark ? '#1a1a1a' : '#fff' }]}>
                        <Ionicons name="camera" size={15} color="#fff" />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={canManage ? onNamePress : undefined} disabled={!canManage} style={styles.nameRow} activeOpacity={0.7}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>{name}</Text>
                {canManage && <Ionicons name="pencil" size={16} color={accent} style={{ marginLeft: 8 }} />}
            </TouchableOpacity>

            <View style={[styles.subChip, { backgroundColor: subBg }]}>
                <Ionicons name="people" size={14} color={accent} />
                <Text style={[styles.subText, { color: accent }]}>
                    Group · {groupDetails?.totalMembers || 0} members
                </Text>
            </View>

            {canManage && (
                <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: actionBg }]} onPress={onAddMember} activeOpacity={0.8}>
                        <Ionicons name="person-add" size={20} color={accent} />
                        <Text style={[styles.actionLabel, { color: accent }]}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: actionBg }]} onPress={onToggleLock} activeOpacity={0.8}>
                        <Ionicons name={isLocked ? 'lock-open-outline' : 'lock-closed-outline'} size={20} color={accent} />
                        <Text style={[styles.actionLabel, { color: accent }]}>{isLocked ? 'Unlock' : 'Lock'}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap:           { alignItems: 'center', paddingTop: 22, paddingBottom: 20, paddingHorizontal: 20 },
    ring:           { width: 124, height: 124, borderRadius: 62, borderWidth: 3, padding: 4, alignItems: 'center', justifyContent: 'center' },
    avatar:         { width: 110, height: 110, borderRadius: 55, backgroundColor: '#e6e6e6' },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarInitial:  { color: '#fff', fontSize: 44, fontWeight: '700' },
    cameraBadge:    { position: 'absolute', bottom: 2, right: 2, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
    nameRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 14, maxWidth: '92%' },
    name:           { fontSize: 22, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
    subChip:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
    subText:        { fontSize: 13, fontWeight: '700' },
    actionRow:      { flexDirection: 'row', gap: 12, marginTop: 18 },
    actionBtn:      { minWidth: 92, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16, alignItems: 'center', gap: 4 },
    actionLabel:    { fontSize: 12, fontWeight: '700' },
});

export default GroupHeader;
