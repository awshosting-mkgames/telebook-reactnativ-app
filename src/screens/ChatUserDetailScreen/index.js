import React, { useState, useContext, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, Alert, SafeAreaView, StatusBar,
    Platform, Modal, FlatList, Dimensions, Animated, Share, TextInput,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import * as Contacts from 'expo-contacts/legacy';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import apiService from '../../services/apiService';
import { apiErrorMessage, fetchBlockedUsers, setBlocked as setBlockedApi } from '../../services/chatActions';
import { syncAllTabData } from '../../services/chatSync';
import Config from '../../services/config';
import { contactSync } from '../../services/contactSync';
import { useBadgePlacements, badgeTextColor } from '../../services/badgeConfig';
import { APP_LINK_HOST } from '../../navigation/deepLinks';
const BASE_URL = Config.Main_url;


const { width } = Dimensions.get('window');
const MEDIA_SIZE = (width - 32 - 6) / 3;

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

// reports/user ke reason enum (backend ke saath same)
const REPORT_REASONS = [
    { key: 'spam', label: 'Spam' },
    { key: 'harassment', label: 'Harassment' },
    { key: 'inappropriate_content', label: 'Inappropriate content' },
    { key: 'violence', label: 'Violence' },
    { key: 'hate_speech', label: 'Hate speech' },
    { key: 'fake_news', label: 'Fake news' },
    { key: 'scam', label: 'Scam' },
    { key: 'other', label: 'Other' },
];

const last10 = (v) => String(v ?? '').replace(/\D/g, '').slice(-10);

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatPhone = (raw) => {
    if (!raw) return '';
    const d = raw.replace(/\D/g, '');
    if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
    if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
    if (d.length > 10) return `+${d.slice(0, d.length - 10)} ${d.slice(-10, -5)} ${d.slice(-5)}`;
    return raw;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `Today at ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return Config.MEDIA_URL + path;
};

const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ── Confirm Modal ─────────────────────────────────────────────────────────────
const ConfirmModal = ({ visible, onClose, onConfirm, title, message, confirmLabel, isDanger, isDark }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={cm.overlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
            <View style={[cm.box, { backgroundColor: isDark ? '#1e1e1e' : '#fff' }]}>
                <View style={[cm.iconWrap, { backgroundColor: isDanger ? '#fff0f0' : '#f0f4ff' }]}>
                    <Ionicons
                        name={isDanger ? 'warning-outline' : 'trash-outline'}
                        size={28}
                        color={isDanger ? '#e53935' : '#0084ff'}
                    />
                </View>
                <Text style={[cm.title, { color: isDark ? '#f0f0f0' : '#1a1a1a' }]}>{title}</Text>
                <Text style={[cm.msg, { color: isDark ? '#999' : '#777' }]}>{message}</Text>
                <View style={cm.btns}>
                    <TouchableOpacity
                        style={[cm.cancelBtn, { borderColor: isDark ? '#333' : '#e0e0e0' }]}
                        onPress={onClose}
                    >
                        <Text style={[cm.cancelTxt, { color: isDark ? '#aaa' : '#666' }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[cm.confirmBtn, { backgroundColor: isDanger ? '#e53935' : '#0084ff' }]}
                        onPress={() => { onConfirm(); onClose(); }}
                    >
                        <Text style={cm.confirmTxt}>{confirmLabel}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </Modal>
);
const cm = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 24 },
    box: { width: '100%', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 12 },
    iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
    msg: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
    btns: { flexDirection: 'row', gap: 12, width: '100%' },
    cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
    cancelTxt: { fontSize: 15, fontWeight: '600' },
    confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
    confirmTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ── Media Viewer Modal ────────────────────────────────────────────────────────
const MediaModal = ({ visible, onClose, items, startIndex }) => {
    const { t } = useTranslation();
    const [current, setCurrent] = useState(startIndex);
    useEffect(() => { setCurrent(startIndex); }, [startIndex]);
    if (!items?.length) return null;
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={mm.overlay}>
                <TouchableOpacity style={mm.closeBtn} onPress={onClose}>
                    <Ionicons name="close" size={26} color="#fff" />
                </TouchableOpacity>
                <Text style={mm.counter}>{current + 1} / {items.length}</Text>
                <FlatList
                    data={items}
                    keyExtractor={(_, i) => String(i)}
                    horizontal pagingEnabled
                    initialScrollIndex={startIndex}
                    getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                    onMomentumScrollEnd={e => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
                    renderItem={({ item }) => (
                        <View style={{ width, justifyContent: 'center', alignItems: 'center' }}>
                            <Image source={{ uri: item.url }} style={mm.img} resizeMode="contain" />
                        </View>
                    )}
                />
            </View>
        </Modal>
    );
};
const mm = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: '#000' },
    closeBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 6 },
    counter: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 34, alignSelf: 'center', color: '#fff', fontSize: 14, fontWeight: '600', zIndex: 10 },
    img: { width, height: '100%' },
});

// ── Empty State ───────────────────────────────────────────────────────────────
const MediaEmpty = ({ label, icon, sub }) => (
    <View style={{ alignItems: 'center', paddingVertical: 30, gap: 8 }}>
        <Ionicons name={icon} size={36} color="#ccc" />
        <Text style={{ fontSize: 14, color: sub }}>{label}</Text>
    </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
const ChatUserDetailScreen = ({ navigation, route }) => {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const { chatId } = route.params;
    const maniAllData = useSelector(s => s.totalappData);
    const MY_USER_ID = maniAllData?.userId ?? '';
    const dispatch = useDispatch();
    const blockedIds = useSelector(s => s.chatList?.blockedIds ?? []);

    const isDark = theme?.mode === 'dark';
    const bg = isDark ? '#121212' : '#f5f7fa';
    const card = isDark ? '#1e1e1e' : '#ffffff';
    const txt = isDark ? '#f0f0f0' : '#1a1a1a';
    const sub = isDark ? '#999' : '#888';
    const border = isDark ? '#2a2a2a' : '#f0f0f0';

    // ── State ─────────────────────────────────────────────────────────────────
    const [chatInfo, setChatInfo] = useState(null);
    const [mediaDetails, setMediaDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('photos'); // photos | videos | docs | audio
    const [muted, setMuted] = useState(false);
    const [showBlock, setShowBlock] = useState(false);
    const [showClear, setShowClear] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [mediaModal, setMediaModal] = useState(false);
    const [mediaIndex, setMediaIndex] = useState(0);
    const [loadingBlock, setLoadingBlock] = useState(false);
    const [toast, setToast] = useState('');
    const placements = useBadgePlacements();
    const [fetchedBadge, setFetchedBadge] = useState(null);
    const [reportReason, setReportReason] = useState('spam');
    const [reportDesc, setReportDesc] = useState('');
    const [reporting, setReporting] = useState(false);
    const [savingContact, setSavingContact] = useState(false);
    const accent = theme?.main || theme?.maincolor || '#0499FF';

    // ── Toast ─────────────────────────────────────────────────────────────────
    const toastAnim = useRef(new Animated.Value(0)).current;
    const showToast = (msg) => {
        setToast(msg);
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.delay(1800),
            Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start();
    };

    // ── Fetch Chat Info ───────────────────────────────────────────────────────
    useEffect(() => { getChatInfo(); }, []);

    const getChatInfo = async () => {
        try {
            setLoading(true);
            const response = await apiService({
                method: 'GET',
                endpoint: `chats/${chatId}/info`,
            });

            if (response?.success) {
                setChatInfo(response?.data?.chat);
                setMediaDetails(response?.data?.media);
            }
        } catch (error) {
            console.error('Error fetching chat info:', error);
        } finally {
            setLoading(false);
        }
    };

    // ── Derived Data ──────────────────────────────────────────────────────────
    const otherUser = chatInfo?.otherUser;
    const avatarUri = getImageUrl(otherUser?.profilePicture) || DEFAULT_AVATAR;
    const phone = formatPhone(otherUser?.mobile ?? '');
    // Null-name safety: name || mobile || 'User'
    const displayName = otherUser?.name || phone || otherUser?.mobile || 'User';
    const planBadge = otherUser?.planBadge ?? fetchedBadge;
    const inviteCode = otherUser?.inviteCode || '';
    const inviteLink = inviteCode ? `https://${APP_LINK_HOST}/u/${inviteCode}` : '';

    // chats/:id/info me planBadge na aaye to users/:id se ek baar le lo
    useEffect(() => {
        if (!otherUser?._id || otherUser.planBadge !== undefined) return;
        let alive = true;
        (async () => {
            const res = await apiService({ method: 'GET', endpoint: `users/${otherUser._id}` });
            const b = res?.data?.user?.planBadge;
            if (alive && b) setFetchedBadge(b);
        })();
        return () => { alive = false; };
    }, [otherUser?._id, otherUser?.planBadge]);
    // Block state server ki blocked list (Redux) se — pehle hamesha false se shuru hota tha
    const blocked = !!otherUser?._id && blockedIds.includes(otherUser._id);
    useEffect(() => { fetchBlockedUsers(dispatch); }, [dispatch]);

    // ✅ Flat image+video list — for MediaModal fullscreen viewer
    const allViewableMedia = [
        ...(mediaDetails?.images?.items || []),
        ...(mediaDetails?.videos?.items || []),
    ].map(item => ({
        url: getImageUrl(item?.attachments?.[0]?.url),
        type: item?.messageType,
    })).filter(f => f.url);

    // ✅ Per-tab mapped data
    const tabData = {
        photos: (mediaDetails?.images?.items || []).map(item => ({ ...item, _mediaUrl: getImageUrl(item?.attachments?.[0]?.url) })).filter(i => i._mediaUrl),
        videos: (mediaDetails?.videos?.items || []).map(item => ({ ...item, _mediaUrl: getImageUrl(item?.attachments?.[0]?.url) })).filter(i => i._mediaUrl),
        docs: (mediaDetails?.documents?.items || []).map(item => ({ ...item, _attachment: item?.attachments?.[0] })),
        audio: (mediaDetails?.audios?.items || []).map(item => ({ ...item, _attachment: item?.attachments?.[0] })),
    };

    // ✅ Only show tabs that have items
    const TABS = [
        { key: 'photos', label: 'Photos', icon: 'image-outline', count: mediaDetails?.images?.count || 0, color: '#0084ff' },
        { key: 'videos', label: 'Videos', icon: 'videocam-outline', count: mediaDetails?.videos?.count || 0, color: '#8e44ad' },
        { key: 'docs', label: 'Docs', icon: 'document-outline', count: mediaDetails?.documents?.count || 0, color: '#f39c12' },
        { key: 'audio', label: 'Audio', icon: 'mic-outline', count: mediaDetails?.audios?.count || 0, color: '#27ae60' },
    ].filter(t => t.count > 0);

    const hasAnyMedia = (mediaDetails?.total || 0) > 0;

    // ── Block / Unblock ───────────────────────────────────────────────────────
    const handleBlock = async () => {
        setLoadingBlock(true);
        try {
            const res = await setBlockedApi(dispatch, otherUser?._id, !blocked);
            if (!res.ok) throw new Error(res.message);
            showToast(blocked ? 'User unblocked' : 'User blocked');
        } catch {
            Alert.alert('Error', 'Action failed. Try again.');
        } finally {
            setLoadingBlock(false);
        }
    };

    const handleClearChat = async () => {
        try {
            // DELETE /chats/:chatId/clear (API doc 6.3)
            const res = await apiService({ method: 'DELETE', endpoint: `chats/${chatId}/clear` });
            if (!res?.success) throw new Error(apiErrorMessage(res));
            syncAllTabData(dispatch, MY_USER_ID, { background: true });
            showToast('Chat cleared');
        } catch {
            Alert.alert('Error', 'Could not clear chat. Try again.');
        }
    };

    // POST reports/user — reason picker sheet se. 409 ALREADY_REPORTED => friendly toast
    const handleReport = async () => {
        if (!otherUser?._id || reporting) return;
        setReporting(true);
        try {
            const res = await apiService({
                method: 'POST',
                endpoint: 'reports/user',
                data: { userId: otherUser._id, reason: reportReason, description: reportDesc.trim() || undefined },
            });
            setShowReport(false);
            if (res?.success) {
                setReportDesc('');
                showToast('Report submitted');
            } else if (res?.error?.code === 'ALREADY_REPORTED') {
                showToast('You have already reported this user');
            } else {
                Alert.alert('Error', apiErrorMessage(res, 'Could not submit report. Try again.'));
            }
        } catch {
            Alert.alert('Error', 'Could not submit report. Try again.');
        } finally {
            setReporting(false);
        }
    };

    const handleCopyNumber = () => {
        if (!otherUser?.mobile) return;
        Clipboard.setString(String(otherUser.mobile));
        showToast('Number copied');
    };

    const handleCopyLink = () => {
        if (!inviteLink) return;
        Clipboard.setString(inviteLink);
        showToast('Link copied');
    };

    const handleShareLink = async () => {
        if (!inviteLink) return;
        try {
            await Share.share({ message: `Chat with ${displayName} on Telebook: ${inviteLink}` });
        } catch (e) { /* user cancelled */ }
    };

    // Phonebook me save: permission -> duplicate check (number se) -> addContactAsync
    const handleSaveContact = async () => {
        const mobile = otherUser?.mobile;
        if (!mobile || savingContact) return;
        setSavingContact(true);
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status !== 'granted') {
                showToast('Contacts permission is needed');
                return;
            }
            const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
            const target = last10(mobile);
            const exists = (data || []).some((c) => (c.phoneNumbers || []).some((p) => last10(p.number) === target));
            if (exists) {
                showToast('Contact already saved');
                return;
            }
            const nm = otherUser?.name || String(mobile);
            await Contacts.addContactAsync({
                contactType: Contacts.ContactTypes.Person,
                name: nm,
                firstName: nm,
                phoneNumbers: [{ label: 'mobile', number: String(mobile) }],
            });
            showToast('Contact saved');
            // Chat list title naye saved naam se badle — background me, UI block nahi
            contactSync(dispatch, { silent: true }).catch(() => {});
        } catch (e) {
            showToast('Could not save contact');
        } finally {
            setSavingContact(false);
        }
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
                <StatusBar backgroundColor="#0084ff" barStyle="light-content" />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('Profile')}</Text>
                    <View style={styles.moreBtn} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0084ff" />
                    <Text style={[styles.loadingText, { color: sub }]}>Loading contact info...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
            <StatusBar backgroundColor="#0084ff" barStyle="light-content" />

            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('Profile')}</Text>

            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                {/* ── Profile Hero Card ── */}
                <View style={[styles.heroCard, { backgroundColor: card }]}>
                    <View style={styles.heroGradient} />
                    <View style={styles.avatarWrap}>
                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                        {otherUser?.isOnline && <View style={styles.onlineDot} />}
                    </View>
                    <Text style={[styles.heroName, { color: txt }]}>
                        {displayName}
                    </Text>
                    <View style={styles.phoneRow}>
                        <Ionicons name="call-outline" size={13} color="#0084ff" />
                        <Text style={[styles.phoneText, { color: sub }]}>{phone || 'No number'}</Text>
                    </View>
                    {!!planBadge?.profileLabel && placements.profile && (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate('Plans')}
                            style={[styles.planPill, { backgroundColor: planBadge.color || accent }]}
                        >
                            <Text style={[styles.planPillText, { color: badgeTextColor(planBadge.color || accent) }]} numberOfLines={1}>
                                {planBadge.profileLabel}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {otherUser?.isOnline ? (
                        <View style={styles.onlineBadge}>
                            <View style={styles.onlinePulse} />
                            <Text style={styles.onlineTxt}>Online</Text>
                        </View>
                    ) : (
                        <Text style={[styles.lastSeenTxt, { color: sub }]}>
                            Last seen {formatDate(otherUser?.lastSeen)}
                        </Text>
                    )}
                    {(chatInfo?.totalMessages > 0 || chatInfo?.starredMessages > 0 || mediaDetails?.total > 0) && (
                        <View style={styles.statsRow}>
                            {chatInfo?.totalMessages > 0 && (
                                <View style={[styles.statBox, { backgroundColor: isDark ? '#1a2a3a' : '#e8f4ff' }]}>
                                    <Ionicons name="chatbubbles-outline" size={14} color="#0084ff" />
                                    <Text style={[styles.statNum, { color: txt }]}>{chatInfo.totalMessages.toLocaleString()}</Text>
                                    <Text style={[styles.statLabel, { color: sub }]}>Messages</Text>
                                </View>
                            )}
                            {chatInfo?.starredMessages > 0 && (
                                <View style={[styles.statBox, { backgroundColor: isDark ? '#2a2210' : '#fff8e1' }]}>
                                    <Ionicons name="star-outline" size={14} color="#f39c12" />
                                    <Text style={[styles.statNum, { color: txt }]}>{chatInfo.starredMessages}</Text>
                                    <Text style={[styles.statLabel, { color: sub }]}>Starred</Text>
                                </View>
                            )}
                            {mediaDetails?.total > 0 && (
                                <View style={[styles.statBox, { backgroundColor: isDark ? '#2a1a3a' : '#f0e8ff' }]}>
                                    <Ionicons name="images-outline" size={14} color="#8e44ad" />
                                    <Text style={[styles.statNum, { color: txt }]}>{mediaDetails.total}</Text>
                                    <Text style={[styles.statLabel, { color: sub }]}>{t('Photos')}</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>

                {/* ── About ── */}
                {!!otherUser?.about && (
                    <View style={[styles.infoCard, { backgroundColor: card, borderColor: border }]}>
                        <View style={[styles.infoIconWrap, { backgroundColor: '#fff0e8' }]}>
                            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#e67e22" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.infoLabel, { color: sub }]}>About</Text>
                            <Text style={[styles.infoValue, { color: txt }]}>{otherUser.about}</Text>
                        </View>
                    </View>
                )}

                {/* ── Phone ── */}
                <View style={[styles.infoCard, { backgroundColor: card, borderColor: border }]}>
                    <View style={[styles.infoIconWrap, { backgroundColor: '#e8fff0' }]}>
                        <Ionicons name="call-outline" size={18} color="#27ae60" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.infoLabel, { color: sub }]}>Phone</Text>
                        <Text style={[styles.infoValue, { color: txt }]}>{phone || 'Not available'}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.copyBtn, { backgroundColor: isDark ? '#1a2a1a' : '#e8fff0' }]}
                        onPress={handleCopyNumber}
                    >
                        <Ionicons name="copy-outline" size={16} color="#27ae60" />
                    </TouchableOpacity>
                </View>

                {/* ── Quick actions: Save Contact / Copy Link / Share Link (blocked => hidden) ── */}
                {!blocked && !!otherUser?.mobile && (
                    <View style={[styles.actionsCard, { backgroundColor: card, borderColor: border }]}>
                        <TouchableOpacity style={styles.actionBtn} onPress={handleSaveContact} disabled={savingContact} activeOpacity={0.7}>
                            {savingContact
                                ? <ActivityIndicator size="small" color={accent} />
                                : <Ionicons name="person-add-outline" size={22} color={accent} />}
                            <Text style={[styles.actionTxt, { color: txt }]} numberOfLines={2}>Save Contact</Text>
                        </TouchableOpacity>
                        {!!inviteLink && (
                            <>
                                <TouchableOpacity style={styles.actionBtn} onPress={handleCopyLink} activeOpacity={0.7}>
                                    <Ionicons name="link-outline" size={22} color={accent} />
                                    <Text style={[styles.actionTxt, { color: txt }]} numberOfLines={2}>Copy Contact Link</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionBtn} onPress={handleShareLink} activeOpacity={0.7}>
                                    <Ionicons name="share-social-outline" size={22} color={accent} />
                                    <Text style={[styles.actionTxt, { color: txt }]} numberOfLines={2}>Share Contact Link</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}

                {/* ── Chat Since ── */}
                {!!chatInfo?.createdAt && (
                    <View style={[styles.infoCard, { backgroundColor: card, borderColor: border }]}>
                        <View style={[styles.infoIconWrap, { backgroundColor: isDark ? '#1a2a3a' : '#e8f4ff' }]}>
                            <Ionicons name="calendar-outline" size={18} color="#0084ff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.infoLabel, { color: sub }]}>Chatting Since</Text>
                            <Text style={[styles.infoValue, { color: txt }]}>
                                {new Date(chatInfo.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </Text>
                        </View>
                    </View>
                )}

                {/* ════════════════════════════════════════════════════
                    ──  MEDIA SECTION — WhatsApp-style tabbed  ──
                ════════════════════════════════════════════════════ */}
                {hasAnyMedia && (
                    <View style={[styles.mediaCard, { backgroundColor: card }]}>

                        {/* Section header */}
                        <View style={styles.mediaSectionHeader}>
                            <View style={styles.mediaSectionLeft}>
                                <View style={[styles.infoIconWrap, { backgroundColor: '#f0e8ff' }]}>
                                    <Ionicons name="images-outline" size={18} color="#8e44ad" />
                                </View>
                                <Text style={[styles.sectionTitle, { color: txt }]}>Media, Links & Docs</Text>
                                <View style={[styles.countBadge, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
                                    <Text style={[styles.countTxt, { color: sub }]}>{mediaDetails?.total || 0}</Text>
                                </View>
                            </View>
                        </View>

                        {/* ── Tab Bar ── */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.tabBar}
                            contentContainerStyle={styles.tabBarContent}
                        >
                            {TABS.map(tab => {
                                const isActive = activeTab === tab.key;
                                return (
                                    <TouchableOpacity
                                        key={tab.key}
                                        style={[
                                            styles.tabBtn,
                                            isActive
                                                ? { backgroundColor: tab.color, borderColor: tab.color }
                                                : { backgroundColor: isDark ? '#2a2a2a' : '#f4f4f4', borderColor: isDark ? '#333' : '#ebebeb' }
                                        ]}
                                        onPress={() => setActiveTab(tab.key)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name={tab.icon} size={14} color={isActive ? '#fff' : tab.color} />
                                        <Text style={[styles.tabLabel, { color: isActive ? '#fff' : (isDark ? '#ccc' : '#555') }]}>
                                            {tab.label}
                                        </Text>
                                        <View style={[styles.tabCount, { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : (isDark ? '#333' : '#e0e0e0') }]}>
                                            <Text style={[styles.tabCountTxt, { color: isActive ? '#fff' : sub }]}>{tab.count}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* ── Photos Grid ── */}
                        {activeTab === 'photos' && (
                            tabData.photos.length > 0 ? (
                                <View style={styles.mediaGrid}>
                                    {tabData.photos.map((item, index) => (
                                        <TouchableOpacity
                                            key={item._id || index}
                                            style={styles.mediaThumb}
                                            onPress={() => { setMediaIndex(index); setMediaModal(true); }}
                                            activeOpacity={0.85}
                                        >
                                            <Image source={{ uri: item._mediaUrl }} style={styles.mediaImg} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : <MediaEmpty label="No photos yet" icon="image-outline" sub={sub} />
                        )}

                        {/* ── Videos Grid ── */}
                        {activeTab === 'videos' && (
                            tabData.videos.length > 0 ? (
                                <View style={styles.mediaGrid}>
                                    {tabData.videos.map((item, index) => (
                                        <TouchableOpacity
                                            key={item._id || index}
                                            style={styles.mediaThumb}
                                            onPress={() => {
                                                // offset by photos count so viewer index is correct
                                                setMediaIndex(tabData.photos.length + index);
                                                setMediaModal(true);
                                            }}
                                            activeOpacity={0.85}
                                        >
                                            <Image source={{ uri: item._mediaUrl }} style={styles.mediaImg} />
                                            <View style={styles.playOverlay}>
                                                <View style={styles.playCircle}>
                                                    <Ionicons name="play" size={16} color="#fff" />
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : <MediaEmpty label="No videos yet" icon="videocam-outline" sub={sub} />
                        )}

                        {/* ── Documents List ── */}
                        {activeTab === 'docs' && (
                            tabData.docs.length > 0 ? (
                                <View style={styles.docList}>
                                    {tabData.docs.map((item, index) => {
                                        const att = item._attachment;
                                        const ext = att?.filename?.split('.').pop()?.toUpperCase() || 'FILE';
                                        const isLast = index === tabData.docs.length - 1;
                                        return (
                                            <View
                                                key={item._id || index}
                                                style={[styles.docRow, { borderBottomColor: border, borderBottomWidth: isLast ? 0 : 1 }]}
                                            >
                                                <View style={[styles.docIconBox, { backgroundColor: isDark ? '#2a2210' : '#fff8e1' }]}>
                                                    <Ionicons
                                                        name={ext === 'PDF' ? 'document-text-outline' : 'attach-outline'}
                                                        size={22}
                                                        color="#f39c12"
                                                    />
                                                    <Text style={styles.docExt}>{ext}</Text>
                                                </View>
                                                <View style={styles.docInfo}>
                                                    <Text style={[styles.docName, { color: txt }]} numberOfLines={1}>
                                                        {att?.filename || 'Document'}
                                                    </Text>
                                                    <View style={styles.docMeta}>
                                                        {!!att?.fileSize && (
                                                            <Text style={[styles.docMetaTxt, { color: sub }]}>{formatFileSize(att.fileSize)}</Text>
                                                        )}
                                                        {!!item.createdAt && (
                                                            <Text style={[styles.docMetaTxt, { color: sub }]}>• {formatDate(item.createdAt)}</Text>
                                                        )}
                                                    </View>
                                                    {!!item?.sender?.name && (
                                                        <Text style={[styles.docSender, { color: '#0084ff' }]} numberOfLines={1}>
                                                            {item.sender.name}
                                                        </Text>
                                                    )}
                                                </View>
                                                <TouchableOpacity style={styles.docAction}>
                                                    <Ionicons name="download-outline" size={20} color="#0084ff" />
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : <MediaEmpty label="No documents yet" icon="document-outline" sub={sub} />
                        )}

                        {/* ── Audio List ── */}
                        {activeTab === 'audio' && (
                            tabData.audio.length > 0 ? (
                                <View style={styles.docList}>
                                    {tabData.audio.map((item, index) => {
                                        const att = item._attachment;
                                        const isLast = index === tabData.audio.length - 1;
                                        return (
                                            <View
                                                key={item._id || index}
                                                style={[styles.docRow, { borderBottomColor: border, borderBottomWidth: isLast ? 0 : 1 }]}
                                            >
                                                <View style={[styles.audioIconBox, { backgroundColor: isDark ? '#1a3a1a' : '#e8fff0' }]}>
                                                    <Ionicons name="mic" size={22} color="#27ae60" />
                                                </View>
                                                <View style={styles.docInfo}>
                                                    <Text style={[styles.docName, { color: txt }]} numberOfLines={1}>
                                                        {att?.filename || 'Voice message'}
                                                    </Text>
                                                    <View style={styles.docMeta}>
                                                        {!!att?.fileSize && (
                                                            <Text style={[styles.docMetaTxt, { color: sub }]}>{formatFileSize(att.fileSize)}</Text>
                                                        )}
                                                        {!!item.createdAt && (
                                                            <Text style={[styles.docMetaTxt, { color: sub }]}>• {formatDate(item.createdAt)}</Text>
                                                        )}
                                                    </View>
                                                    {!!item?.sender?.name && (
                                                        <Text style={[styles.docSender, { color: '#27ae60' }]} numberOfLines={1}>
                                                            {item.sender.name}
                                                        </Text>
                                                    )}
                                                </View>
                                                <TouchableOpacity style={styles.docAction}>
                                                    <Ionicons name="play-circle" size={32} color="#27ae60" />
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : <MediaEmpty label="No audio yet" icon="mic-outline" sub={sub} />
                        )}

                    </View>
                )}

                <View style={[styles.dangerSection, { backgroundColor: card }]}>
                    <TouchableOpacity
                        style={[styles.dangerRow, { borderBottomColor: border }]}
                        onPress={() => setShowBlock(true)}
                        activeOpacity={0.7}
                        disabled={loadingBlock}
                    >
                        <View style={styles.dangerIconWrap}>
                            {loadingBlock
                                ? <ActivityIndicator size="small" color="#e53935" />
                                : <Ionicons name={blocked ? 'checkmark-circle-outline' : 'ban-outline'} size={20} color="#e53935" />
                            }
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.dangerLabel}>{blocked ? 'Unblock User' : 'Block User'}</Text>
                            <Text style={styles.dangerSub}>
                                {blocked ? 'Allow messages again' : "They won't be able to message you"}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#e53935" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.dangerRow, { borderBottomWidth: 0 }]}
                        onPress={() => setShowReport(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.dangerIconWrap}>
                            <Ionicons name="flag-outline" size={20} color="#e53935" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.dangerLabel}>Report User</Text>
                            <Text style={styles.dangerSub}>Report spam, abuse or a scam</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#e53935" />
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* ── Toast ── */}
            <Animated.View style={[styles.toast, {
                opacity: toastAnim,
                transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            }]}>
                <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                <Text style={styles.toastTxt}>{toast}</Text>
            </Animated.View>

            {/* ── Modals ── */}
            <ConfirmModal
                visible={showBlock} onClose={() => setShowBlock(false)} onConfirm={handleBlock}
                title={blocked ? `Unblock ${displayName}?` : `Block ${displayName}?`}
                message={blocked ? `${displayName} will be able to send you messages again.` : `${displayName} won't be able to send you messages or see your status.`}
                confirmLabel={blocked ? 'Unblock' : 'Block'} isDanger isDark={isDark}
            />
            <ConfirmModal
                visible={showClear} onClose={() => setShowClear(false)} onConfirm={handleClearChat}
                title="Clear Chat?" message="All messages will be permanently deleted. This cannot be undone."
                confirmLabel="Clear All" isDanger={false} isDark={isDark}
            />
            {/* Report: reason picker (local bottom sheet) */}
            <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
                <View style={rs.overlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowReport(false)} />
                    <View style={[rs.sheet, { backgroundColor: card }]}>
                        <Text style={[rs.title, { color: txt }]} numberOfLines={2}>Report {displayName}</Text>
                        <Text style={[rs.sub, { color: sub }]}>Your report will be reviewed. They won't be notified.</Text>
                        {REPORT_REASONS.map((r) => (
                            <TouchableOpacity key={r.key} style={rs.row} onPress={() => setReportReason(r.key)} activeOpacity={0.7}>
                                <Ionicons
                                    name={reportReason === r.key ? 'radio-button-on' : 'radio-button-off'}
                                    size={20}
                                    color={reportReason === r.key ? accent : sub}
                                />
                                <Text style={[rs.rowTxt, { color: txt }]}>{r.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <TextInput
                            style={[rs.input, { color: txt, borderColor: border }]}
                            placeholder="Add details (optional)"
                            placeholderTextColor={sub}
                            value={reportDesc}
                            onChangeText={setReportDesc}
                            maxLength={500}
                            multiline
                        />
                        <View style={rs.btns}>
                            <TouchableOpacity style={[rs.btn, { borderColor: border, borderWidth: 1.5 }]} onPress={() => setShowReport(false)}>
                                <Text style={[rs.btnTxt, { color: sub }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[rs.btn, { backgroundColor: '#e53935' }]} onPress={handleReport} disabled={reporting}>
                                {reporting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[rs.btnTxt, { color: '#fff' }]}>Report</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <MediaModal
                visible={mediaModal} onClose={() => setMediaModal(false)}
                items={allViewableMedia} startIndex={mediaIndex} isDark={isDark}
            />
        </SafeAreaView>
    );
};

export default ChatUserDetailScreen;

const rs = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28 },
    title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
    sub: { fontSize: 13, marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
    rowTxt: { fontSize: 15 },
    input: { borderWidth: 1, borderRadius: 12, padding: 10, minHeight: 44, maxHeight: 90, marginTop: 8, fontSize: 14 },
    btns: { flexDirection: 'row', gap: 12, marginTop: 14 },
    btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnTxt: { fontSize: 15, fontWeight: '700' },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 15 },

    header: { height: 90, backgroundColor: '#0084ff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 22 },
    backBtn: { marginRight: 12, padding: 2 },
    headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '700' },
    moreBtn: { padding: 4 },

    // Hero Card
    heroCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, alignItems: 'center', paddingBottom: 24, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4 },
    heroGradient: { height: 70, width: '100%', backgroundColor: '#0084ff', marginBottom: -35 },
    avatarWrap: { position: 'relative', marginBottom: 12 },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff', shadowColor: '#0084ff', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6 },
    onlineDot: { position: 'absolute', bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#25D366', borderWidth: 3, borderColor: '#fff' },
    heroName: { fontSize: 22, fontWeight: '800', marginBottom: 6, letterSpacing: -0.3 },
    phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
    phoneText: { fontSize: 13, fontWeight: '500' },
    onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e8fff0', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 16 },
    onlinePulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#25D366' },
    onlineTxt: { fontSize: 12, fontWeight: '600', color: '#27ae60' },
    lastSeenTxt: { fontSize: 12, marginBottom: 16 },
    statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 4 },
    statBox: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, gap: 3 },
    statNum: { fontSize: 16, fontWeight: '800' },
    statLabel: { fontSize: 11, fontWeight: '500' },

    // Info Cards
    infoCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, borderRadius: 16, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2, gap: 14 },
    infoIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    infoLabel: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
    infoValue: { fontSize: 15, fontWeight: '600' },
    planPill: { alignSelf: 'center', maxWidth: '85%', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, marginBottom: 10 },
    planPillText: { fontSize: 12, fontWeight: '700' },
    actionsCard: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, borderRadius: 16, padding: 8, borderWidth: 1, gap: 6 },
    actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 6, paddingVertical: 10, paddingHorizontal: 4 },
    actionTxt: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
    copyBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

    // ── Media Card ──
    mediaCard: { marginHorizontal: 16, marginTop: 10, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 10, elevation: 3, paddingBottom: 12 },
    mediaSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
    mediaSectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sectionTitle: { fontSize: 15, fontWeight: '700' },
    countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    countTxt: { fontSize: 12, fontWeight: '600' },

    // Tab Bar
    tabBar: { paddingLeft: 14, marginBottom: 12 },
    tabBarContent: { gap: 8, paddingRight: 14 },
    tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
    tabLabel: { fontSize: 13, fontWeight: '600' },
    tabCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
    tabCountTxt: { fontSize: 11, fontWeight: '700' },

    // Photo / Video Grid
    mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, paddingHorizontal: 12, paddingBottom: 4 },
    mediaThumb: { width: MEDIA_SIZE, height: MEDIA_SIZE, borderRadius: 8, overflow: 'hidden', backgroundColor: '#eee' },
    mediaImg: { width: '100%', height: '100%' },
    playOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
    playCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },

    // Doc / Audio List
    docList: { paddingHorizontal: 14, paddingBottom: 4 },
    docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
    docIconBox: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    audioIconBox: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
    docExt: { fontSize: 9, fontWeight: '800', color: '#f39c12', marginTop: 1 },
    docInfo: { flex: 1 },
    docName: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
    docMeta: { flexDirection: 'row', gap: 5, alignItems: 'center' },
    docMetaTxt: { fontSize: 12 },
    docSender: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    docAction: { padding: 4 },

    // Settings
    settingsSection: { marginHorizontal: 16, marginTop: 10, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3 },
    settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 14 },
    settingLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
    settingSub: { fontSize: 12 },
    toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center', padding: 2 },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 2 },

    // Danger
    dangerSection: { marginHorizontal: 16, marginTop: 10, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(229,57,53,0.2)', shadowColor: '#e53935', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
    dangerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 14 },
    dangerIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    dangerLabel: { fontSize: 15, fontWeight: '600', color: '#e53935', marginBottom: 2 },
    dangerSub: { fontSize: 12, color: 'rgba(229,57,53,0.65)' },

    // Toast
    toast: { position: 'absolute', bottom: 30, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a1a1a', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 8 },
    toastTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
