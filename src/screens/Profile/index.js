import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import Config from '../../services/config';
import { updateMyProfile, uploadProfilePhoto } from '../../services/profileSync';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

// Stored key (uploads/...) → /media/<key> (API doc rule 4)
const avatarUrl = (key) => {
    if (!key) return DEFAULT_AVATAR;
    return /^(https?:|file:|data:|blob:)/.test(key) ? key : Config.MEDIA_URL + key;
};

const formatPhone = (raw, isd = '91') => {
    const d = String(raw ?? '').replace(/\D/g, '');
    if (!d) return '';
    const last10 = d.slice(-10);
    return `+${isd} ${last10.slice(0, 5)} ${last10.slice(5)}`;
};

// Har field ka label, limit aur help text ek jagah
const FIELDS = {
    name: { label: 'Name', max: 25, help: 'This is your display name. Your contacts will see it.', required: true },
    about: { label: 'About', max: 139, help: 'Tell people something about yourself.', multiline: true },
    city: { label: 'City', max: 40, help: 'Your city.' },
    state: { label: 'State', max: 40, help: 'Your state.' },
};

// ── Edit bottom sheet ────────────────────────────────────────────────────────
const EditSheet = ({ field, value, onClose, onSave, isDark }) => {
    const { t } = useTranslation();
    const cfg = FIELDS[field] ?? {};
    const [text, setText] = useState(value ?? '');
    const [saving, setSaving] = useState(false);

    // Har baar khulne par taaza value — pehle Cancel ke baad bhi purana type kiya text reh jata tha
    useEffect(() => { setText(value ?? ''); }, [field, value]);

    const trimmed = text.trim();
    const canSave = !saving && (!cfg.required || trimmed.length > 0) && trimmed !== (value ?? '').trim();

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        const done = await onSave(trimmed);
        setSaving(false);
        if (done) onClose();
    };

    return (
        <Modal visible={!!field} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[styles.sheet, { backgroundColor: isDark ? '#1e1e1e' : '#fff' }]}>
                    <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#444' : '#ddd' }]} />
                    <Text style={[styles.sheetTitle, { color: isDark ? '#f0f0f0' : '#1a1a1a' }]}>Edit {cfg.label}</Text>
                    <Text style={[styles.sheetSub, { color: isDark ? '#999' : '#888' }]}>{cfg.help}</Text>
                    <TextInput
                        style={[
                            styles.sheetInput,
                            {
                                color: isDark ? '#f0f0f0' : '#111',
                                borderColor: isDark ? '#333' : '#e0e0e0',
                                backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
                                minHeight: cfg.multiline ? 96 : 50,
                                textAlignVertical: cfg.multiline ? 'top' : 'center',
                            },
                        ]}
                        value={text}
                        onChangeText={setText}
                        multiline={!!cfg.multiline}
                        maxLength={cfg.max}
                        autoFocus
                        returnKeyType={cfg.multiline ? 'default' : 'done'}
                        onSubmitEditing={cfg.multiline ? undefined : handleSave}
                        placeholder={cfg.label}
                        placeholderTextColor={isDark ? '#666' : '#bbb'}
                    />
                    <Text style={[styles.charCount, { color: isDark ? '#666' : '#aaa' }]}>{text.length}/{cfg.max}</Text>
                    <View style={styles.sheetBtns}>
                        <TouchableOpacity style={[styles.sheetCancelBtn, { borderColor: isDark ? '#444' : '#ddd' }]} onPress={onClose}>
                            <Text style={[styles.sheetCancelText, { color: isDark ? '#aaa' : '#666' }]}>{t('Cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.sheetSaveBtn, !canSave && { opacity: 0.5 }]} onPress={handleSave} disabled={!canSave}>
                            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sheetSaveText}>{t('Save')}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// ── Main screen ──────────────────────────────────────────────────────────────
const ProfileScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const dispatch = useDispatch();
    // Redux hi source of truth — local copy nahi, isliye kahin aur se update ho to yahan bhi dikhe
    const user = useSelector((state) => state.totalappData?.user) || {};

    const isDark = theme?.mode === 'dark';
    const bg = isDark ? '#121212' : '#f5f7fa';
    const card = isDark ? '#1e1e1e' : '#ffffff';
    const txt = isDark ? '#f0f0f0' : '#1a1a1a';
    const sub = isDark ? '#999' : '#888';
    const divider = isDark ? '#2a2a2a' : '#f0f0f0';

    const [editing, setEditing] = useState(null); // 'name' | 'about' | 'city' | 'state'
    const [previewUri, setPreviewUri] = useState(null); // upload ke dauran nayi photo turant dikhao
    const [photoBusy, setPhotoBusy] = useState(false);

    const saveField = async (value) => {
        const res = await updateMyProfile(dispatch, { [editing]: value });
        if (!res.ok) {
            Toast.show({ type: 'error', text1: 'Update failed', text2: res.message });
            return false;
        }
        Toast.show({ type: 'success', text1: `${FIELDS[editing].label} updated` });
        return true;
    };

    const pickAndUpload = async (source) => {
        try {
            const perm = source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (perm.status !== 'granted') {
                Toast.show({ type: 'error', text1: 'Permission needed', text2: `Allow ${source === 'camera' ? 'camera' : 'photos'} access in settings` });
                return;
            }
            const options = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);
            if (result.canceled || !result.assets?.[0]) return;

            const asset = result.assets[0];
            setPreviewUri(asset.uri);
            setPhotoBusy(true);
            const res = await uploadProfilePhoto(dispatch, asset);
            setPhotoBusy(false);
            setPreviewUri(null);
            if (res.ok) Toast.show({ type: 'success', text1: 'Profile photo updated' });
            else Toast.show({ type: 'error', text1: 'Upload failed', text2: res.message });
        } catch (e) {
            console.log('Profile photo error:', e);
            setPhotoBusy(false);
            setPreviewUri(null);
            Toast.show({ type: 'error', text1: 'Upload failed', text2: 'Please try again' });
        }
    };

    // Web par Alert ke buttons kaam nahi karte — wahan seedha gallery
    const choosePhoto = () => {
        if (photoBusy) return;
        if (Platform.OS === 'web') { pickAndUpload('gallery'); return; }
        Alert.alert('Profile photo', 'Choose a source', [
            { text: 'Camera', onPress: () => pickAndUpload('camera') },
            { text: 'Gallery', onPress: () => pickAndUpload('gallery') },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const phone = formatPhone(user.mobile, user.isdCode || '91');

    const Row = ({ icon, iconBg, iconColor, label, value, field, placeholder, last }) => (
        <TouchableOpacity
            style={styles.row}
            onPress={field ? () => setEditing(field) : undefined}
            activeOpacity={field ? 0.6 : 1}
            disabled={!field}
        >
            {/* Dark mode me halka pastel chubhta hai — icon ke rang ka faint tint */}
            <View style={[styles.rowIcon, { backgroundColor: isDark ? `${iconColor}2e` : iconBg }]}>
                <Ionicons name={icon} size={18} color={iconColor} />
            </View>
            <View style={[styles.rowBody, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider }]}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: sub }]}>{label}</Text>
                    <Text style={[styles.rowValue, { color: value ? txt : sub }]} numberOfLines={field === 'about' ? 3 : 1}>
                        {value || placeholder}
                    </Text>
                </View>
                <Ionicons name={field ? 'pencil' : 'lock-closed-outline'} size={16} color={field ? '#0084ff' : sub} />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
            <StatusBar backgroundColor="#0084ff" barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn} hitSlop={10}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('Profile')}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {/* Photo */}
                <View style={styles.photoSection}>
                    <TouchableOpacity onPress={choosePhoto} activeOpacity={0.85} style={styles.avatarWrap}>
                        <Image source={{ uri: previewUri || avatarUrl(user.profilePicture) }} style={styles.avatar} />
                        {photoBusy && (
                            <View style={styles.avatarOverlay}>
                                <ActivityIndicator color="#fff" size="large" />
                            </View>
                        )}
                        <View style={styles.cameraBadge}>
                            <Ionicons name="camera" size={18} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <Text style={[styles.bigName, { color: txt }]} numberOfLines={1}>{user.name || 'Your name'}</Text>
                    {!!phone && <Text style={[styles.bigPhone, { color: sub }]}>{phone}</Text>}
                    <TouchableOpacity onPress={choosePhoto} disabled={photoBusy}>
                        <Text style={styles.changePhoto}>{photoBusy ? 'Uploading…' : 'Change photo'}</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.sectionLabel, { color: sub }]}>PERSONAL INFO</Text>
                <View style={[styles.card, { backgroundColor: card }]}>
                    <Row icon="person-outline" iconBg="#e8f4ff" iconColor="#0084ff" label={t('full_name')} value={user.name} field="name" placeholder="Add your name" />
                    <Row icon="chatbubble-ellipses-outline" iconBg="#fff0e8" iconColor="#e67e22" label={t('About')} value={user.about} field="about" placeholder="Add a few words about you" last />
                </View>

                <Text style={[styles.sectionLabel, { color: sub }]}>LOCATION</Text>
                <View style={[styles.card, { backgroundColor: card }]}>
                    <Row icon="business-outline" iconBg="#f3e8ff" iconColor="#8e44ad" label="City" value={user.city} field="city" placeholder="Add city" />
                    <Row icon="map-outline" iconBg="#e8fff6" iconColor="#16a085" label="State" value={user.state} field="state" placeholder="Add state" last />
                </View>

                <Text style={[styles.sectionLabel, { color: sub }]}>ACCOUNT</Text>
                <View style={[styles.card, { backgroundColor: card }]}>
                    <Row icon="call-outline" iconBg="#e8fff0" iconColor="#27ae60" label={t('Phone Number')} value={phone} placeholder="Not available" last />
                </View>
                <Text style={[styles.footNote, { color: sub }]}>Your phone number can't be changed.</Text>
            </ScrollView>

            <EditSheet
                field={editing}
                value={editing ? user[editing] : ''}
                onClose={() => setEditing(null)}
                onSave={saveField}
                isDark={isDark}
            />
        </SafeAreaView>
    );
};

