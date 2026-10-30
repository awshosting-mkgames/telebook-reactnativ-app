import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import { useNameResolver } from '../../services/nameResolver';

// ── Components ────────────────────────────────────────────────────────────────
import AddMemberModal from './components/AddMemberModal';
import EditNamePopup from './components/EditNamePopup';
import GroupFooter from './components/GroupFooter';
import GroupHeader from './components/GroupHeader';
import GroupMedia from './components/GroupMedia';
import GroupMembers from './components/GroupMembers';
import { getImageUrl } from './components/helpers';
import MediaSlider from './components/MediaSlider';
import { appendFile } from '../../utils/uploadFile';

export default function GroupScreen({ navigation, route }) {
    const resolveName = useNameResolver();
    const { chatId } = route.params;
    const { theme }  = useContext(ThemeContext);

    const maniAllData = useSelector((state) => state.totalappData);
    const MY_USER_ID  = maniAllData?.userId ?? '';

    const [groupDetails,    setGroupDetails]    = useState(null);
    const [mediaDetails,    setMediaDetails]    = useState(null);
    const [loading,         setLoading]         = useState(true);
    const [showAllMembers,  setShowAllMembers]  = useState(false);
    const [editNameVisible,  setEditNameVisible]  = useState(false);
    const [mediaSliderIdx,   setMediaSliderIdx]   = useState(null);
    const [addMemberVisible, setAddMemberVisible] = useState(false);


    useEffect(() => { fetchGroupDetails(); }, []);

    const fetchGroupDetails = async () => {
        try {
            setLoading(true);
            const res = await apiService({ method: 'GET', endpoint: `chats/group/${chatId}/info` });
            if (res?.success) {
                setGroupDetails(res?.data?.group);
                setMediaDetails(res?.data?.media);
            }
        } catch (e) {
            console.error('Group fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const checkUserRole = (groupDetails,memberId) => {
        const isInGroupAdminList = groupDetails?.groupAdmin?.some(
            (a) => String(a?._id) === String(memberId)
        );
        const isInAdminList = groupDetails?.admins?.some(
            (a) => String(a) === String(memberId)
        );
        if (isInGroupAdminList) {
            return true;
        }
        if (isInAdminList) {
            return true;
        }
        return 3;
    };

    // 1. Rename group
    const handleSaveName = async (newName) => {
        try {
            const res = await apiService({
                method:   'PUT',
                endpoint: 'chats/group/rename',
                data:     { chatId, chatName: newName },
            });
            if (res?.success) {
                setGroupDetails(prev => ({ ...prev, chatName: newName }));
                setEditNameVisible(false);
            } else {
                Alert.alert('Error', res?.message || 'Name update nahi hua');
            }
        } catch (e) { Alert.alert('Error', e.message); }
    };

    // 2. Change group image
    const handleChangeImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return Alert.alert('Permission chahiye', 'Gallery allow karo');

        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality:    0.8,
        });
        if (res.canceled) return;

        try {
            const asset = res.assets[0];
            const fd    = new FormData();
            fd.append('chatId',    chatId);
            await appendFile(fd, 'groupIcon', {
                ...asset,
                name: `group_${Date.now()}.jpg`,
                type: 'image/jpeg',
            });
            const apiRes = await apiService({
                method:   'PUT',
                endpoint: 'chats/group/update',
                data:     fd,
                isMultipart: true,
            });
            if (apiRes?.success) {
                setGroupDetails(prev => ({ ...prev, groupIcon: apiRes?.data?.groupIcon || prev.groupIcon }));
                Alert.alert('Done', 'Group photo update ho gaya!');
            } else {
                Alert.alert('Error', apiRes?.message || 'Photo update nahi hui');
            }
        } catch (e) { Alert.alert('Error', e.message); }
    };

    // 3. Remove member
    const handleRemoveMember = (member) => {
        Alert.alert(
            'Remove Member',
            `${resolveName(member).title} ko group se remove karein?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove', style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await apiService({
                                method:   'PUT',
                                endpoint: 'chats/group/remove',
                                data:     { chatId, userId: member._id },
                            });
                            if (res?.success) {
                                setGroupDetails(prev => ({
                                    ...prev,
                                    members:      prev.members.filter(m => m._id !== member._id),
                                    totalMembers: (prev.totalMembers || 1) - 1,
                                }));
                            } else {
                                Alert.alert('Error', res?.message || 'Remove nahi hua');
                            }
                        } catch (e) { Alert.alert('Error', e.message); }
                    },
                },
            ]
        );
    };

    // 4. Exit group
    const handleExitGroup = () => {
        Alert.alert(
            'Exit Group',
            `"${groupDetails?.chatName}" group leave karein?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Exit', style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await apiService({
                                method: 'PUT', endpoint: 'chats/group/leave', data: { chatId },
                            });
                            if (res?.success) navigation.goBack();
                            else Alert.alert('Error', res?.message || 'Leave nahi hua');
                        } catch (e) { Alert.alert('Error', e.message); }
                    },
                },
            ]
        );
    };

    // 5. Delete group (admin only)
    const handleDeleteGroup = () => {
        Alert.alert(
            'Delete Group',
            `"${groupDetails?.chatName}" permanently delete ho jaayega. Sure hain?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await apiService({
                                method: 'DELETE', endpoint: `chats/${chatId}`,
                            });
                            if (res?.success) navigation.goBack();
                            else Alert.alert('Error', res?.message || 'Delete nahi hua');

                        } catch (e) { Alert.alert('Error', e.message); }
                    },
                },
            ]
        );
    };

    // 6. Private chat (placeholder — same DELETE for now)
    const onPriveChat = async () => {
        try {
            const res = await apiService({
                method: 'DELETE', endpoint: `chats/${chatId}`,
            });
            if (res?.success) navigation.goBack();
            else Alert.alert('Error', res?.message || 'Delete nahi hua');
        } catch (e) { Alert.alert('Error', e.message); }
    };

    // ── NEW: 7. Add Admin ──────────────────────────────────────────────────────
    const handleAddAdmin = (member) => {
        Alert.alert(
            'Make Admin',
            `${resolveName(member).title} ko admin banana chahte hain?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Make Admin',
                    onPress: async () => {
                        try {
                            const res = await apiService({
                                method:   'PUT',
                                endpoint: 'chats/group/add-admin',
                                data:     { chatId, userId: member._id },
                            });
                            if (res?.success) {
                               fetchGroupDetails();
                                setGroupDetails(prev => ({
                                    ...prev,
                                    admins: [...(prev.admins || []), { _id: member._id, name: member.name }],
                                }));
                                Alert.alert('Done', `${resolveName(member).title} ab admin hai!`);
                            } else {
                                Alert.alert('Error', res?.message || 'Admin nahi ban saka');
                            }
                        } catch (e) { Alert.alert('Error', e.message); }
                    },
                },
            ]
        );
    };

    // ── NEW: 8. Remove Admin ───────────────────────────────────────────────────
    const handleRemoveAdmin = (member) => {
        Alert.alert(
            'Remove Admin',
            `${resolveName(member).title} ki admin rights hatana chahte hain?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove Admin', style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await apiService({
                                method:   'PUT',
                                endpoint: 'chats/group/remove-admin',
                                data:     { chatId, userId: member._id },
                            });
                         
                            if (res?.success) {
                                fetchGroupDetails();
                                setGroupDetails(prev => ({
                                    ...prev,
                                    admins: (prev.admins || []).filter(a => a._id !== member._id),
                                }));
                                Alert.alert('Done', `${resolveName(member).title} ab admin nahi hai`);
                            } else {
                                Alert.alert('Error', res?.message || 'Admin remove nahi hua');
                            }
                        } catch (e) { Alert.alert('Error', e.message); }
                    },
                },
            ]
        );
    };

    // ── NEW: 9. Lock / Unlock Chat ─────────────────────────────────────────────
    const handleToggleLock = async () => {
        const isLocked = groupDetails?.isLocked ?? false;
        const endpoint = isLocked ? 'chats/group/unlock' : 'chats/group/lock';
        const label    = isLocked ? 'Unlock' : 'Lock';
        try {
            const res = await apiService({
                method:   'PUT',
                endpoint,
                data:     { chatId },
            });
          
            if (res?.success) {
                fetchGroupDetails();
                setGroupDetails(prev => ({ ...prev, isLocked: !isLocked }));
                Alert.alert('Done', `Chat ${isLocked ? 'unlock' : 'lock'} ho gaya!`);
            } else {
                Alert.alert('Error', res?.message || `${label} nahi hua`);
            }
        } catch (e) { Alert.alert('Error', e.message); }
                   
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const isAdmin      = groupDetails?.isAdmin ?? false;
    const isLocked     = groupDetails?.isLocked ?? false;
    const existingIds  = (groupDetails?.members || []).map(m => m._id);
    const mediaImages  = mediaDetails?.images?.items || [];

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                </View>
                <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color="#3498db" />
                    <Text style={[styles.loaderText, { color: theme.text }]}>Loading group info...</Text>
                </View>
            </SafeAreaView>
        );
    }
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

            {/* Top bar */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Group Info</Text>
            </View>
            <EditNamePopup
                visible={editNameVisible}
                currentName={groupDetails?.chatName}
                onClose={() => setEditNameVisible(false)}
                onSave={handleSaveName}
            />
            <MediaSlider
                visible={mediaSliderIdx !== null}
                items={mediaImages}
                startIndex={mediaSliderIdx ?? 0}
                onClose={() => setMediaSliderIdx(null)}
                getUrl={getImageUrl}
            />
            <AddMemberModal
                visible={addMemberVisible}
                onClose={() => setAddMemberVisible(false)}
                chatId={chatId}
                existingMemberIds={existingIds}
                onAdded={fetchGroupDetails}
            />
            <ScrollView showsVerticalScrollIndicator={false}>
                <GroupHeader
                    groupDetails={groupDetails}
                    theme={theme}
                    onImagePress={handleChangeImage}
                    onNamePress={() => setEditNameVisible(true)}
                    onAddMember={() => setAddMemberVisible(true)}
                    IspermissonasAdmin={checkUserRole(groupDetails,MY_USER_ID)}
                />
                <View style={[styles.divider, { backgroundColor: theme.dividerColor }]} />
                <GroupMedia
                    mediaDetails={mediaDetails}
                    theme={theme}
                    onMediaPress={(idx) => setMediaSliderIdx(idx)}
                />
                <View style={[styles.divider, { backgroundColor: theme.dividerColor }]} />
                <GroupMembers
                    groupDetails={groupDetails}
                    theme={theme}
                    MY_USER_ID={MY_USER_ID}
                    showAllMembers={showAllMembers}
                    setShowAllMembers={setShowAllMembers}
                    onAddMember={() => setAddMemberVisible(true)}
                    onRemoveMember={handleRemoveMember}
                    onAddAdmin={handleAddAdmin}
                    onRemoveAdmin={handleRemoveAdmin}
                />
                <View style={[styles.divider, { backgroundColor: theme.dividerColor }]} />
                <GroupFooter
                    theme={theme}
                    isAdmin={isAdmin}
                    isLocked={isLocked}
                    onExitGroup={handleExitGroup}
                    onDeleteGroup={handleDeleteGroup}
                    onPriveChat={onPriveChat}
                    onToggleLock={handleToggleLock}
                />

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container:   { flex: 1 },
    header:      { height: 60, backgroundColor: '#3498db', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 14 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
    loaderWrap:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderText:  { marginTop: 12, fontSize: 15, color: '#555' },
    divider:     { height: 8, backgroundColor: '#f6f6f6', marginVertical: 5 },
});
