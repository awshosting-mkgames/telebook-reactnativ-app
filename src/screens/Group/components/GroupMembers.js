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
import { getImageUrl } from './helpers';


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
   
    const { t } = useTranslation();
    const ManinAdmin = groupDetails?.isAdmin ?? false;
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
        if(checkUserRole(member._id) === 1) return;
        const isMemberAdmin = checkUserRole(member._id) === 2;
        Alert.alert(
            member.name || member.mobile || 'User',
            'Member ke liye action choose karein',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isMemberAdmin ? 'Remove Admin' : 'Make Admin',
                    onPress: () => isMemberAdmin ? onRemoveAdmin(member) : onAddAdmin(member),
                },
                {
                    text: 'Remove from Group',
                    style: 'destructive',
                    onPress: () => onRemoveMember(member),
                },
            ]
        );

    };

    return (
        <View>
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    {groupDetails?.totalMembers || 0} members
                </Text>
            </View>
            {ManinAdmin && (
                <>
                    <TouchableOpacity style={styles.row} onPress={onAddMember}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="person-add" size={20} color="white" />
                        </View>
                        <Text style={[styles.shortcutText, { color: theme.text }]}>Add members</Text>
                    </TouchableOpacity>

                   
                </>
            )}
            {displayedMembers && displayedMembers.length > 0&& displayedMembers.map((member) => {
                const canManage     = ManinAdmin;
                const role = checkUserRole(member._id);
                return (
                    <TouchableOpacity
                        key={member._id}
                        style={styles.row}
                        onLongPress={() => handleMemberLongPress(member)}
                        activeOpacity={canManage ? 0.7 : 1}
                        delayLongPress={400}
                    >
                        <Image
                            source={{
                                uri: getImageUrl(member.profilePicture)
                                    || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || member.mobile || '?')}&background=3498db&color=fff&size=100`,
                            }}
                            style={styles.avatar}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.name, { color: theme.text }]}>{member.name || member.mobile || 'User'}</Text>
                            <Text style={styles.about} numberOfLines={1}>{member.mobile}</Text>
                        </View>

                        <View style={styles.badges}>
                            {role===1 && (
                                <View style={[styles.adminBadge, { backgroundColor: theme.batchColor }]}>
                                    <Text style={styles.adminText}>{t('Group Admin')}</Text>
                                </View>
                            )}
                            {role===2 && (
                                <View style={[styles.adminBadge, { backgroundColor: theme.batchColor }]}>
                                    <Text style={styles.adminText}>{t('Admin')}</Text>
                                </View>
                            )}
                            {role === 2  && (
                               
                                 <TouchableOpacity onPress={() => onRemoveAdmin(member)} style={styles.removeBtn} >
                                    <Ionicons name="close" size={16} color="#e74c3c" />
                                </TouchableOpacity>
                            )}
                            {role === 3 && (
                                <TouchableOpacity  onPress={() => onRemoveMember(member)} style={styles.removeBtn} >
                                    <Ionicons name="close" size={16} color="#e74c3c" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </TouchableOpacity>
                );
            })}
            {(groupDetails?.totalMembers || 0) > 5 && (
                <TouchableOpacity
                    style={[styles.viewAllBtn, { backgroundColor: theme.batchColor }]}
                    onPress={() => setShowAllMembers(!showAllMembers)}
                >
                    <Text style={styles.viewAllText}>
                        {showAllMembers
                            ? 'Show less'
                            : `View all (${groupDetails.totalMembers - 5} more)`}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    sectionHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
    sectionTitle:         { fontSize: 17, fontWeight: '500' },
    row:                  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 },
    iconCircle:           { width: 46, height: 46, borderRadius: 23, backgroundColor: '#3498db', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    shortcutText:         { fontSize: 16, fontWeight: '500' },
    avatar:               { width: 46, height: 46, borderRadius: 23, marginRight: 15, backgroundColor: '#eee' },
    name:                 { fontSize: 16, fontWeight: '600' },
    about:                { fontSize: 13, color: '#9f9f9f', marginTop: 2 },
    badges:               { flexDirection: 'row', alignItems: 'center', gap: 8 },
    adminBadge:           { backgroundColor: '#e1f5fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
    adminText:            { color: '#3498db', fontSize: 12, fontWeight: '700' },
    adminToggleBtn:       { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee' },
    adminToggleBtnActive: { backgroundColor: '#e8f4fd', borderColor: '#3498db' },
    removeBtn:            { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fdd' },
    viewAllBtn:           { paddingVertical: 10, paddingHorizontal: 25, borderRadius: 20, alignSelf: 'center', marginVertical: 15 },
    viewAllText:          { color: '#3498db', fontWeight: '500', fontSize: 14 },
});

export default GroupMembers;
