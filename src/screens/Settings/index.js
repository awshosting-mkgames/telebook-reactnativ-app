import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import i18n, { LANG_STORAGE_KEY } from '../../i18n/i18n';
import { settotalappData } from '../../redex/slices/totalappDataSlice';
import apiService from '../../services/apiService';
import { saveData } from '../../services/staticStorage';
import Config from '../../services/config';
const BASE_URL = Config.MEDIA_URL;
const STORAGE_KEY = 'DOWNLOAD_DIR_URI';
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const PopupModal = ({ visible, onClose, title, children, isDark }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
            <TouchableOpacity activeOpacity={1}
                style={[styles.popup, { backgroundColor: isDark ? '#1e1e1e' : '#fff' }]}
            >
                <View style={styles.popupHeader}>
                    <Text style={[styles.popupTitle, { color: isDark ? '#f0f0f0' : '#1a1a1a' }]}>{title}</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={22} color={isDark ? '#aaa' : '#555'} />
                    </TouchableOpacity>
                </View>
                {children}
            </TouchableOpacity>
        </TouchableOpacity>
    </Modal>
);

const resolveAvatar = (path, fallback) => {
    if (!path) return fallback;
    return BASE_URL + path;
};

const SettingsItem = ({ icon, title, subtitle, iconColor = '#3498db', onPress, isDark }) => (
    <TouchableOpacity style={styles.itemContainer} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.iconContainer, { backgroundColor: iconColor }]}>
            <Ionicons name={icon} size={20} color="white" />
        </View>
        <View style={styles.textContainer}>
            <Text style={[styles.itemTitle, { color: isDark ? '#f0f0f0' : '#333' }]}>{title}</Text>
            {subtitle && <Text style={[styles.itemSubtitle, { color: isDark ? '#999' : '#888' }]}>{subtitle}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={16} color={isDark ? '#555' : '#ccc'} />
    </TouchableOpacity>
);

