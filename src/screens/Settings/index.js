import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import i18n, { LANG_STORAGE_KEY } from '../../i18n/i18n';
import { settotalappData } from '../../redex/slices/totalappDataSlice';
import Config from '../../services/config';
import { contactSync } from '../../services/contactSync';
import { logoutUser } from '../../services/Logoutcall';
import {
    fetchNotificationSettings,
    fetchPrivacy,
    refreshMyProfile,
    saveNotificationSettings,
    savePrivacy,
} from '../../services/profileSync';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const avatarUrl = (key) => (!key ? DEFAULT_AVATAR : /^https?:/.test(key) ? key : Config.MEDIA_URL + key);

const LANGUAGES = [
    { code: 'en', label: 'English', native: 'English', flag: '🇺🇸' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
];

// API doc 6.2 — har field: everyone | contacts | nobody
const PRIVACY_FIELDS = [
    { key: 'lastSeen', label: 'Last seen & online', icon: 'time-outline' },
    { key: 'profilePhoto', label: 'Profile photo', icon: 'person-circle-outline' },
    { key: 'about', label: 'About', icon: 'information-circle-outline' },
    { key: 'status', label: 'Status', icon: 'aperture-outline' },
];
const PRIVACY_OPTIONS = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'contacts', label: 'My contacts' },
    { value: 'nobody', label: 'Nobody' },
];
const privacyLabel = (v) => PRIVACY_OPTIONS.find((o) => o.value === v)?.label ?? 'Everyone';

// API doc 6.2 — ye keys push par asar karti hain
const NOTIF_FIELDS = [
    { key: 'messageNotifications', label: 'Messages', sub: 'Private chats', icon: 'chatbubble-outline' },
    { key: 'groupNotifications', label: 'Groups', sub: 'Group chats', icon: 'people-outline' },
    { key: 'channelNotifications', label: 'Channels', sub: 'New channel posts', icon: 'megaphone-outline' },
    { key: 'sound', label: 'Sound', sub: 'Off = silent notifications', icon: 'volume-high-outline' },
    { key: 'vibration', label: 'Vibration', sub: 'Saved to your account', icon: 'phone-portrait-outline' },
];

// ── Small building blocks ────────────────────────────────────────────────────
const Sheet = ({ visible, onClose, title, children, colors }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
            <Pressable style={[styles.popup, { backgroundColor: colors.card }]} onPress={() => { }}>
                <View style={styles.popupHeader}>
                    <Text style={[styles.popupTitle, { color: colors.txt }]}>{title}</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={10}>
                        <Ionicons name="close" size={22} color={colors.sub} />
                    </TouchableOpacity>
                </View>
                {children}
            </Pressable>
        </Pressable>
    </Modal>
);

const Item = ({ icon, color, title, subtitle, onPress, colors, danger, last, right }) => (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.6}>
        <View style={[styles.itemIcon, { backgroundColor: color }]}>
            <Ionicons name={icon} size={19} color="#fff" />
        </View>
        <View style={[styles.itemBody, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: danger ? '#e74c3c' : colors.txt }]}>{title}</Text>
                {!!subtitle && <Text style={[styles.itemSub, { color: colors.sub }]} numberOfLines={1}>{subtitle}</Text>}
            </View>
            {right ?? <Ionicons name="chevron-forward" size={16} color={colors.chevron} />}
        </View>
    </TouchableOpacity>
);

const Section = ({ label, children, colors }) => (
    <>
        {label ? <Text style={[styles.sectionLabel, { color: colors.sub }]}>{label}</Text> : <View style={{ height: 20 }} />}
        <View style={[styles.card, { backgroundColor: colors.card }]}>{children}</View>
    </>
);

