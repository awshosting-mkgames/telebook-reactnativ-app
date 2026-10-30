import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    ImageBackground,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import { handlePlanLimit } from '../../services/planLimit';
import apiService from '../../services/apiService';
import Config from '../../services/config';
import Images from '../../utils/images';
import { appendFile } from '../../utils/uploadFile';
import { useNameResolver } from '../../services/nameResolver';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Add-member sheet ki list: keyboard khulne par sheet chhoti ho jati hai,
// isliye fixed 320 ki jagah screen ke hisaab se.
const SHEET_LIST_MAX_H = Math.round(SCREEN_H * 0.38);
const HIT = { top: 10, bottom: 10, left: 10, right: 10 };
const AVATAR_COLORS = ['#1296f3', '#25D366', '#FF9500', '#AF52DE', '#FF3B30', '#5AC8FA'];

// Synced contact ka avatar — device ki photo, warna app profile picture.
const contactAvatar = (contact) => {
    if (contact?.avatar) return contact.avatar;
    const pic = contact?.appUser?.profilePicture;
    return pic ? Config.MEDIA_URL + pic : null;
};

const appUserAvatar = (user) =>
    user?.profilePicture ? Config.MEDIA_URL + user.profilePicture : null;

// Photo na ho to naam ke pehle akshar — har jagah ek jaisa avatar.
const Avatar = ({ uri, name = '', size = 44 }) => {
    const initial = name.trim()?.[0]?.toUpperCase() || '?';
    const bg = AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
    const shape = { width: size, height: size, borderRadius: size / 2 };

    if (uri) return <Image source={{ uri }} style={[shape, { backgroundColor: '#e5e5e5' }]} />;
    return (
        <View style={[shape, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>{initial}</Text>
        </View>
    );
};

export default function BroadcastDetails({ route, navigation }) {
    const { broadcastId } = route.params;
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const resolveName = useNameResolver();
    const isDark = theme.mode !== 'light';
    const insets = useSafeAreaInsets();

    const contacts = useSelector((state) => state.contacts?.contacts ?? []);
    const maniAllData = useSelector((s) => s.totalappData);

    const [broadcast, setBroadcast] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [inputText, setInputText] = useState('');
    const [activeTab, setActiveTab] = useState('messages'); // 'messages' | 'members'
    const [showAddMember, setShowAddMember] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showContacts, setShowContacts] = useState([]);
    const [selectedNew, setSelectedNew] = useState([]);
    const [showOptions, setShowOptions] = useState(false);

    const flatRef = useRef();

    // Theme tokens — Chat screen wali hi palette, taki broadcast alag na lage
    const colors = {
        bg: theme.background,
        cardBg: isDark ? '#1f2c34' : '#ffffff',
        text: isDark ? '#e9edef' : '#111111',
        subText: isDark ? '#8696a0' : '#667781',
        border: isDark ? '#2a3942' : '#ececec',
        inputBg: theme.inputBackground,
        msgBubbleBg: theme.bubbleMine ?? (isDark ? '#1f3a52' : '#d9efff'), // ek hi token — Chat jaisa
        msgText: isDark ? '#e9edef' : '#111111',
        accent: '#1296f3',
    };

    const fetchDetails = useCallback(async () => {
        try {
            setLoading(true);
            const [bcRes, msgRes] = await Promise.all([
                apiService({ method: 'GET', endpoint: `broadcasts/${broadcastId}` }),
                apiService({ method: 'GET', endpoint: `broadcasts/${broadcastId}/messages` }),
            ]);
            setBroadcast(bcRes?.data?.broadcast ?? null);
            // Server newest-first deta hai; chat jaisa: purane upar, naye neeche
            const list = [...(msgRes?.data?.messages ?? [])];
            list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            setMessages(list);
        } catch (e) {
            console.error('fetchDetails:', e);
        } finally {
            setLoading(false);
        }
    }, [broadcastId]);

    useEffect(() => { fetchDetails(); }, [fetchDetails]);

    useEffect(() => {
        let newContact = contacts && contacts.filter((item) => item?.isRegistered);
        setShowContacts(newContact);
    }, [contacts]);

    const sendMessage = async ({
        content = '',
        formData = null,
        msgType = 'text',
    }) => {
        const text = (content || '').trim();

        if (!text && !formData) return;

        setSending(true);

        try {
            const isText = msgType === 'text';

            // apiService (axios -> XHR) hi use karo. Global fetch Expo ka winter fetch hai
            // jo RN wale { uri, name, type } FormData part par throw kar deta hai.
            const response = await apiService({
                method: 'POST',
                endpoint: `broadcasts/${broadcastId}/messages`,
                data: isText ? { content: text, messageType: 'text' } : formData,
                isMultipart: !isText,
            });

            const res = response?.data;

            console.log('Response =>', res);

            if (!response?.success || !res?.success) {
                throw new Error(res?.message || response?.error?.message || 'Failed to send message');
            }

            setInputText('');
            fetchDetails();

            setTimeout(() => {
                flatRef.current?.scrollToEnd({ animated: true });
            }, 300);
        } catch (e) {
            console.log('Send Message Error =>', e);
            Alert.alert('Error', e?.message || 'Could not send message');
        } finally {
            setSending(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return Alert.alert('Permission required');
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8,
        });
        if (!res.canceled) {
            const asset = res.assets[0];
            const isVid = asset.type === 'video';
            const fd = new FormData();
            fd.append('content', '');
            fd.append('messageType', isVid ? 'video' : 'image');
            await appendFile(fd, 'files', { ...asset, name: `file_${Date.now()}`, type: isVid ? 'video/mp4' : 'image/jpeg' });
            sendMessage({ formData: fd, msgType: isVid ? 'video' : 'image' });
        }
    };

    const pickDoc = async () => {
        const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (res.type === 'success' || res.assets?.length) {
            const file = res.assets?.[0] ?? res;
            const fd = new FormData();
            fd.append('content', file.name);
            fd.append('messageType', 'document');
            await appendFile(fd, 'files', { ...file, name: file.name, type: file.mimeType ?? 'application/octet-stream' });
            sendMessage({ formData: fd, msgType: 'document' });
        }
    };

    const removeMember = async (userId) => {
        Alert.alert('Remove recipient?', 'This person will be removed from the broadcast list.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: () => removeSection(userId),
            },
        ]);
    };

    const removeSection = async (userId) => {
        let data = JSON.stringify({ 'recipients': JSON.stringify([userId]) });
        const res = await apiService({
            method: 'PUT', endpoint: `broadcasts/${broadcastId}/remove-recipients`,
            data: data
        });

        if (res?.success) fetchDetails();
    };

    const addMembers = async () => {
        if (!selectedNew.length) return;
        const existing = broadcast?.recipients?.map(r => r._id) ?? [];
        const newRecipients = selectedNew.filter(id => !existing.includes(id));
        if (!newRecipients.length) {
            setShowAddMember(false);
            setSelectedNew([]);
            return;
        }
        let data = JSON.stringify({ 'recipients': JSON.stringify(newRecipients) });
        const res = await apiService({
            method: 'PUT', endpoint: `broadcasts/${broadcastId}/add-recipients`,
            data: data,
        });
        if (res?.success) {
            setShowAddMember(false);
            setSelectedNew([]);
            fetchDetails();
        } else if (handlePlanLimit(res, navigation)) {
            // Upgrade alert dikha diya
        }
    };

    const deleteBroadcast = () => {
        Alert.alert('Delete broadcast?', 'This broadcast list and all its messages will be deleted.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    await apiService({ method: 'DELETE', endpoint: `broadcasts/${broadcastId}` });
                    navigation.goBack();
                },
            },
        ]);
    };

    const fmtTime = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    const existingIds = broadcast?.recipients?.map(r => r._id) ?? [];

    // Contact ka app-side id appUser._id me hota hai (row ka id phone number hai),
    // isliye already-added members isi se match karte hain.
    const query = searchQuery.trim().toLowerCase();
    const filteredContacts = (showContacts ?? []).filter(c =>
        !existingIds.includes(c?.appUser?._id) &&
        (!query || c.name?.toLowerCase().includes(query) || c.phone?.includes(query))
    );

    const recipientCount = broadcast?.recipients?.length ?? 0;
    const bgImage = isDark ? Images.ChatblackBackground : Images.ChatwhiteBackground;
    const broadcastIcon = broadcast?.broadcastIcon
        ? Config.MEDIA_URL + broadcast.broadcastIcon
        : null;

    const TABS = [
        { key: 'messages', label: 'Messages', icon: 'chatbubble', iconOutline: 'chatbubble-outline', count: messages.length },
        { key: 'members', label: 'Recipients', icon: 'people', iconOutline: 'people-outline', count: recipientCount },
    ];

    const confirmDeleteMessage = (item) => {
        Alert.alert('Delete message?', 'This message will be deleted for everyone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    await apiService({ method: 'DELETE', endpoint: `broadcasts/messages/${item._id}` });
                    setMessages(prev => prev.filter(m => m._id !== item._id));
                },
            },
        ]);
    };

    const renderMessage = ({ item }) => {
        const delivered = item.totalRecipients ?? recipientCount;
        return (
            <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.msgBubble, { backgroundColor: colors.msgBubbleBg }]}
                onPress={() => navigation.navigate('BroadcastStats', {
                    messageId: item._id,
                    content: item.content,
                })}
                onLongPress={() => confirmDeleteMessage(item)}
            >
                {item.messageType === 'image' && item.attachments?.map((a, i) => (
                    <Image key={i} source={{ uri: Config.MEDIA_URL + a.url }} style={styles.msgImg} />
                ))}

                {item.messageType === 'document' && item.attachments?.map((a, i) => (
                    <View key={i} style={[styles.docRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                        <View style={styles.docIcon}>
                            <Ionicons name="document-text" size={18} color="#fff" />
                        </View>
                        <Text style={[styles.docName, { color: colors.msgText }]} numberOfLines={1}>
                            {a.filename}
                        </Text>
                    </View>
                ))}

                {!!item.content && (
                    <Text style={[styles.msgText, { color: colors.msgText }]}>{item.content}</Text>
                )}

                {/* Time + delivery stats — tap karne par poori report */}
                <View style={styles.msgFooter}>
                    <Text style={[styles.msgTime, { color: colors.subText }]}>{fmtTime(item.createdAt)}</Text>
                    <View style={[styles.statPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}>
                        <Ionicons name="checkmark-done" size={12} color={colors.accent} />
                        <Text style={[styles.statNum, { color: colors.subText }]}>{delivered}</Text>
                        <Ionicons name="chevron-forward" size={11} color={colors.subText} />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderMember = ({ item }) => (
        <View style={[styles.memberRow, { borderBottomColor: colors.border }]}>
            <Avatar uri={appUserAvatar(item)} name={item.name ?? ''} size={44} />
            <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>{resolveName(item).title}</Text>
                <Text style={[styles.memberPhone, { color: colors.subText }]} numberOfLines={1}>
                    {resolveName(item).isSaved ? (item.mobile ? `+91 ${item.mobile}` : '') : resolveName(item).subtitle}
                </Text>
            </View>
            <TouchableOpacity
                style={[styles.removeBtn, { backgroundColor: isDark ? '#3a1c1c' : '#fff1f1' }]}
                onPress={() => removeMember(item._id)}
                hitSlop={HIT}
            >
                <Ionicons name="close" size={16} color="#EF4444" />
            </TouchableOpacity>
        </View>
    );

    // ── Header har state me same rehta hai (loading me bhi) ─────────────────
    const headerBg = theme.header ?? '#1296f3';
    const Header = () => (
        <View style={[styles.header, { backgroundColor: headerBg }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={HIT}>
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.headerInfo}
                activeOpacity={0.7}
                onPress={() => setActiveTab('members')}
            >
                {broadcastIcon ? (
                    <Image source={{ uri: broadcastIcon }} style={styles.headerAvatar} />
                ) : (
                    <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
                        <Ionicons name="megaphone" size={19} color="#FFFFFF" />
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {broadcast?.broadcastName ?? 'Broadcast'}
                    </Text>
                    <Text style={styles.headerSub} numberOfLines={1}>
                        {recipientCount} recipient{recipientCount === 1 ? '' : 's'}
                    </Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowOptions(true)} style={styles.headerBtn} hitSlop={HIT}>
                <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
            </TouchableOpacity>
        </View>
    );

    if (loading) return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar backgroundColor={headerBg} barStyle="light-content" />
            <Header />
            <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.accent} size="large" />
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar backgroundColor={headerBg} barStyle="light-content" />

            <Header />

            {/* TABS */}
            <View style={[styles.tabBar, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }]}>
                {TABS.map(tab => {
                    const active = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tab, active && { borderBottomColor: colors.accent }]}
                            onPress={() => setActiveTab(tab.key)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={active ? tab.icon : tab.iconOutline}
                                size={16}
                                color={active ? colors.accent : colors.subText}
                            />
                            <Text style={[styles.tabText, { color: active ? colors.accent : colors.subText }]}>
                                {tab.label}
                            </Text>
                            {tab.count > 0 && (
                                <View style={[styles.tabBadge, { backgroundColor: active ? colors.accent : colors.border }]}>
                                    <Text style={[styles.tabBadgeText, { color: active ? '#FFFFFF' : colors.subText }]}>
                                        {tab.count}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {activeTab === 'messages' && (
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <ImageBackground source={bgImage} style={{ flex: 1 }} resizeMode="cover">
                        <FlatList
                            ref={flatRef}
                            data={messages}
                            keyExtractor={(item) => item._id}
                            renderItem={renderMessage}
                            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
                            contentContainerStyle={styles.msgListContent}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            ListHeaderComponent={
                                <View style={[styles.noticePill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                                    <Ionicons name="lock-closed" size={11} color={colors.subText} />
                                    <Text style={[styles.noticeText, { color: colors.subText }]}>
                                        Each recipient receives this message in their own chat
                                    </Text>
                                </View>
                            }
                            ListEmptyComponent={
                                <View style={styles.emptyBox}>
                                    <View style={[styles.emptyIconWrap, { backgroundColor: colors.cardBg }]}>
                                        <Ionicons name="megaphone-outline" size={38} color={colors.accent} />
                                    </View>
                                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No messages yet</Text>
                                    <Text style={[styles.emptyText, { color: colors.subText }]}>
                                        Type below to send it to all {recipientCount} recipients at once
                                    </Text>
                                </View>
                            }
                        />
                    </ImageBackground>

                    <View style={[
                        styles.inputBar,
                        {
                            backgroundColor: colors.cardBg,
                            borderTopColor: colors.border,
                            paddingBottom: 8 + insets.bottom,
                        },
                    ]}>
                        <View style={[styles.inputPill, { backgroundColor: colors.inputBg }]}>
                            <TextInput
                                style={[styles.textInput, { color: colors.text }]}
                                placeholder="Broadcast message..."
                                placeholderTextColor={colors.subText}
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                            />
                            <TouchableOpacity onPress={pickDoc} style={styles.iconBtn} hitSlop={HIT}>
                                <Ionicons name="attach" size={21} color={colors.subText} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={pickImage} style={styles.iconBtn} hitSlop={HIT}>
                                <Ionicons name="image-outline" size={20} color={colors.subText} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.sendBtn, (!inputText.trim() || sending) && { opacity: 0.5 }]}
                            onPress={() => sendMessage({ content: inputText, msgType: 'text' })}
                            disabled={!inputText.trim() || sending}
                        >
                            {sending
                                ? <ActivityIndicator size="small" color="#FFFFFF" />
                                : <Ionicons name="send" size={17} color="#FFFFFF" />
                            }
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            )}

            {activeTab === 'members' && (
                <View style={{ flex: 1 }}>
                    <TouchableOpacity
                        style={[styles.addMemberBtn, { borderBottomColor: colors.border }]}
                        onPress={() => setShowAddMember(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.addMemberIcon}>
                            <Ionicons name="person-add" size={18} color="#FFFFFF" />
                        </View>
                        <Text style={[styles.addMemberText, { color: colors.accent }]}>Add recipients</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
                    </TouchableOpacity>

                    <FlatList
                        data={broadcast?.recipients ?? []}
                        keyExtractor={(item) => item._id}
                        renderItem={renderMember}
                        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
                        ListHeaderComponent={
                            recipientCount > 0 ? (
                                <Text style={[styles.listLabel, { color: colors.subText }]}>
                                    {recipientCount} RECIPIENT{recipientCount === 1 ? '' : 'S'}
                                </Text>
                            ) : null
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyBox}>
                                <View style={[styles.emptyIconWrap, { backgroundColor: colors.cardBg }]}>
                                    <Ionicons name="people-outline" size={38} color={colors.accent} />
                                </View>
                                <Text style={[styles.emptyTitle, { color: colors.text }]}>No recipients yet</Text>
                                <Text style={[styles.emptyText, { color: colors.subText }]}>
                                    Use "Add recipients" above to add contacts
                                </Text>
                            </View>
                        }
                    />
                </View>
            )}

            {/* OPTIONS — header ke neeche right corner me, Chat screen jaisa */}
            <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
                <Pressable style={styles.menuOverlay} onPress={() => setShowOptions(false)}>
                    <View style={[styles.menuBox, { backgroundColor: colors.cardBg }]}>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => { setShowOptions(false); setShowAddMember(true); }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="person-add-outline" size={18} color={colors.accent} />
                            <Text style={[styles.menuText, { color: colors.text }]}>Add recipients</Text>
                        </TouchableOpacity>
                        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => { setShowOptions(false); deleteBroadcast(); }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                            <Text style={[styles.menuText, { color: '#EF4444' }]}>Delete broadcast</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* ADD RECIPIENTS SHEET */}
            <Modal visible={showAddMember} transparent animationType="slide" onRequestClose={() => setShowAddMember(false)}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <Pressable style={styles.overlay} onPress={() => setShowAddMember(false)}>
                        <Pressable
                            style={[styles.sheet, { backgroundColor: colors.cardBg, paddingBottom: 16 + insets.bottom }]}
                            onStartShouldSetResponder={() => true}
                        >
                            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

                            <View style={styles.sheetHead}>
                                <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('Add Members')}</Text>
                                {selectedNew.length > 0 && (
                                    <Text style={[styles.sheetCount, { color: colors.accent }]}>
                                        {selectedNew.length} selected
                                    </Text>
                                )}
                            </View>

                            <View style={[styles.searchWrap, { backgroundColor: colors.inputBg }]}>
                                <Ionicons name="search" size={17} color={colors.subText} />
                                <TextInput
                                    style={[styles.searchInput, { color: colors.text }]}
                                    placeholder="Search contacts..."
                                    placeholderTextColor={colors.subText}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={HIT}>
                                        <Ionicons name="close-circle" size={17} color={colors.subText} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <FlatList
                                data={filteredContacts}
                                keyExtractor={(item, index) => String(item?.id ?? item?.phone ?? index)}
                                style={{ maxHeight: SHEET_LIST_MAX_H }}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => {
                                    const userId = item?.appUser?._id;
                                    const isSelected = selectedNew.includes(userId);
                                    return (
                                        <TouchableOpacity
                                            style={[styles.contactRow, { borderBottomColor: colors.border }]}
                                            activeOpacity={0.7}
                                            onPress={() => setSelectedNew(prev =>
                                                isSelected ? prev.filter(id => id !== userId) : [...prev, userId]
                                            )}
                                        >
                                            <Avatar uri={contactAvatar(item)} name={item.name ?? ''} size={40} />
                                            <View style={styles.memberInfo}>
                                                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                                                    {item.name}
                                                </Text>
                                                <Text style={[styles.memberPhone, { color: colors.subText }]} numberOfLines={1}>
                                                    {item.phone ? `+91 ${item.phone}` : ''}
                                                </Text>
                                            </View>
                                            <View style={[
                                                styles.checkbox,
                                                { borderColor: isSelected ? colors.accent : colors.border },
                                                isSelected && styles.checkboxActive,
                                            ]}>
                                                {isSelected && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                                ListEmptyComponent={
                                    <Text style={[styles.sheetEmpty, { color: colors.subText }]}>
                                        {showContacts?.length
                                            ? 'No contacts found'
                                            : 'None of your contacts use Telebook yet.\nTry Settings → Sync Contacts.'}
                                    </Text>
                                }
                            />

                            <TouchableOpacity
                                style={[styles.submitBtn, !selectedNew.length && { opacity: 0.45 }]}
                                onPress={addMembers}
                                disabled={!selectedNew.length}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.submitText}>
                                    {selectedNew.length > 0 ? `Add ${selectedNew.length} recipients` : 'Add recipients'}
                                </Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Header — Chat screen ke header jaisa hi (status bar ke neeche)
    header: {
        height: 90,
        backgroundColor: '#1296f3',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
        gap: 6,
    },
    headerBtn: { padding: 6 },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.25)' },
    headerAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
    headerSub: { color: '#d0eeff', fontSize: 12, marginTop: 1 },

    // Tabs
    tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
    tab: {
        flex: 1,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabText: { fontSize: 14, fontWeight: '600' },
    tabBadge: { minWidth: 20, paddingHorizontal: 5, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    tabBadgeText: { fontSize: 11, fontWeight: '700' },

    // Messages
    msgListContent: { padding: 12, paddingBottom: 16 },
    noticePill: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        marginBottom: 10,
        maxWidth: SCREEN_W * 0.85,
    },
    noticeText: { fontSize: 11, textAlign: 'center' },
    msgBubble: {
        alignSelf: 'flex-end',
        maxWidth: SCREEN_W * 0.8,
        minWidth: 110,
        borderRadius: 12,
        borderTopRightRadius: 4,
        padding: 8,
        marginVertical: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 1,
        elevation: 1,
    },
    msgImg: { width: SCREEN_W * 0.6, height: SCREEN_W * 0.5, borderRadius: 8, marginBottom: 6, backgroundColor: '#e5e5e5' },
    msgText: { fontSize: 15, lineHeight: 21, paddingHorizontal: 2 },
    docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, marginBottom: 6, width: SCREEN_W * 0.6 },
    docIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1296f3', alignItems: 'center', justifyContent: 'center' },
    docName: { fontSize: 13, flex: 1 },

    msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 6 },
    msgTime: { fontSize: 10 },
    statPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    statNum: { fontSize: 10, fontWeight: '700' },

    // Input
    inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 8, gap: 8, borderTopWidth: 1 },
    inputPill: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 4, gap: 4 },
    textInput: { flex: 1, fontSize: 15, paddingVertical: 8, maxHeight: 110 },
    iconBtn: { padding: 4 },
    sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1296f3', alignItems: 'center', justifyContent: 'center' },

    // Members
    addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
    addMemberIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1296f3', alignItems: 'center', justifyContent: 'center' },
    addMemberText: { flex: 1, fontSize: 15, fontWeight: '600' },
    listLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
    memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5 },
    memberInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
    memberName: { fontSize: 15, fontWeight: '600' },
    memberPhone: { fontSize: 12, marginTop: 2 },
    removeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

    // Empty states
    emptyBox: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 40, gap: 8 },
    emptyIconWrap: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    emptyTitle: { fontSize: 16, fontWeight: '700' },
    emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

    // Options dropdown
    menuOverlay: {
        flex: 1,
        paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 44) + 50,
        paddingRight: 10,
        alignItems: 'flex-end',
    },
    menuBox: {
        borderRadius: 12,
        paddingVertical: 6,
        minWidth: 200,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    menuText: { fontSize: 15, fontWeight: '500' },
    menuDivider: { height: 0.5, marginHorizontal: 8 },

    // Add recipients sheet
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, maxHeight: '90%' },
    sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
    sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sheetTitle: { fontSize: 17, fontWeight: '700' },
    sheetCount: { fontSize: 13, fontWeight: '600' },
    sheetEmpty: { textAlign: 'center', marginTop: 24, marginBottom: 12, fontSize: 13, lineHeight: 19 },

    searchWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 6, gap: 8 },
    searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },

    contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 0.5 },
    checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    checkboxActive: { backgroundColor: '#1296f3', borderColor: '#1296f3' },

    submitBtn: { backgroundColor: '#1296f3', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 14 },
    submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
