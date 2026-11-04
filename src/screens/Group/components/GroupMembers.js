import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useState } from 'react';
import { getImageUrl } from './helpers';
import { useNameResolver } from '../../../services/nameResolver';


// Photo load na ho (broken/missing file) to initials wala gola dikhao — grey khali circle nahi
const MemberAvatar = ({ pic, initials, accent, style, fallbackStyle, textStyle }) => {
    const [broken, setBroken] = useState(false);
    if (pic && !broken) return <Image source={{ uri: pic }} style={style} onError={() => setBroken(true)} />;
    return (
        <View style={[style, fallbackStyle, { backgroundColor: accent + '22' }]}>
            <Text style={[textStyle, { color: accent }]}>{initials}</Text>
        </View>
    );
};

const GroupMembers = ({
    groupDetails,
    theme,
    MY_USER_ID,
    showAllMembers,
    setShowAllMembers,
    onAddMember,
    onRemoveMember,
    onAddAdmin,
    onRemoveAdmin,
}) => {
    const resolveName = useNameResolver();
   
    const { t } = useTranslation();
    const ManinAdmin = groupDetails?.isAdmin ?? false;                 // owner: admin banana/hatana
    const canManage = groupDetails?.canManage ?? ManinAdmin;           // owner + promoted admin: member jodna/hatana
    const checkUserRole = (memberId) => {
        const isInGroupAdminList = groupDetails?.groupAdmin?.some(
            (a) => String(a?._id) === String(memberId)
        );
        const isInAdminList = groupDetails?.admins?.some(
            (a) => String(a) === String(memberId)
        );
        console.log(' groupDetails?.admins_______________', groupDetails?.admins)
        if (isInGroupAdminList) {
            return 1;
        }
        if (isInAdminList) {
            return 2;
        }
        return 3;
    };

    const displayedMembers = showAllMembers
        ? groupDetails?.members || []
        : (groupDetails?.members || []).slice(0, 5);

    const handleMemberLongPress = (member) => {
        if (!canManage || checkUserRole(member._id) === 1) return;
        const isMemberAdmin = checkUserRole(member._id) === 2;
        // Promoted admin sirf normal member hata sakta hai; admin banana/hatana aur admin ko hatana owner ka kaam
        if (!ManinAdmin && isMemberAdmin) return;
        Alert.alert(
            resolveName(member).title,
            'Member ke liye action choose karein',
            [
                { text: 'Cancel', style: 'cancel' },
                ...(ManinAdmin ? [{
                    text: isMemberAdmin ? 'Remove Admin' : 'Make Admin',
                    onPress: () => isMemberAdmin ? onRemoveAdmin(member) : onAddAdmin(member),
                }] : []),
                {
                    text: 'Remove from Group',
                    style: 'destructive',
                    onPress: () => onRemoveMember(member),
                },
            ]
        );

    };

    const accent = theme.main || '#3498db';
    const dark = theme.mode === 'dark';
    const hairline = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const initials = (n) => String(n || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

    return (
        <View>
            <View style={styles.sectionHeader}>
                <View style={styles.titleRow}>
                    <View style={[styles.titleIcon, { backgroundColor: accent + '18' }]}>
                        <Ionicons name="people" size={16} color={accent} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Members</Text>
                </View>
                <View style={[styles.countPill, { backgroundColor: accent + '18' }]}>
                    <Text style={[styles.countText, { color: accent }]}>{groupDetails?.totalMembers || 0}</Text>
                </View>
            </View>
            {canManage && (
                <TouchableOpacity style={[styles.row, styles.rowBorder, { borderBottomColor: hairline }]} onPress={onAddMember} activeOpacity={0.7}>
                    <View style={[styles.iconCircle, { backgroundColor: accent }]}>
                        <Ionicons name="person-add" size={20} color="white" />
                    </View>
                    <Text style={[styles.shortcutText, { color: theme.text }]}>Add members</Text>
                </TouchableOpacity>
            )}
            {displayedMembers && displayedMembers.length > 0 && displayedMembers.map((member, idx) => {
                const role = checkUserRole(member._id);
                const r = resolveName(member);
                const pic = getImageUrl(member.profilePicture);
                const isLast = idx === displayedMembers.length - 1;
                const isMe = String(member._id) === String(MY_USER_ID);
                return (
                    <TouchableOpacity
                        key={member._id}
                        style={[styles.row, !isLast && styles.rowBorder, !isLast && { borderBottomColor: hairline }]}
                        onLongPress={() => handleMemberLongPress(member)}
                        activeOpacity={canManage ? 0.7 : 1}
                        delayLongPress={400}
                    >
                        <MemberAvatar
                            pic={pic}
                            initials={initials(r.isSaved ? r.title : (member.name || r.title))}
                            accent={accent}
                            style={styles.avatar}
                            fallbackStyle={styles.avatarFallback}
                            textStyle={styles.avatarInitial}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{r.title}{isMe ? '  (You)' : ''}</Text>
                            <Text style={styles.about} numberOfLines={1}>{r.isSaved ? member.mobile : r.subtitle}</Text>
                        </View>

                        <View style={styles.badges}>
                            {role === 1 && (
                                <View style={[styles.rolePill, { backgroundColor: accent }]}>
                                    <Ionicons name="shield-checkmark" size={11} color="#fff" />
                                    <Text style={[styles.roleText, { color: '#fff' }]}>{t('Group Admin')}</Text>
                                </View>
                            )}
                            {role === 2 && (
                                <View style={[styles.rolePill, { backgroundColor: accent + '18', borderColor: accent, borderWidth: 1 }]}>
                                    <Text style={[styles.roleText, { color: accent }]}>{t('Admin')}</Text>
                                </View>
                            )}
                            {role === 2 && ManinAdmin && (
                                <TouchableOpacity onPress={() => onRemoveAdmin(member)} style={styles.removeBtn}>
                                    <Ionicons name="close" size={15} color="#e74c3c" />
                                </TouchableOpacity>
                            )}
                            {role === 3 && canManage && (
                                <TouchableOpacity onPress={() => onRemoveMember(member)} style={styles.removeBtn}>
                                    <Ionicons name="close" size={15} color="#e74c3c" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </TouchableOpacity>
                );
            })}
            {(groupDetails?.totalMembers || 0) > 5 && (
                <TouchableOpacity
                    style={[styles.viewAllBtn, { backgroundColor: accent + '14' }]}
                    onPress={() => setShowAllMembers(!showAllMembers)}
                >
                    <Text style={[styles.viewAllText, { color: accent }]}>
                        {showAllMembers
                            ? 'Show less'
                            : `View all (${groupDetails.totalMembers - 5} more)`}
                    </Text>
                    <Ionicons name={showAllMembers ? 'chevron-up' : 'chevron-down'} size={15} color={accent} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
    titleRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
    titleIcon:      { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    sectionTitle:   { fontSize: 16, fontWeight: '700' },
    countPill:      { minWidth: 28, paddingHorizontal: 9, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    countText:      { fontSize: 13, fontWeight: '800' },
    row:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
    rowBorder:      { borderBottomWidth: StyleSheet.hairlineWidth },
    iconCircle:     { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    shortcutText:   { fontSize: 16, fontWeight: '600' },
    avatar:         { width: 46, height: 46, borderRadius: 23, marginRight: 14, backgroundColor: '#e6e6e6' },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarInitial:  { fontSize: 16, fontWeight: '800' },
    name:           { fontSize: 15.5, fontWeight: '700' },
    about:          { fontSize: 12.5, color: '#9f9f9f', marginTop: 2 },
    badges:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rolePill:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
    roleText:       { fontSize: 11.5, fontWeight: '800' },
    removeBtn:      { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(231,76,60,0.10)', alignItems: 'center', justifyContent: 'center' },
    viewAllBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 22, borderRadius: 18, alignSelf: 'center', marginTop: 8, marginBottom: 14 },
    viewAllText:    { fontWeight: '700', fontSize: 13.5 },
});

export default GroupMembers;