// ── Screen ───────────────────────────────────────────────────────────────────
export default function Settings({ navigation }) {
    const { t } = useTranslation();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const dispatch = useDispatch();
    const maniAllData = useSelector((state) => state.totalappData);
    const user = maniAllData?.user || {};
    const syncing = useSelector((state) => state.contacts?.syncing ?? false);
    const lastSyncedAt = useSelector((state) => state.contacts?.lastSyncedAt ?? null);
    const contactCount = useSelector((state) => state.contacts?.contacts?.length ?? 0);

    const isDark = theme?.mode === 'dark';
    const colors = {
        bg: isDark ? '#121212' : '#f2f4f7',
        card: isDark ? '#1e1e1e' : '#ffffff',
        txt: isDark ? '#f0f0f0' : '#1a1a1a',
        sub: isDark ? '#9a9a9a' : '#8a8f98',
        divider: isDark ? '#2a2a2a' : '#eceef1',
        chevron: isDark ? '#555' : '#c7cbd1',
        selected: isDark ? '#1a2a3a' : '#ebf5ff',
    };

    const [sheet, setSheet] = useState(null); // 'theme' | 'lang' | 'privacy' | 'notif' | 'logout'
    const [selectedLang, setSelectedLang] = useState(i18n.language || maniAllData?.lang || 'en');
    const [privacy, setPrivacy] = useState(user.privacySettings ?? null);
    const [privacyPick, setPrivacyPick] = useState(null); // kaunsa field choose ho raha hai
    const [notif, setNotif] = useState(user.notificationSettings ?? null);
    const [loggingOut, setLoggingOut] = useState(false);

    // Screen khulte hi profile + settings server se taaza
    useEffect(() => {
        refreshMyProfile(dispatch);
        fetchPrivacy().then((p) => p && setPrivacy(p));
        fetchNotificationSettings().then((n) => n && setNotif(n));
    }, [dispatch]);

    const close = () => { setSheet(null); setPrivacyPick(null); };

    const handleLanguageChange = async (code) => {
        setSelectedLang(code);
        close();
        await i18n.changeLanguage(code);
        await AsyncStorage.setItem(LANG_STORAGE_KEY, code);
        dispatch(settotalappData({ lang: code }));
    };

    const choosePrivacy = async (field, value) => {
        const prev = privacy;
        setPrivacy((p) => ({ ...(p || {}), [field]: value })); // optimistic
        setPrivacyPick(null);
        const res = await savePrivacy(dispatch, { [field]: value });
        if (res.ok) { if (res.privacySettings) setPrivacy(res.privacySettings); }
        else { setPrivacy(prev); Toast.show({ type: 'error', text1: 'Could not save', text2: res.message }); }
    };

    const toggleNotif = async (key, value) => {
        const prev = notif;
        setNotif((n) => ({ ...(n || {}), [key]: value })); // optimistic
        const res = await saveNotificationSettings(dispatch, { [key]: value });
        if (res.ok) { if (res.notificationSettings) setNotif(res.notificationSettings); }
        else { setNotif(prev); Toast.show({ type: 'error', text1: 'Could not save', text2: res.message }); }
    };

    const handleContactSync = async () => {
        if (syncing) return;
        const result = await contactSync(dispatch);
        if (result.ok) {
            Toast.show({ type: 'success', text1: 'Contacts synced', text2: `${result.count} contacts updated` });
            return;
        }
        const message = result.reason === 'permission-denied'
            ? 'Contacts permission is needed to sync'
            : result.reason === 'no-contacts'
                ? 'No contacts found on this device'
                : 'Could not sync contacts. Please try again.';
        Toast.show({ type: 'error', text1: 'Sync failed', text2: message });
    };

    const handleLogout = async () => {
        setLoggingOut(true);
        await logoutUser(navigation, dispatch);
        // isLogin false → root navigator login screen par le jata hai
    };

    const currentLangLabel = LANGUAGES.find((l) => l.code === selectedLang)?.label || 'English';
    const contactSyncSubtitle = syncing
        ? 'Syncing...'
        : lastSyncedAt ? `${contactCount} contacts · ${moment(lastSyncedAt).fromNow()}` : 'Tap to sync your contacts';
    const privacySummary = privacy ? `Last seen: ${privacyLabel(privacy.lastSeen)} · Photo: ${privacyLabel(privacy.profilePhoto)}` : 'Last seen, profile photo, about';
    const notifSummary = notif
        ? (notif.messageNotifications === false && notif.groupNotifications === false ? 'Muted' : notif.sound === false ? 'Silent' : 'On')
        : 'Messages, groups, sound';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar barStyle="light-content" backgroundColor="#0084ff" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('Settings')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Profile card → Profile screen (photo, name, about sab wahan) */}
                <TouchableOpacity
                    style={[styles.profileCard, { backgroundColor: colors.card }]}
                    onPress={() => navigation.navigate('Profile')}
                    activeOpacity={0.8}
                >
                    <Image source={{ uri: avatarUrl(user.profilePicture) }} style={styles.avatar} />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={[styles.profileName, { color: colors.txt }]} numberOfLines={1}>{user.name || 'Your name'}</Text>
                        <Text style={[styles.profileAbout, { color: colors.sub }]} numberOfLines={2}>
                            {user.about || 'Add a few words about you'}
                        </Text>
                    </View>
                    <View style={styles.editPill}>
                        <Ionicons name="pencil" size={14} color="#0084ff" />
                    </View>
                </TouchableOpacity>

                <Section label="ACCOUNT" colors={colors}>
                    <Item icon="person-outline" color="#0084ff" title={t('Profile')} subtitle="Photo, name, about, city" onPress={() => navigation.navigate('Profile')} colors={colors} />
                    <Item icon="lock-closed-outline" color="#16a085" title="Privacy" subtitle={privacySummary} onPress={() => setSheet('privacy')} colors={colors} />
                    <Item icon="notifications-outline" color="#e84393" title="Notifications" subtitle={notifSummary} onPress={() => setSheet('notif')} colors={colors} last />
                </Section>

                <Section label="APP" colors={colors}>
                    <Item icon={isDark ? 'moon-outline' : 'sunny-outline'} color="#e67e22" title="Theme" subtitle={isDark ? 'Dark' : 'Light'} onPress={() => setSheet('theme')} colors={colors} />
                    <Item icon="globe-outline" color="#1abc9c" title={t('Language')} subtitle={currentLangLabel} onPress={() => setSheet('lang')} colors={colors} />
                    <Item
                        icon="sync-outline" color="#3498db" title="Contact Sync" subtitle={contactSyncSubtitle}
                        onPress={handleContactSync} colors={colors}
                        right={syncing ? <ActivityIndicator size="small" color="#0084ff" /> : undefined}
                    />
                    <Item icon="megaphone-outline" color="#27ae60" title="Broadcast Lists" subtitle="Send one message to many" onPress={() => navigation.navigate('MyBroadcastList')} colors={colors} />
                    <Item icon="card-outline" color="#9b59b6" title="Plans / Subscription" subtitle="View your plan and usage" onPress={() => navigation.navigate('Plans')} colors={colors} />
                    <Item icon="wallet-outline" color="#f39c12" title="Coin Wallet" subtitle="Balance, packs & history" onPress={() => navigation.navigate('Wallet')} colors={colors} last />
                </Section>

                <Section label="HELP" colors={colors}>
                    <Item icon="information-circle-outline" color="#73b659" title={t('About us')} onPress={() => navigation.navigate('Aboutus')} colors={colors} />
                    <Item icon="shield-checkmark-outline" color="#5b6ee1" title={t('Privacy Policy')} onPress={() => navigation.navigate('PrivacyPolicyScreen')} colors={colors} />
                    <Item icon="document-text-outline" color="#9b59b6" title={t('Terms & Conditions')} onPress={() => navigation.navigate('TermsConditionsScreen')} colors={colors} last />
                </Section>

                <Section colors={colors}>
                    <Item icon="log-out-outline" color="#e74c3c" title={t('logout')} onPress={() => setSheet('logout')} colors={colors} danger />
                    <Item icon="trash-outline" color="#c0392b" title={t('Delete Account')} subtitle={t('Permanently delete your account')} onPress={() => navigation.navigate('Deleteaccount')} colors={colors} danger last />
                </Section>

                <Text style={[styles.version, { color: colors.sub }]}>TeleBook</Text>
            </ScrollView>

            {/* Theme */}
            <Sheet visible={sheet === 'theme'} onClose={close} title="Choose theme" colors={colors}>
                <View style={styles.themeRow}>
                    {[
                        { dark: false, label: '☀️  Light', bg: '#f8f8f8', preview: styles.themePreviewLight, bubble: '#eee', mine: '#0084ff', text: '#333' },
                        { dark: true, label: '🌙  Dark', bg: '#1a1a1a', preview: styles.themePreviewDark, bubble: '#333', mine: '#005fa3', text: '#eee' },
                    ].map((o) => {
                        const active = o.dark === isDark;
                        return (
                            <TouchableOpacity
                                key={o.label}
                                style={[styles.themeCard, { backgroundColor: o.bg, borderColor: active ? '#0084ff' : (o.dark ? '#333' : '#ddd') }]}
                                onPress={() => { if (!active) toggleTheme(); close(); }}
                                activeOpacity={0.8}
                            >
                                <View style={o.preview}>
                                    <View style={[styles.tpHeader, o.dark && { backgroundColor: '#333' }]} />
                                    <View style={[styles.tpBubble, { backgroundColor: o.bubble }]} />
                                    <View style={[styles.tpBubble, { alignSelf: 'flex-end', backgroundColor: o.mine }]} />
                                </View>
                                <Text style={[styles.themeLabel, { color: o.text }]}>{o.label}</Text>
                                {active && <Ionicons name="checkmark-circle" size={20} color="#0084ff" style={{ marginTop: 6 }} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Sheet>

            {/* Language */}
            <Sheet visible={sheet === 'lang'} onClose={close} title={t('Select Language')} colors={colors}>
                {LANGUAGES.map((lang) => (
                    <TouchableOpacity
                        key={lang.code}
                        style={[styles.optionRow, selectedLang === lang.code && { backgroundColor: colors.selected }]}
                        onPress={() => handleLanguageChange(lang.code)}
                    >
                        <Text style={styles.langFlag}>{lang.flag}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.optionLabel, { color: colors.txt }]}>{lang.label}</Text>
                            <Text style={[styles.optionSub, { color: colors.sub }]}>{lang.native}</Text>
                        </View>
                        {selectedLang === lang.code && <Ionicons name="checkmark-circle" size={22} color="#0084ff" />}
                    </TouchableOpacity>
                ))}
            </Sheet>

            {/* Privacy */}
            <Sheet
                visible={sheet === 'privacy'}
                onClose={close}
                title={privacyPick ? PRIVACY_FIELDS.find((f) => f.key === privacyPick)?.label : 'Privacy'}
                colors={colors}
            >
                {!privacyPick ? (
                    <>
                        <Text style={[styles.popupNote, { color: colors.sub }]}>Choose who can see your details.</Text>
                        {PRIVACY_FIELDS.map((f) => (
                            <TouchableOpacity key={f.key} style={styles.optionRow} onPress={() => setPrivacyPick(f.key)}>
                                <Ionicons name={f.icon} size={20} color="#0084ff" style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.optionLabel, { color: colors.txt }]}>{f.label}</Text>
                                    <Text style={[styles.optionSub, { color: colors.sub }]}>{privacyLabel(privacy?.[f.key])}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={colors.chevron} />
                            </TouchableOpacity>
                        ))}
                    </>
                ) : (
                    <>
                        {PRIVACY_OPTIONS.map((o) => {
                            const active = (privacy?.[privacyPick] ?? 'everyone') === o.value;
                            return (
                                <TouchableOpacity
                                    key={o.value}
                                    style={[styles.optionRow, active && { backgroundColor: colors.selected }]}
                                    onPress={() => choosePrivacy(privacyPick, o.value)}
                                >
                                    <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color="#0084ff" style={{ marginRight: 12 }} />
                                    <Text style={[styles.optionLabel, { color: colors.txt, flex: 1 }]}>{o.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                        <TouchableOpacity onPress={() => setPrivacyPick(null)} style={styles.backLink}>
                            <Ionicons name="chevron-back" size={16} color="#0084ff" />
                            <Text style={styles.backLinkText}>Back</Text>
                        </TouchableOpacity>
                    </>
                )}
            </Sheet>

            {/* Notifications */}
            <Sheet visible={sheet === 'notif'} onClose={close} title="Notifications" colors={colors}>
                {!notif ? (
                    <ActivityIndicator color="#0084ff" style={{ marginVertical: 24 }} />
                ) : NOTIF_FIELDS.map((f) => (
                    <View key={f.key} style={styles.optionRow}>
                        <Ionicons name={f.icon} size={20} color="#0084ff" style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.optionLabel, { color: colors.txt }]}>{f.label}</Text>
                            <Text style={[styles.optionSub, { color: colors.sub }]}>{f.sub}</Text>
                        </View>
                        <Switch
                            value={notif[f.key] !== false}
                            onValueChange={(v) => toggleNotif(f.key, v)}
                            trackColor={{ false: '#ccc', true: '#0084ff' }}
                            thumbColor="#fff"
                            activeThumbColor="#fff"
                        />
                    </View>
                ))}
            </Sheet>

            {/* Logout */}
            <Modal visible={sheet === 'logout'} transparent animationType="fade" onRequestClose={close}>
                <Pressable style={styles.overlay} onPress={loggingOut ? undefined : close}>
                    <Pressable style={[styles.logoutPopup, { backgroundColor: colors.card }]} onPress={() => { }}>
                        <View style={styles.logoutIconWrap}>
                            <Ionicons name="log-out-outline" size={34} color="#e74c3c" />
                        </View>
                        <Text style={[styles.logoutTitle, { color: colors.txt }]}>{t('logout')}</Text>
                        <Text style={[styles.logoutMsg, { color: colors.sub }]}>{t('Are you sure want to log out?')}</Text>
                        <View style={styles.logoutBtns}>
                            <TouchableOpacity style={[styles.logoutCancelBtn, { borderColor: colors.divider }]} onPress={close} disabled={loggingOut}>
                                <Text style={[styles.logoutCancelText, { color: colors.txt }]}>{t('Cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.logoutConfirmBtn} onPress={handleLogout} disabled={loggingOut}>
                                {loggingOut ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.logoutConfirmText}>{t('Log out')}</Text>}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        backgroundColor: '#0084ff', flexDirection: 'row', alignItems: 'center', gap: 18,
        paddingHorizontal: 16, paddingBottom: 14,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    scroll: { paddingBottom: 40 },

    profileCard: {
        flexDirection: 'row', alignItems: 'center', margin: 16, marginBottom: 4, padding: 16, borderRadius: 18,
        elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    },
    avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#dfe6ee' },
    profileName: { fontSize: 18, fontWeight: '700' },
    profileAbout: { fontSize: 13, marginTop: 3 },
    editPill: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e8f3ff', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

    sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginTop: 20, marginBottom: 8, marginHorizontal: 20 },
    card: {
        marginHorizontal: 16, marginTop: 4, borderRadius: 16, overflow: 'hidden',
        elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    item: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
    itemIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    itemBody: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingRight: 14, gap: 8 },
    itemTitle: { fontSize: 15, fontWeight: '600' },
    itemSub: { fontSize: 12, marginTop: 2 },
    version: { textAlign: 'center', fontSize: 12, marginTop: 24 },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    popup: { width: '100%', maxWidth: 440, borderRadius: 20, padding: 20, elevation: 10 },
    popupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    popupTitle: { fontSize: 18, fontWeight: '700' },
    popupNote: { fontSize: 13, marginBottom: 8 },
    optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
    optionLabel: { fontSize: 15, fontWeight: '500' },
    optionSub: { fontSize: 12, marginTop: 2 },
    langFlag: { fontSize: 26, marginRight: 14 },
    backLink: { flexDirection: 'row', alignItems: 'center', marginTop: 10, alignSelf: 'flex-start', padding: 6 },
    backLinkText: { color: '#0084ff', fontSize: 14, fontWeight: '600' },

    themeRow: { flexDirection: 'row', gap: 14 },
    themeCard: { flex: 1, borderRadius: 14, padding: 12, borderWidth: 2, alignItems: 'center' },
    themePreviewLight: { width: '100%', height: 80, backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, padding: 8, gap: 6, borderWidth: 1, borderColor: '#eee' },
    themePreviewDark: { width: '100%', height: 80, backgroundColor: '#111', borderRadius: 10, marginBottom: 10, padding: 8, gap: 6 },
    tpHeader: { height: 12, backgroundColor: '#0084ff', borderRadius: 4 },
    tpBubble: { height: 16, width: '60%', borderRadius: 8 },
    themeLabel: { fontSize: 14, fontWeight: '600' },

    logoutPopup: { width: '88%', maxWidth: 400, borderRadius: 22, padding: 26, alignItems: 'center', elevation: 10 },
    logoutIconWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff0ee', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    logoutTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
    logoutMsg: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 22 },
    logoutBtns: { flexDirection: 'row', gap: 12, width: '100%' },
    logoutCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
    logoutCancelText: { fontSize: 15, fontWeight: '600' },
    logoutConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#e74c3c', alignItems: 'center' },
    logoutConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
