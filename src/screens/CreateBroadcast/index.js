import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    FlatList,
    Platform,
    StatusBar,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    ScrollView,
    Modal,
    Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { handlePlanLimit } from '../../services/planLimit';
import apiService from '../../services/apiService';
import { ThemeContext } from '../../components/ThemeContext';
import Config from '../../services/config';
import { appendFile } from '../../utils/uploadFile';
const BASE_URL = Config.Main_url;

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';


const CreateBroadcast = ({ navigation, route }) => {
    const members = route?.params?.members || [];
    const createType = route?.params?.createType || 'Group';

    const { theme } = useContext(ThemeContext);
    const isDark = theme.mode === 'dark';

    const [groupName, setGroupName] = useState('');
    const [groupImage, setGroupImage] = useState(null); // always full asset object | null
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();
    const [modalVisible, setModalVisible] = useState(false);

    // ── Camera ──────────────────────────────────────────────────────────────
    const takePhoto = async () => {
        setModalVisible(false);
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission denied', 'Camera access is required');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled) setGroupImage(result.assets[0]); // ✅ full asset object
    };

    // ── Gallery ─────────────────────────────────────────────────────────────
    const pickImage = async () => {
        setModalVisible(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission denied', 'Gallery access is required');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled) setGroupImage(result.assets[0]); // ✅ full asset object
    };

    // ── Remove Image ─────────────────────────────────────────────────────────
    const removeImage = () => {
        setGroupImage(null);
        setModalVisible(false);
    };

    // ── Create Group API ─────────────────────────────────────────────────────
    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            Alert.alert('Name required', 'Please enter a broadcast name');
            return;
        }
        if (members.length < 1) {
            Alert.alert('Members', 'Select at least 1 member');
            return;
        }
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('broadcastName', groupName.trim());
            formData.append('recipients', JSON.stringify(members.map((m) => m?.appUser?._id)));
            if (groupImage) {
                const uri = groupImage.uri;
                const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
                const mimeType = groupImage.mimeType          // expo SDK 49+
                    || (groupImage.type?.startsWith('image/') ? groupImage.type : `image/${ext}`);
                const fileName = groupImage.fileName || `group_${Date.now()}.${ext}`;
                await appendFile(formData, 'broadcastIcon', {
                    ...groupImage,
                    uri,
                    type: mimeType,
                    name: fileName,
                });
            }
            const response = await apiService({
                method: 'POST',
                endpoint: 'broadcasts',
                data: formData,
                isMultipart: true
            });
            console.log("response________", response)
            if (response.success === true) {
                navigation.navigate('MyBroadcastList')
            } else if (handlePlanLimit(response, navigation)) {
            } else {
                Alert.alert('Error', response?.error?.message || 'Something went wrong! try again');
            }
        } catch (err) {
            console.log('Create broadcasts error:', err);
            Alert.alert('Error', 'Could not create the broadcast. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── Member Chip ──────────────────────────────────────────────────────────
    const renderMember = ({ item }) => (
        <View style={styles.memberChip}>
            <Image
                source={{
                    uri: item?.appUser?.profilePicture ? Config.MEDIA_URL + item?.appUser?.profilePicture :
                        'https://cdn-icons-png.flaticon.com/512/149/149071.png',
                }}
                style={[styles.memberChipAvatar, { borderColor: theme.primary || '#4491f2' }]}
            />
            <Text style={[styles.memberChipName, { color: theme.text }]} numberOfLines={1}>
                {(item.name || item.phone || 'User').split(' ')[0]}
            </Text>
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <StatusBar
                barStyle="light-content"
                backgroundColor={theme.header || theme.primary || '#1199ff'}
            />
            {/* ── Header ── */}
            <View style={[styles.header, { backgroundColor: theme.header || theme.primary || '#1199ff' }]}>
                <TouchableOpacity onPress={() => navigation?.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New {createType}</Text>
                <TouchableOpacity
                    style={[styles.createBtn, (!groupName.trim() || loading) && styles.createBtnDisabled]}
                    onPress={handleCreateGroup}
                    disabled={!groupName.trim() || loading}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.createBtnText}>{t('submit')}</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={{ paddingBottom: 40 }}
            >

                {/* ── Image + Name ── */}
                <View
                    style={[
                        styles.topSection,
                        { borderBottomColor: isDark ? '#222222' : '#f5f5f5' },
                    ]}
                >
                    <TouchableOpacity style={styles.imagePicker} onPress={() => setModalVisible(true)}>
                        {groupImage ? (
                            <Image source={{ uri: groupImage.uri }} style={styles.groupImage} />
                        ) : (
                            <View style={[styles.imagePlaceholder, { backgroundColor: theme.primary || '#4491f2' }]}>
                                <Ionicons name="camera" size={34} color="#fff" />
                                <Text style={styles.imagePlaceholderText}>Add photo</Text>
                            </View>
                        )}
                        <View style={[styles.editBadge, { borderColor: theme.background }]}>
                            <Ionicons name="pencil" size={13} color="#fff" />
                        </View>
                    </TouchableOpacity>

                    <View style={[styles.nameInputWrapper, { borderBottomColor: theme.primary || '#4491f2' }]}>
                        <Ionicons name="people" size={20} color={theme.primary || '#4491f2'} style={{ marginRight: 10 }} />
                        <TextInput
                            style={[styles.nameInput, { color: theme.text }]}
                            placeholder="Enter broadcast name..."
                            placeholderTextColor={isDark ? '#888888' : '#bbbbbb'}
                            value={groupName}
                            onChangeText={setGroupName}
                            maxLength={50}
                            returnKeyType="done"
                        />
                        {groupName.length > 0 && (
                            <TouchableOpacity onPress={() => setGroupName('')}>
                                <Ionicons name="close-circle" size={20} color={isDark ? '#666666' : '#cccccc'} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={[styles.charCount, { color: isDark ? '#777777' : '#bbbbbb' }]}>{groupName.length}/50</Text>
                </View>
                <View style={styles.membersSection}>
                    <View style={styles.membersTitleRow}>
                        <Text style={[styles.membersTitle, { color: theme.text }]}>Members</Text>
                        <View style={[styles.membersBadge, { backgroundColor: theme.primary || '#4491f2' }]}>
                            <Text style={styles.membersBadgeText}>{members.length}</Text>
                        </View>
                    </View>

                    <FlatList
                        data={members}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item, i) => item?.id?.toString() ?? i.toString()}
                        renderItem={renderMember}
                        contentContainerStyle={styles.membersList}
                    />

                    {members.map((item, i) => (
                        <View
                            key={item?.id?.toString() ?? i.toString()}
                            style={[styles.memberRow, { borderBottomColor: isDark ? '#222222' : '#f0f0f0' }]}
                        >
                            <Image
                                source={{
                                    uri: item?.appUser?.profilePicture ? Config.MEDIA_URL + item?.appUser?.profilePicture :
                                        'https://cdn-icons-png.flaticon.com/512/149/149071.png',
                                }}
                                style={[styles.memberAvatar, { backgroundColor: isDark ? '#2a2a2a' : '#eeeeee' }]}
                            />
                            <View style={styles.memberInfo}>
                                <Text style={[styles.memberName, { color: theme.text }]}>{item.name || item.phone || 'User'}</Text>
                                <Text style={[styles.memberPhone, { color: isDark ? '#aaaaaa' : '#888888' }]}>
                                    {item.isRegistered ? '● On Telebook' : `+${item.phone}`}
                                </Text>
                            </View>
                            {item.isRegistered && (
                                <View style={[styles.registeredBadge, { backgroundColor: isDark ? '#123d1d' : '#e8f5e9' }]}>
                                    <Text style={styles.registeredBadgeText}>Member</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* ── Image Picker Modal ── */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
                    <Pressable
                        style={[styles.modalSheet, { backgroundColor: isDark ? '#1e1e1e' : '#ffffff' }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={[styles.modalHandle, { backgroundColor: isDark ? '#444444' : '#dddddd' }]} />
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Broadcast photo</Text>
                        <Text style={[styles.modalSubtitle, { color: isDark ? '#999999' : '#999999' }]}>Where should we get the image from?</Text>

                        <View style={styles.modalOptions}>
                            <TouchableOpacity style={styles.modalOption} onPress={takePhoto}>
                                <View style={[styles.modalOptionIcon, { backgroundColor: theme.primary || '#4491f2' }]}>
                                    <Ionicons name="camera" size={26} color="#fff" />
                                </View>
                                <Text style={[styles.modalOptionLabel, { color: theme.text }]}>Camera</Text>
                                <Text style={styles.modalOptionSub}>Take a photo now</Text>
                            </TouchableOpacity>

                            <View style={[styles.modalDivider, { backgroundColor: isDark ? '#333333' : '#f0f0f0' }]} />

                            <TouchableOpacity style={styles.modalOption} onPress={pickImage}>
                                <View style={[styles.modalOptionIcon, { backgroundColor: '#9C27B0' }]}>
                                    <Ionicons name="images" size={26} color="#fff" />
                                </View>
                                <Text style={[styles.modalOptionLabel, { color: theme.text }]}>Gallery</Text>
                                <Text style={styles.modalOptionSub}>Choose from your phone</Text>
                            </TouchableOpacity>
                        </View>

                        {groupImage && (
                            <TouchableOpacity
                                style={[styles.removeBtn, { backgroundColor: isDark ? '#3a1414' : '#fff1f1' }]}
                                onPress={removeImage}
                            >
                                <Ionicons name="trash-outline" size={18} color="#e53935" />
                                <Text style={styles.removeBtnText}>Remove photo</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.cancelBtn, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={[styles.cancelBtnText, { color: isDark ? '#dddddd' : '#555555' }]}>Cancel</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 52,
        paddingBottom: 14,
        elevation: 4,
    },
    headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '600', marginLeft: 16 },
    createBtn: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 18,
        paddingVertical: 7,
        borderRadius: 20,
        minWidth: 70,
        alignItems: 'center',
    },
    createBtnDisabled: { opacity: 0.4 },
    createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    topSection: {
        alignItems: 'center',
        paddingTop: 32,
        paddingHorizontal: 24,
        paddingBottom: 24,
        borderBottomWidth: 8,
    },
    imagePicker: { position: 'relative', marginBottom: 28 },
    groupImage: { width: 110, height: 110, borderRadius: 55 },
    imagePlaceholder: {
        width: 110,
        height: 110,
        borderRadius: 55,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    imagePlaceholderText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    editBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#25D366',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        elevation: 3,
    },
    nameInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        borderBottomWidth: 2,
        paddingBottom: 8,
        paddingHorizontal: 4,
    },
    nameInput: { flex: 1, fontSize: 17, fontWeight: '500' },
    charCount: { alignSelf: 'flex-end', fontSize: 11, marginTop: 6 },
    membersSection: { paddingTop: 20, paddingHorizontal: 15 },
    membersTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
    membersTitle: { fontSize: 15, fontWeight: '700' },
    membersBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
    },
    membersBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    membersList: { paddingBottom: 16, gap: 10 },
    memberChip: { alignItems: 'center', gap: 5, width: 60 },
    memberChipAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2 },
    memberChipName: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 0.5,
    },
    memberAvatar: { width: 48, height: 48, borderRadius: 24 },
    memberInfo: { flex: 1, marginLeft: 13 },
    memberName: { fontSize: 16, fontWeight: '600' },
    memberPhone: { fontSize: 12, marginTop: 2 },
    registeredBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    registeredBadgeText: { color: '#25D366', fontSize: 11, fontWeight: '600' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 36 : 24,
        paddingTop: 12,
        elevation: 20,
    },
    modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
    modalSubtitle: { fontSize: 13, textAlign: 'center', marginBottom: 24 },
    modalOptions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    modalOption: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 8 },
    modalOptionIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    modalOptionLabel: { fontSize: 15, fontWeight: '700' },
    modalOptionSub: { fontSize: 11, color: '#aaa' },
    modalDivider: { width: 1, height: 70, marginHorizontal: 10 },
    removeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 10,
    },
    removeBtnText: { color: '#e53935', fontWeight: '600', fontSize: 14 },
    cancelBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
    cancelBtnText: { fontWeight: '600', fontSize: 15 },
});

export default CreateBroadcast;