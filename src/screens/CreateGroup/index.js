import React, { useState, useContext } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
    Platform, StatusBar, ActivityIndicator, Alert,
    KeyboardAvoidingView, ScrollView, Modal, Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import Config from '../../services/config';
import { appendFile } from '../../utils/uploadFile';


const PALETTE = ['#4491f2', '#AF52DE', '#25D366', '#FF9500', '#FF3B30', '#5AC8FA', '#FF2D55'];
const avatarColor = (name = '') => PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length];

const Avatar = ({ uri, name = '', size = 46, border }) => {
    const [err, setErr] = useState(false);
    const initials = name.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    const bg = avatarColor(name);
    const r = size / 2;
    const bStyle = border ? { borderWidth: 2, borderColor: border } : {};

    if (!uri || err) {
        return (
            <View style={[{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, bStyle]}>
                <Text style={{ color: '#fff', fontSize: size * 0.36, fontWeight: '700' }}>{initials}</Text>
            </View>
        );
    }
    return <Image source={{ uri }} style={[{ width: size, height: size, borderRadius: r }, bStyle]} onError={() => setErr(true)} />;
};

const getAvatar = (item) =>
    item?.appUser?.profilePicture ? Config.MEDIA_URL + item.appUser.profilePicture : null;

const CreateGroup = ({ navigation, route }) => {
    const members = route?.params?.members || [];
    const createType = route?.params?.createType || 'group';
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const isDark = theme.text === '#FFFFFF';

    const [groupName, setGroupName] = useState('');
    const [groupImage, setGroupImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);


    const pageBg = isDark ? '#0d0d0d' : '#f4f6fb';
    const cardBg = isDark ? '#1a1a1a' : '#ffffff';
    const cardBorder = isDark ? '#252525' : '#e8ecf5';
    const textPrimary = isDark ? '#e8e8e8' : '#111111';
    const textSec = isDark ? '#666' : '#888888';
    const inputClr = isDark ? '#e0e0e0' : '#111111';
    const placeholderC = isDark ? '#444' : '#c0c0c0';
    const charClr = isDark ? '#444' : '#c0c0c0';
    const rowBorder = isDark ? '#222' : '#f0f2f8';
    const checkBg = isDark ? '#0d2e1a' : '#e8faf0';
    const heroTop = '#4491f2';
    const modalBg = isDark ? '#1a1a1a' : '#ffffff';
    const modalHandle = isDark ? '#333' : '#ddd';
    const modalTitleC = isDark ? '#e0e0e0' : '#111';
    const modalSubC = isDark ? '#555' : '#999';
    const modalDivC = isDark ? '#2a2a2a' : '#f0f0f0';
    const cancelBg = isDark ? '#2a2a2a' : '#f5f5f5';
    const cancelC = isDark ? '#aaa' : '#555';
    const removeBg = isDark ? '#2a0d0d' : '#fff1f1';


    const takePhoto = async () => {
        setModalVisible(false);
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission Denied', 'Camera access chahiye'); return; }
        const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!res.canceled) setGroupImage(res.assets[0]);
    };

    const pickImage = async () => {
        setModalVisible(false);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission Denied', 'Gallery access chahiye'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!res.canceled) setGroupImage(res.assets[0]);
    };

    const removeImage = () => { setGroupImage(null); setModalVisible(false); };


    const handleCreate = async () => {
        if (!groupName.trim()) { Alert.alert('Group Name', 'Group ka naam likhna zarori hai'); return; }
        if (members.length < 1) { Alert.alert('Members', 'Kam se kam 1 member chahiye'); return; }
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('name', groupName.trim());
            fd.append('users', JSON.stringify(members.map(m => m?.appUser?._id)));
            if (groupImage) {
                const uri = groupImage.uri;
                const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
                const mimeType = groupImage.mimeType || `image/${ext}`;
                await appendFile(fd, 'groupIcon', { ...groupImage, uri, type: mimeType, name: groupImage.fileName || `group_${Date.now()}.${ext}` });
            }
            const res = await apiService({ method: 'POST', endpoint: 'chats/group', data: fd, isMultipart: true });
            if (res.success) {
                Alert.alert('Group Created!', `"${groupName}" successfully created`, [{ text: 'OK', onPress: () => navigation.navigate('tab') }]);
            } else if (res?.error?.code === 'PLAN_LIMIT') {
                Alert.alert('Plan limit reached', res.error.message, [
                    { text: 'Upgrade', onPress: () => navigation.navigate('Plans') },
                    { text: 'Cancel', style: 'cancel' },
                ]);
            } else {
                Alert.alert('Error', res?.error?.message || 'Something went wrong');
            }
        } catch (e) {
            Alert.alert('Error', 'Group create nahi ho saka. Dobara try karo.');
        } finally {
            setLoading(false);
        }
    };

    const canCreate = groupName.trim().length > 0 && !loading;

    return (
        <KeyboardAvoidingView style={[styles.container, { backgroundColor: pageBg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    New {createType === 'group' ? 'Group' : 'Broadcast'}
                </Text>
                <TouchableOpacity
                    style={[styles.createPill, !canCreate && styles.createPillDisabled]}
                    onPress={handleCreate}
                    disabled={!canCreate}
                >
                    {loading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.createPillText}>{t('submit')}</Text>
                    }
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

                {/* ── Hero: image picker ── */}
                <View style={styles.heroSection}>
                    <TouchableOpacity style={styles.avatarBtn} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
                        {groupImage ? (
                            <Image source={{ uri: groupImage.uri }} style={styles.heroImage} />
                        ) : (
                            <View style={styles.heroPlaceholder}>
                                <Ionicons name="camera" size={30} color="#fff" />
                                <Text style={styles.heroPlaceholderText}>Add Photo</Text>
                            </View>
                        )}
                        <View style={styles.editBadge}>
                            <Ionicons name="pencil" size={11} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.heroHint}>Tap to add group photo</Text>
                </View>

                {/* ── Name card ── */}
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={styles.fieldLabel}>Group Name</Text>
                    <View style={styles.nameRow}>
                        <Ionicons name="people" size={18} color="#4491f2" style={{ marginRight: 10 }} />
                        <TextInput
                            style={[styles.nameInput, { color: inputClr }]}
                            placeholder={createType === 'group' ? 'Enter group name...' : 'Enter broadcast name...'}
                            placeholderTextColor={placeholderC}
                            value={groupName}
                            onChangeText={setGroupName}
                            maxLength={50}
                            autoFocus
                        />
                        {groupName.length > 0 && (
                            <TouchableOpacity onPress={() => setGroupName('')}>
                                <Ionicons name="close-circle" size={18} color={isDark ? '#444' : '#ccc'} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={styles.nameUnderline} />
                    <Text style={[styles.charCount, { color: charClr }]}>{groupName.length}/50</Text>
                </View>

                {/* ── Members card ── */}
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: textPrimary }]}>Members</Text>
                        <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{members.length}</Text>
                        </View>
                    </View>

                    {/* Horizontal chips */}
                    {members.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                            {members.map((item, i) => (
                                <View key={item?.id?.toString() ?? i} style={styles.chip}>
                                    <Avatar uri={getAvatar(item)} name={item.name} size={44} border="#4491f2" />
                                    <Text style={[styles.chipName, { color: textSec }]} numberOfLines={1}>
                                        {item.name?.split(' ')[0]}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    {/* Vertical list */}
                    <View style={styles.memberList}>
                        {members.map((item, i) => (
                            <View key={item?.id?.toString() ?? i} style={[styles.memberRow, { borderBottomColor: rowBorder }, i === members.length - 1 && { borderBottomWidth: 0 }]}>
                                <Avatar uri={getAvatar(item)} name={item.name} size={44} />
                                <View style={styles.memberInfo}>
                                    <Text style={[styles.memberName, { color: textPrimary }]}>{item.name}</Text>
                                    <Text style={[styles.memberPhone, { color: textSec }]}>{item.phone}</Text>
                                </View>
                                <View style={[styles.checkCircle, { backgroundColor: checkBg }]}>
                                    <Ionicons name="checkmark" size={14} color="#25D366" />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* ── Image Picker Modal ── */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
                    <Pressable style={[styles.modalSheet, { backgroundColor: modalBg }]} onPress={e => e.stopPropagation()}>
                        <View style={[styles.modalHandle, { backgroundColor: modalHandle }]} />
                        <Text style={[styles.modalTitle, { color: modalTitleC }]}>Group Photo</Text>
                        <Text style={[styles.modalSub, { color: modalSubC }]}>Image kahan se leni hai?</Text>

                        <View style={styles.modalOptions}>
                            <TouchableOpacity style={styles.modalOption} onPress={takePhoto}>
                                <View style={[styles.modalIconBox, { backgroundColor: '#4491f2' }]}>
                                    <Ionicons name="camera" size={26} color="#fff" />
                                </View>
                                <Text style={[styles.modalOptionLabel, { color: modalTitleC }]}>Camera</Text>
                                <Text style={[styles.modalOptionSub, { color: modalSubC }]}>Abhi photo lo</Text>
                            </TouchableOpacity>
                            <View style={[styles.modalDivider, { backgroundColor: modalDivC }]} />
                            <TouchableOpacity style={styles.modalOption} onPress={pickImage}>
                                <View style={[styles.modalIconBox, { backgroundColor: '#9C27B0' }]}>
                                    <Ionicons name="images" size={26} color="#fff" />
                                </View>
                                <Text style={[styles.modalOptionLabel, { color: modalTitleC }]}>Gallery</Text>
                                <Text style={[styles.modalOptionSub, { color: modalSubC }]}>Phone se choose karo</Text>
                            </TouchableOpacity>
                        </View>

                        {groupImage && (
                            <TouchableOpacity style={[styles.removeBtn, { backgroundColor: removeBg }]} onPress={removeImage}>
                                <Ionicons name="trash-outline" size={17} color="#e53935" />
                                <Text style={styles.removeBtnText}>Photo Hatao</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: cancelBg }]} onPress={() => setModalVisible(false)}>
                            <Text style={[styles.cancelBtnText, { color: cancelC }]}>Cancel</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },

    header: { backgroundColor: '#4491f2', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 52, paddingBottom: 14, elevation: 4 },
    backBtn: { padding: 4, marginRight: 10 },
    headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '600' },
    createPill: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, minWidth: 68, alignItems: 'center' },
    createPillDisabled: { opacity: 0.4 },
    createPillText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    heroSection: { backgroundColor: '#4491f2', alignItems: 'center', paddingBottom: 28, paddingTop: 4 },
    avatarBtn: { position: 'relative' },
    heroImage: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
    heroPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center', gap: 4 },
    heroPlaceholderText: { color: '#fff', fontSize: 10, fontWeight: '600' },
    editBadge: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    heroHint: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 10 },

    card: { marginHorizontal: 14, marginTop: 14, borderRadius: 18, padding: 16, borderWidth: 0.5 },

    fieldLabel: { fontSize: 10, color: '#4491f2', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    nameInput: { flex: 1, fontSize: 16, fontWeight: '500', paddingVertical: 2 },
    nameUnderline: { height: 1.5, backgroundColor: '#4491f2', marginTop: 8, borderRadius: 1 },
    charCount: { fontSize: 10, textAlign: 'right', marginTop: 5 },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    sectionTitle: { fontSize: 14, fontWeight: '700' },
    countBadge: { backgroundColor: '#4491f2', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    countBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

    chipScroll: { gap: 12, paddingBottom: 14, paddingRight: 4 },
    chip: { alignItems: 'center', gap: 5, width: 52 },
    chipName: { fontSize: 10, fontWeight: '500', textAlign: 'center' },

    memberList: {},
    memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },
    memberInfo: { flex: 1, marginLeft: 12 },
    memberName: { fontSize: 14, fontWeight: '600' },
    memberPhone: { fontSize: 11, marginTop: 2 },
    checkCircle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24, paddingTop: 12 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
    modalSub: { fontSize: 12, textAlign: 'center', marginBottom: 24 },
    modalOptions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    modalOption: { flex: 1, alignItems: 'center', gap: 8 },
    modalIconBox: { width: 62, height: 62, borderRadius: 31, justifyContent: 'center', alignItems: 'center' },
    modalOptionLabel: { fontSize: 14, fontWeight: '700' },
    modalOptionSub: { fontSize: 11 },
    modalDivider: { width: 1, height: 60, marginHorizontal: 12 },
    removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, marginBottom: 10 },
    removeBtnText: { color: '#e53935', fontWeight: '600', fontSize: 14 },
    cancelBtn: { paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
    cancelBtnText: { fontWeight: '600', fontSize: 15 },
});

export default CreateGroup;