export default function Settings({ navigation }) {
    const { t } = useTranslation();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const dispatch = useDispatch();
    const maniAllData = useSelector((state) => state.totalappData);
    const userData = maniAllData?.user ?? null;

    const isDark = theme?.mode === 'dark';
    const bg = isDark ? '#121212' : '#f5f7fa';
    const card = isDark ? '#1e1e1e' : '#ffffff';
    const txt = isDark ? '#f0f0f0' : '#1a1a1a';
    const sub = isDark ? '#999' : '#888';

    const [showTheme, setShowTheme] = useState(false);
    const [showLang, setShowLang] = useState(false);
    const [showLogout, setShowLogout] = useState(false);
    const [showNotif, setShowNotif] = useState(false);

    const [notifMessages, setNotifMessages] = useState(true);
    const [notifGroups, setNotifGroups] = useState(true);
    const [notifCalls, setNotifCalls] = useState(true);
    const [notifStatus, setNotifStatus] = useState(false);

    const languages = [
        { code: 'en', label: 'English', native: 'English', flag: '🇺🇸' },
        { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
    ];

    const [selectedLang, setSelectedLang] = useState(i18n.language || maniAllData?.lang || 'en');

    const handleLanguageChange = async (code) => {
        setSelectedLang(code);
        setShowLang(false);
        await i18n.changeLanguage(code);
        await AsyncStorage.setItem(LANG_STORAGE_KEY, code);
        dispatch(settotalappData({ lang: code }));
    };

    const handleLogout = async () => {
        setShowLogout(false);
        try {
            await saveData('userData', '');
            await saveData('token', '');
            await saveData('userId', '');
            await saveData('userType', '');
            await saveData('isLogin', false);
            dispatch(settotalappData({
                user: '', isLogin: false, apiToken: '',
                userId: '', userType: '',
            }));
            navigation.navigate('Authsec');
        } catch (e) { }
    };

    const DeleteAccountfun = async () => {
        try {
            const response = await apiService({
                method: 'DELETE',
                endpoint: 'users/delete-account',
                data: {},
            });
            if (response?.success) {
                handleLogout();
            } else {
                Alert.alert('Error', response?.message || 'Something went wrong');
            }
        } catch (err) {
            console.log('Chat creation error:', err);
            Alert.alert('Error', 'Failed to start chat');
        }

    }

    const currentLangLabel = languages.find(l => l.code === selectedLang)?.label || 'English';

    const menuItems = [
        {
            id: '1', icon: 'key-outline', title: t('Profile'),
            subtitle: 'name, description, number', color: '#3498db',
            onPress: () => navigation.navigate('Profile'),
        },
        {
            id: '3', icon: 'person-circle-outline', title: 'Avatar',
            subtitle: 'Create, edit, profile photo', color: '#9b59b6',
            onPress: () => navigation.navigate('Avatar'),
        },
        {
            id: '4', icon: 'people-outline', title: 'Broadcast Lists',
            subtitle: 'Broadcast Lists', color: '#27ae60',
            onPress: () => navigation.navigate('MyBroadcastList'),
        },
        {
            id: '5', icon: 'chatbubble-outline', title: t('Chat'),
            subtitle: isDark ? 'Dark theme active' : 'Light theme active', color: '#e67e22',
            onPress: () => setShowTheme(true),
        },
        {
            id: '8', icon: 'globe-outline', title: t('Language'),
            subtitle: currentLangLabel, color: '#1abc9c',
            onPress: () => setShowLang(true),
        },
        {
            id: '19',
            icon: 'information-circle-outline',
            title: t('About us'),
            subtitle: t('Read our About us'),
            color: '#73b659',
            onPress: () => navigation.navigate('TermsConditionsScreen'),
        },
        {
            id: '10',
            icon: 'shield-checkmark-outline',
            title: t('Privacy Policy'),
            subtitle: t('Read our privacy policy'),
            color: '#3498db',
            onPress: () => navigation.navigate('PrivacyPolicyScreen'),
        },
        {
            id: '11',
            icon: 'document-text-outline',
            title: t('Terms & Conditions'),
            subtitle: t('Read our terms and conditions'),
            color: '#9b59b6',
            onPress: () => navigation.navigate('TermsConditionsScreen'),
        },

        {
            id: '10', icon: 'log-out-outline', title: t('logout'),
            subtitle: t('Are you sure want to log out?'), color: '#e74c3c',
            onPress: () => setShowLogout(true),
        },
        {
            id: '9',
            icon: 'trash-outline',
            title: t('Delete Account'),
            subtitle: t('Permanently delete your account'),
            color: '#e74c3c',
            onPress: () => navigation.navigate('Deleteaccount'),
        }
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="#0084ff" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerLeft} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                    <Text style={styles.headerTitle}>{t('Settings')}</Text>
                </TouchableOpacity>

            </View>

            <ScrollView style={{ paddingBottom: 50, }} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                    style={[styles.profileSection, { backgroundColor: card }]}
                    onPress={() => navigation.navigate('Avatar')}
                    activeOpacity={0.8}
                >
                    <Image
                        source={{ uri: userData?.profilePicture ? resolveAvatar(userData?.profilePicture, DEFAULT_AVATAR) : DEFAULT_AVATAR }}
                        style={styles.avatar}
                    />
                    <View style={styles.profileInfo}>
                        <Text style={[styles.profileName, { color: txt }]}>{userData?.name}</Text>
                        <Text style={[styles.profileBio, { color: sub }]}>{userData?.about}</Text>
                    </View>
                </TouchableOpacity>

                <View style={[styles.listSection, { backgroundColor: card }]}>
                    {menuItems.map((item, index) => (
                        <React.Fragment key={item.id}>
                            <SettingsItem
                                icon={item.icon}
                                title={item.title}
                                subtitle={item.subtitle}
                                iconColor={item.color}
                                onPress={item.onPress}
                                isDark={isDark}
                            />
                            {index < menuItems.length - 1 && (
                                <View style={[styles.divider, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]} />
                            )}
                        </React.Fragment>
                    ))}
                </View>
            </ScrollView>

            {/* ── Theme Popup ── */}
            <PopupModal visible={showTheme} onClose={() => setShowTheme(false)} title="Choose Theme" isDark={isDark}>
                <View style={styles.themeRow}>
                    <TouchableOpacity
                        style={[styles.themeCard, { backgroundColor: '#f8f8f8', borderColor: !isDark ? '#0084ff' : '#ddd' }, !isDark && styles.themeCardActive]}
                        onPress={() => { if (isDark) toggleTheme(); setShowTheme(false); }}
                        activeOpacity={0.8}
                    >
                        <View style={styles.themePreviewLight}>
                            <View style={styles.tpHeader} />
                            <View style={styles.tpBubble} />
                            <View style={[styles.tpBubble, { alignSelf: 'flex-end', backgroundColor: '#0084ff' }]} />
                        </View>
                        <Text style={[styles.themeLabel, { color: '#333' }]}>☀️  Light</Text>
                        {!isDark && <Ionicons name="checkmark-circle" size={20} color="#0084ff" style={styles.themeCheck} />}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.themeCard, { backgroundColor: '#1a1a1a', borderColor: isDark ? '#0084ff' : '#333' }, isDark && styles.themeCardActive]}
                        onPress={() => { if (!isDark) toggleTheme(); setShowTheme(false); }}
                        activeOpacity={0.8}
                    >
                        <View style={styles.themePreviewDark}>
                            <View style={[styles.tpHeader, { backgroundColor: '#333' }]} />
                            <View style={[styles.tpBubble, { backgroundColor: '#333' }]} />
                            <View style={[styles.tpBubble, { alignSelf: 'flex-end', backgroundColor: '#005fa3' }]} />
                        </View>
                        <Text style={[styles.themeLabel, { color: '#eee' }]}>🌙  Dark</Text>
                        {isDark && <Ionicons name="checkmark-circle" size={20} color="#0084ff" style={styles.themeCheck} />}
                    </TouchableOpacity>
                </View>
            </PopupModal>

            {/* ── Language Popup ── */}
            <PopupModal visible={showLang} onClose={() => setShowLang(false)} title={t('Select Language')} isDark={isDark}>
                {languages.map((lang) => (
                    <TouchableOpacity
                        key={lang.code}
                        style={[
                            styles.langRow,
                            { borderBottomColor: isDark ? '#2a2a2a' : '#f0f0f0' },
                            selectedLang === lang.code && { backgroundColor: isDark ? '#1a2a3a' : '#ebf5ff' },
                        ]}
                        onPress={() => handleLanguageChange(lang.code)}
                    >
                        <Text style={styles.langFlag}>{lang.flag}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.langLabel, { color: isDark ? '#eee' : '#333' }]}>{lang.label}</Text>
                            <Text style={[styles.langNative, { color: sub }]}>{lang.native}</Text>
                        </View>
                        {selectedLang === lang.code && (
                            <Ionicons name="checkmark-circle" size={22} color="#0084ff" />
                        )}
                    </TouchableOpacity>
                ))}
            </PopupModal>

            {/* ── Notifications Popup ── */}
            <PopupModal visible={showNotif} onClose={() => setShowNotif(false)} title="Notifications" isDark={isDark}>
                {[
                    { label: 'Messages', icon: 'chatbubble-outline', val: notifMessages, set: setNotifMessages },
                    { label: 'Groups', icon: 'people-outline', val: notifGroups, set: setNotifGroups },
                    { label: 'Calls', icon: 'call-outline', val: notifCalls, set: setNotifCalls },
                    { label: 'Status Updates', icon: 'radio-button-on-outline', val: notifStatus, set: setNotifStatus },
                ].map((item) => (
                    <View key={item.label} style={[styles.notifRow, { borderBottomColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
                        <View style={styles.notifLeft}>
                            <Ionicons name={item.icon} size={20} color="#0084ff" style={{ marginRight: 12 }} />
                            <Text style={[styles.notifLabel, { color: isDark ? '#eee' : '#333' }]}>{item.label}</Text>
                        </View>
                        <Switch
                            value={item.val}
                            onValueChange={item.set}
                            trackColor={{ false: '#ccc', true: '#0084ff' }}
                            thumbColor="#fff"
                        />
                    </View>
                ))}
                <TouchableOpacity style={[styles.popupPrimaryBtn, { marginTop: 16 }]} onPress={() => setShowNotif(false)}>
                    <Text style={styles.popupPrimaryBtnText}>{t('Save')}</Text>
                </TouchableOpacity>
            </PopupModal>

            {/* ── Logout Popup ── */}
            <Modal visible={showLogout} transparent animationType="fade" onRequestClose={() => setShowLogout(false)}>
                <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowLogout(false)}>
                    <TouchableOpacity activeOpacity={1}
                        style={[styles.logoutPopup, { backgroundColor: isDark ? '#1e1e1e' : '#fff' }]}
                    >
                        <View style={styles.logoutIconWrap}>
                            <Ionicons name="log-out-outline" size={36} color="#e74c3c" />
                        </View>
                        <Text style={[styles.logoutTitle, { color: isDark ? '#f0f0f0' : '#1a1a1a' }]}>
                            {t('logout')}
                        </Text>
                        <Text style={[styles.logoutMsg, { color: sub }]}>
                            {t('Are you sure want to log out?')}
                        </Text>
                        <View style={styles.logoutBtns}>
                            <TouchableOpacity
                                style={[styles.logoutCancelBtn, { borderColor: isDark ? '#444' : '#ddd' }]}
                                onPress={() => setShowLogout(false)}
                            >
                                <Text style={[styles.logoutCancelText, { color: isDark ? '#eee' : '#333' }]}>{t('Cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.logoutConfirmBtn} onPress={handleLogout}>
                                <Text style={styles.logoutConfirmText}>{t('Log out')}</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, },
    header: {
        backgroundColor: '#0084ff', height: 70,
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: 25,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { color: 'white', fontSize: 20, fontWeight: '600', marginLeft: 20 },
    profileSection: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 16,
        marginHorizontal: 15, borderRadius: 16, marginBottom: 12, marginTop: 10,
        shadowColor: '#000', shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
    },
    avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#eee' },
    profileInfo: { flex: 1, marginLeft: 15 },
    profileName: { fontSize: 16, fontWeight: 'bold' },
    profileBio: { fontSize: 12, marginTop: 2 },
    listSection: {
        marginHorizontal: 15, borderRadius: 16, overflow: 'hidden',
        shadowColor: '#000', shadowOpacity: 0.05,

        shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
    },
    itemContainer: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 13, paddingHorizontal: 18,
    },
    iconContainer: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    textContainer: { flex: 1 },
    itemTitle: { fontSize: 14, fontWeight: '600' },
    itemSubtitle: { fontSize: 11, marginTop: 2 },
    divider: { height: 1, marginLeft: 68 },
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
    },
    popup: {
        width: '100%', borderRadius: 20, padding: 22,
        shadowColor: '#000', shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 10,
    },
    popupHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
    },
    popupTitle: { fontSize: 18, fontWeight: '700' },
    popupPrimaryBtn: {
        backgroundColor: '#0084ff', borderRadius: 12,
        paddingVertical: 13, alignItems: 'center',
    },
    popupPrimaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    themeRow: { flexDirection: 'row', gap: 14, justifyContent: 'center' },
    themeCard: {
        flex: 1, borderRadius: 14, padding: 12,
        borderWidth: 2, overflow: 'hidden', alignItems: 'center',
    },
    themeCardActive: { borderWidth: 2.5 },
    themePreviewLight: {
        width: '100%', height: 80, backgroundColor: '#fff',
        borderRadius: 10, marginBottom: 10, padding: 8, gap: 6,
        borderWidth: 1, borderColor: '#eee',
    },
    themePreviewDark: {
        width: '100%', height: 80, backgroundColor: '#111',
        borderRadius: 10, marginBottom: 10, padding: 8, gap: 6,
    },
    tpHeader: { height: 12, backgroundColor: '#0084ff', borderRadius: 4 },
    tpBubble: { height: 16, width: '60%', backgroundColor: '#eee', borderRadius: 8 },
    themeLabel: { fontSize: 14, fontWeight: '600' },
    themeCheck: { marginTop: 6 },
    notifRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14, borderBottomWidth: 1,
    },
    notifLeft: { flexDirection: 'row', alignItems: 'center' },
    notifLabel: { fontSize: 14, fontWeight: '500' },
    langRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 13, paddingHorizontal: 10,
        borderBottomWidth: 1, borderRadius: 8, marginBottom: 2,
    },
    langFlag: { fontSize: 26, marginRight: 14 },
    langLabel: { fontSize: 14, fontWeight: '600' },
    langNative: { fontSize: 12, marginTop: 2 },
    logoutPopup: {
        width: '88%', borderRadius: 22, padding: 28, alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 10,
    },
    logoutIconWrap: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: '#fff0ee', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
    },
    logoutTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
    logoutMsg: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    logoutBtns: { flexDirection: 'row', gap: 12, width: '100%' },
    logoutCancelBtn: {
        flex: 1, paddingVertical: 13, borderRadius: 12,
        borderWidth: 1.5, alignItems: 'center',
    },
    logoutCancelText: { fontSize: 15, fontWeight: '600' },
    logoutConfirmBtn: {
        flex: 1, paddingVertical: 13, borderRadius: 12,
        backgroundColor: '#e74c3c', alignItems: 'center',
    },
    logoutConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