export default ProfileScreen;

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        backgroundColor: '#0084ff', flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingBottom: 14,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    },
    backBtn: { marginRight: 14 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    scroll: { paddingBottom: 40 },

    photoSection: { alignItems: 'center', paddingTop: 28, paddingBottom: 8 },
    avatarWrap: { position: 'relative' },
    avatar: { width: 128, height: 128, borderRadius: 64, backgroundColor: '#dfe6ee' },
    avatarOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 64, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    cameraBadge: {
        position: 'absolute', right: 2, bottom: 2, width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#0084ff', alignItems: 'center', justifyContent: 'center',
        borderWidth: 3, borderColor: '#fff',
    },
    bigName: { fontSize: 22, fontWeight: '700', marginTop: 14, maxWidth: '85%' },
    bigPhone: { fontSize: 14, marginTop: 4, letterSpacing: 0.3 },
    changePhoto: { color: '#0084ff', fontSize: 14, fontWeight: '600', marginTop: 10, padding: 4 },

    sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginTop: 22, marginBottom: 8, marginHorizontal: 20 },
    card: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
    rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 16, gap: 10 },
    rowLabel: { fontSize: 12, marginBottom: 3 },
    rowValue: { fontSize: 15, fontWeight: '500' },
    footNote: { fontSize: 12, marginTop: 8, marginHorizontal: 20 },

    sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
    sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
    sheetSub: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
    sheetInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    charCount: { fontSize: 11, textAlign: 'right', marginTop: 6, marginBottom: 16 },
    sheetBtns: { flexDirection: 'row', gap: 12 },
    sheetCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
    sheetCancelText: { fontSize: 15, fontWeight: '600' },
    sheetSaveBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#0084ff', alignItems: 'center' },
    sheetSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
