import { Ionicons } from '@expo/vector-icons';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator, Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import { settotalappData } from '../../redex/slices/totalappDataSlice';
import apiService from '../../services/apiService';
import Config from '../../services/config';
const BASE_URL = Config.MEDIA_URL;

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

// ── Format phone number for display ──────────────────────────────────────────
const formatPhone = (raw) => {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) {
        return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
        return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    if (digits.length > 10) {
        return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -5)} ${digits.slice(-5)}`;
    }
    return raw;
};

// ── Edit Field Modal ──────────────────────────────────────────────────────────
const EditModal = ({ visible, onClose, title, value, onSave, multiline = false, isDark }) => {
    const { t } = useTranslation();
    const [text, setText] = useState(value);
    const [loading, setLoading] = useState(false);
    const handleSave = async () => {
        if (!text.trim()) return Alert.alert('Empty', `${title} cannot be empty.`);
        setLoading(true);
        await onSave(text.trim());
        setLoading(false);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.modalOverlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[styles.editSheet, { backgroundColor: isDark ? '#1e1e1e' : '#fff' }]}>
                    <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#444' : '#ddd' }]} />
                    <Text style={[styles.sheetTitle, { color: isDark ? '#f0f0f0' : '#1a1a1a' }]}>
                        Edit {title}
                    </Text>
                    <Text style={[styles.sheetSub, { color: isDark ? '#999' : '#888' }]}>
                        {title === 'Name'
                            ? 'This is your display name. Contacts will see this.'
                            : 'Tell something about yourself.'}
                    </Text>

                    <TextInput
                        style={[
                            styles.sheetInput,
                            {
                                color: isDark ? '#f0f0f0' : '#111',
                                borderColor: isDark ? '#333' : '#e0e0e0',
                                backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
                                height: multiline ? 100 : 50,
                                textAlignVertical: multiline ? 'top' : 'center',
                            }
                        ]}
                        value={text}
                        onChangeText={setText}
                        multiline={multiline}
                        maxLength={multiline ? 139 : 25}
                        autoFocus
                        returnKeyType={multiline ? 'default' : 'done'}
                        onSubmitEditing={multiline ? undefined : handleSave}
                    />
                    {multiline && (
                        <Text style={[styles.charCount, { color: isDark ? '#666' : '#bbb' }]}>
                            {text.length}/139
                        </Text>
                    )}

                    <View style={styles.sheetBtns}>
                        <TouchableOpacity
                            style={[styles.sheetCancelBtn, { borderColor: isDark ? '#444' : '#ddd' }]}
                            onPress={onClose}
                        >
                            <Text style={[styles.sheetCancelText, { color: isDark ? '#aaa' : '#666' }]}>{t('Cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sheetSaveBtn, loading && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={loading}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Text style={styles.sheetSaveText}>{t('Save')}</Text>
                            }
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
const ProfileScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const dispatch = useDispatch();

    const maniAllData = useSelector((state) => state.totalappData);

    const MY_USER_ID = maniAllData?.userId ?? '';
    const userData = maniAllData?.user ?? null;

    const isDark = theme?.mode === 'dark';
    const bg = isDark ? '#121212' : '#f5f7fa';
    const card = isDark ? '#1e1e1e' : '#ffffff';
    const txt = isDark ? '#f0f0f0' : '#1a1a1a';
    const sub = isDark ? '#999' : '#888';
    const border = isDark ? '#2a2a2a' : '#f0f0f0';

    // Local state for optimistic UI
    const [name, setName] = useState(userData?.name ?? 'Your Name');
    const [description, setDescription] = useState(userData?.about ?? 'Hey there! I am using TeleBook');
    const [editName, setEditName] = useState(false);
    const [editDesc, setEditDesc] = useState(false);

    const avatarUri = userData?.profilePicture
        ? BASE_URL + userData.profilePicture
        : DEFAULT_AVATAR;


    console.log("avatarUri_______", userData?.profilePicture)

    const phone = formatPhone(userData?.mobile ?? userData?.mobile ?? '');

    // ── Save Name ──────────────────────────────────────────────────────────────
    const saveName = async (newName) => {
        const prev = name;
        setName(newName); // optimistic
        try {
            const res = await apiService({
                method: 'PUT',
                endpoint: 'users/profile',
                data: { name: newName },
            });
            if (res?.success) {
                updateUserInStore(res?.data?.user)
            }
        } catch (e) {
            setName(prev);
            Alert.alert('Error', 'Failed to update name. Please try again.');
        }
    };
    const updateUserInStore = (newUserData) => {
        dispatch(
            settotalappData({
                ...maniAllData,
                user: newUserData,
            })
        );
    };

    const saveDescription = async (newDesc) => {
        const prev = description;
        setDescription(newDesc); // optimistic
        try {
            const res = await apiService({
                method: 'PUT',
                endpoint: 'users/profile',
                data: { about: newDesc },
            });

            if (res?.success) {
                updateUserInStore(res?.data?.user)
            }
        } catch (e) {

            setDescription(prev);
            Alert.alert('Error', 'Failed to update description. Please try again.');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
            <StatusBar
                backgroundColor="#0084ff"
                barStyle="light-content"
            />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('Profile')}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                {/* ── Avatar Card ── */}
                <View style={[styles.avatarCard, { backgroundColor: card }]}>
                    <View style={styles.avatarWrap}>
                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                        {/* Online indicator */}
                        <View style={styles.onlineDot} />
                    </View>

                    {/* Phone — read-only, formatted */}
                    <View style={styles.phoneRow}>
                        <Ionicons name="call-outline" size={15} color="#0084ff" />
                        <Text style={[styles.phoneText, { color: sub }]}>{phone || 'No number'}</Text>
                    </View>
                </View>


                <View style={[styles.infoCard, { backgroundColor: card, borderColor: border }]}>
                    <View style={styles.infoLeft}>
                        <View style={[styles.infoIconWrap, { backgroundColor: '#e8f4ff' }]}>
                            <Ionicons name="person-outline" size={18} color="#0084ff" />
                        </View>
                        <View>
                            <Text style={[styles.infoLabel, { color: sub }]}>{t('full_name')}</Text>
                            <Text style={[styles.infoValue, { color: txt }]} numberOfLines={1}>{name}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => setEditName(true)}
                        activeOpacity={0.7} >
                        <Ionicons name="pencil" size={16} color="#0084ff" />
                    </TouchableOpacity>
                </View>

                {/* ── Description Row ── */}
                <View style={[styles.infoCard, { backgroundColor: card, borderColor: border }]}>
                    <View style={styles.infoLeft}>
                        <View style={[styles.infoIconWrap, { backgroundColor: '#fff0e8' }]}>
                            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#e67e22" />
                        </View>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={[styles.infoLabel, { color: sub }]}>{t('About')}</Text>
                            <Text style={[styles.infoValue, { color: txt }]} numberOfLines={2}>{description}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => setEditDesc(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="pencil" size={16} color="#0084ff" />
                    </TouchableOpacity>
                </View>

                {/* ── Phone Row (read-only) ── */}
                <View style={[styles.infoCard, { backgroundColor: card, borderColor: border }]}>
                    <View style={styles.infoLeft}>
                        <View style={[styles.infoIconWrap, { backgroundColor: '#e8fff0' }]}>
                            <Ionicons name="call-outline" size={18} color="#27ae60" />
                        </View>
                        <View>
                            <Text style={[styles.infoLabel, { color: sub }]}>{t('Phone Number')}</Text>
                            <Text style={[styles.infoValue, { color: txt }]}>{phone || 'Not available'}</Text>
                        </View>
                    </View>
                    <View style={[styles.editBtn, { backgroundColor: '#f0f0f0' }]}>
                        <Ionicons name="lock-closed-outline" size={14} color="#bbb" />
                    </View>
                </View>
            </ScrollView>
            <EditModal
                visible={editName}
                onClose={() => setEditName(false)}
                title="Name"
                value={name}
                onSave={saveName}
                multiline={false}
                isDark={isDark}
            />
            <EditModal
                visible={editDesc}
                onClose={() => setEditDesc(false)}
                title="About"
                value={description}
                onSave={saveDescription}
                multiline={true}
                isDark={isDark}
            />
        </SafeAreaView>
    );
};

export default ProfileScreen;

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: {
        height: 90, backgroundColor: '#0084ff',
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    },
    backBtn: { marginRight: 14, padding: 2 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },

    // Avatar Card
    avatarCard: {
        alignItems: 'center',
        paddingVertical: 32,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 20,
        shadowColor: '#000', shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
    },
    avatarWrap: { position: 'relative', marginBottom: 14 },
    avatar: {
        width: 110, height: 110, borderRadius: 55,
        borderWidth: 3, borderColor: '#0084ff',
    },
    onlineDot: {
        position: 'absolute', bottom: 6, right: 6,
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: '#25D366',
        borderWidth: 2.5, borderColor: '#fff',
    },
    phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    phoneText: { fontSize: 14, fontWeight: '500', letterSpacing: 0.5 },

    // Info Cards
    infoCard: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 16, marginTop: 10,
        borderRadius: 16, padding: 16,
        borderWidth: 1,
        shadowColor: '#000', shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
    },
    infoLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 },
    infoIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    infoLabel: { fontSize: 11, fontWeight: '500', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
    infoValue: { fontSize: 15, fontWeight: '600' },
    editBtn: {
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: '#f0f6ff',
        alignItems: 'center', justifyContent: 'center',
    },

    // Quick Actions
    actionsRow: {
        flexDirection: 'row',
        marginHorizontal: 16, marginTop: 16, gap: 10,
    },
    actionBtn: {
        flex: 1, alignItems: 'center', paddingVertical: 16,
        borderRadius: 16,
        shadowColor: '#000', shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
    },
    actionIcon: {
        width: 44, height: 44, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    actionLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

    // Edit Bottom Sheet Modal
    modalOverlay: {
        flex: 1, justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    editSheet: {
        position: "absolute", top: '20%', left: 0, width: "100%",
        borderRadius: 24,
        padding: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
        shadowColor: '#000', shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: -4 }, shadowRadius: 20, elevation: 12,
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        alignSelf: 'center', marginBottom: 20,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
    sheetSub: { fontSize: 13, lineHeight: 18, marginBottom: 18 },
    sheetInput: {
        borderWidth: 1.5, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, marginBottom: 6,
    },
    charCount: { fontSize: 11, textAlign: 'right', marginBottom: 20 },
    sheetBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
    sheetCancelBtn: {
        flex: 1, paddingVertical: 13, borderRadius: 12,
        borderWidth: 1.5, alignItems: 'center',
    },
    sheetCancelText: { fontSize: 15, fontWeight: '600' },
    sheetSaveBtn: {
        flex: 1, paddingVertical: 13, borderRadius: 12,
        backgroundColor: '#0084ff', alignItems: 'center',
    },
    sheetSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
