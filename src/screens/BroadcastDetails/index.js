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
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import Config from '../../services/config';
import { appendFile } from '../../utils/uploadFile';
const BASE_URL = Config.Main_url;

const { width: SCREEN_W } = Dimensions.get('window');
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

export default function BroadcastDetails({ route, navigation }) {
    const { broadcastId } = route.params;
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const isDark = theme.mode !== 'light';

    console.log("isDark___________", isDark, theme.mode)
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

    // Theme Color Tokens
    const colors = {
        bg: isDark ? '#0F172A' : '#F8FAFC',
        cardBg: isDark ? '#1E293B' : '#FFFFFF',
        text: isDark ? '#F8FAFC' : '#0F172A',
        subText: isDark ? '#94A3B8' : '#64748B',
        border: isDark ? '#334155' : '#E2E8F0',
        inputBg: isDark ? '#334155' : '#F1F5F9',
        msgBubbleBg: isDark ? '#005C4B' : '#DCF8C6',
        msgText: isDark ? '#F1F5F9' : '#0F172A',
        accent: '#1296F3',
    };

    const fetchDetails = useCallback(async () => {
        try {
            setLoading(true);
            const [bcRes, msgRes] = await Promise.all([
                apiService({ method: 'GET', endpoint: `broadcasts/${broadcastId}` }),
                apiService({ method: 'GET', endpoint: `broadcasts/${broadcastId}/messages` }),
            ]);
            setBroadcast(bcRes?.data?.broadcast ?? null);
            setMessages(msgRes?.data?.messages ?? []);
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
            Alert.alert('Error', e?.message || 'Message send nahi hua');
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
        Alert.alert('Remove Member?', 'Is member ko broadcast se hatana chahte ho?', [
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
        const newRecipients = selectedNew.filter(
            contact => !broadcast.recipients.some(r => r._id === contact._id)
        );
        let data = JSON.stringify({ 'recipients': JSON.stringify(newRecipients) });
        const res = await apiService({
            method: 'PUT', endpoint: `broadcasts/${broadcastId}/add-recipients`,
            data: data,
        });
        if (res?.success) {
            setShowAddMember(false);
            setSelectedNew([]);
            fetchDetails();
        }
    };

    const deleteBroadcast = () => {
        Alert.alert('Delete Broadcast?', 'Yeh broadcast aur sab messages delete ho jayenge.', [
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

    const filteredContacts = (showContacts ?? []).filter(c =>
        !existingIds.includes(c._id) &&
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderMessage = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.msgBubble, { backgroundColor: colors.msgBubbleBg }]}
            onPress={() => navigation.navigate('BroadcastStats', {
                messageId: item._id,
                content: item.content,
            })}
            onLongPress={() => {
                Alert.alert('Options', '', [
                    {
                        text: 'Delete for Everyone', style: 'destructive',
                        onPress: async () => {
                            await apiService({ method: 'DELETE', endpoint: `broadcasts/messages/${item._id}` });
                            setMessages(prev => prev.filter(m => m._id !== item._id));
                        },
                    },
                    { text: 'Cancel', style: 'cancel' },
                ]);
            }}
        >

            {item.messageType === 'image' && item.attachments?.map((a, i) => (
                <Image key={i} source={{ uri: Config.MEDIA_URL + a.url }} style={styles.msgImg} />
            ))}

            {item.messageType === 'document' && item.attachments?.map((a, i) => (
                <View key={i} style={styles.docRow}>
                    <Ionicons name="document-text" size={24} color={colors.accent} />
                    <Text style={[styles.docName, { color: colors.msgText }]} numberOfLines={1}>{a.filename}</Text>
                </View>
            ))}

            {/* Text */}
            {!!item.content && (
                <Text style={[styles.msgText, { color: colors.msgText }]}>{item.content}</Text>
            )}

            {/* Stats row */}
            <View style={styles.statsRow}>
                <Text style={[styles.timeText, { color: isDark ? '#A1A1AA' : '#666' }]}>{fmtTime(item.createdAt)}</Text>
                <View style={[styles.statPill, { backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.06)' }]}>
                    <Ionicons name="checkmark-done" size={13} color={colors.accent} />
                    <Text style={[styles.statNum, { color: isDark ? '#E4E4E7' : '#444' }]}>{item.totalRecipients}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderMember = ({ item }) => (
        <View style={[styles.memberRow, { borderBottomColor: colors.border }]}>
            <Image
                source={{ uri: item.profilePicture ? Config.MEDIA_URL + item.profilePicture : DEFAULT_AVATAR }}
                style={styles.memberAvatar}
            />
            <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.memberPhone, { color: colors.subText }]}>{item.mobile ?? ''}</Text>
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeMember(item._id)}>
                <Ionicons name="remove-circle-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
        </View>
    );

    if (loading) return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <ActivityIndicator color={colors.accent} size="large" style={{ flex: 1 }} />
        </SafeAreaView>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar backgroundColor="#1296F3" barStyle="light-content" />

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{broadcast?.broadcastName}</Text>
                    <Text style={styles.headerSub}>
                        {broadcast?.recipients?.length ?? 0} recipients
                    </Text>
                </View>
                <TouchableOpacity onPress={() => setShowOptions(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>


            <View style={[styles.tabBar, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }]}>
                {['messages', 'members'].map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, { color: activeTab === tab ? colors.accent : colors.subText }]}>
                            {tab === 'messages' ? '💬 Messages' : `👥 Members (${broadcast?.recipients?.length ?? 0})`}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>


            {activeTab === 'messages' && (
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    <FlatList
                        ref={flatRef}
                        data={messages}
                        keyExtractor={(item) => item._id}
                        renderItem={renderMessage}
                        contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
                        ListEmptyComponent={
                            <View style={styles.emptyMsg}>
                                <Ionicons name="megaphone-outline" size={48} color={colors.subText} />
                                <Text style={[styles.emptyText, { color: colors.subText }]}>Koi message nahi. Pehla broadcast bhejo!</Text>
                            </View>
                        }
                    />


                    <View style={[styles.inputBar, { backgroundColor: colors.cardBg, borderTopColor: colors.border }]}>
                        <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
                            <Ionicons name="image-outline" size={22} color={colors.subText} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={pickDoc} style={styles.iconBtn}>
                            <Ionicons name="attach-outline" size={22} color={colors.subText} style={{ transform: [{ rotate: '45deg' }] }} />
                        </TouchableOpacity>
                        <TextInput
                            style={[styles.textInput, { color: colors.text, backgroundColor: colors.inputBg }]}
                            placeholder="Broadcast message..."
                            placeholderTextColor={colors.subText}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, (!inputText.trim() || sending) && { opacity: 0.5 }]}
                            onPress={() => sendMessage({ content: inputText, msgType: 'text' })}
                            disabled={!inputText.trim() || sending}
                        >
                            {sending
                                ? <ActivityIndicator size="small" color="#FFFFFF" />
                                : <Ionicons name="send" size={16} color="#FFFFFF" />
                            }
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            )}

            {activeTab === 'members' && (
                <View style={{ flex: 1 }}>
                    <TouchableOpacity style={[styles.addMemberBtn, { borderBottomColor: colors.border }]} onPress={() => setShowAddMember(true)}>
                        <Ionicons name="person-add" size={20} color={colors.accent} />
                        <Text style={styles.addMemberText}>Add Member</Text>
                    </TouchableOpacity>

                    <FlatList
                        data={broadcast?.recipients ?? []}
                        keyExtractor={(item) => item._id}
                        renderItem={renderMember}
                        ListEmptyComponent={
                            <Text style={[styles.emptyText, { color: colors.subText, textAlign: 'center', marginTop: 40 }]}>
                                Koi member nahi
                            </Text>
                        }
                    />
                </View>
            )}


            <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
                <Pressable style={styles.ctxOverlay} onPress={() => setShowOptions(false)}>
                    <View style={[styles.ctxMenu, { backgroundColor: colors.cardBg }]}>
                        <TouchableOpacity style={styles.ctxItem} onPress={() => { setShowOptions(false); setShowAddMember(true); }}>
                            <Ionicons name="person-add-outline" size={20} color={colors.text} />
                            <Text style={[styles.ctxLabel, { color: colors.text }]}>Add Members</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.ctxItem} onPress={() => { setShowOptions(false); deleteBroadcast(); }}>
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            <Text style={[styles.ctxLabel, { color: '#EF4444' }]}>Delete Broadcast</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>


            <Modal visible={showAddMember} transparent animationType="slide" onRequestClose={() => setShowAddMember(false)}>
                <Pressable style={styles.overlay} onPress={() => setShowAddMember(false)}>
                    <Pressable style={[styles.sheet, { backgroundColor: colors.cardBg }]}>
                        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
                        <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('Add Members')}</Text>
                        <View style={[styles.searchWrap, { backgroundColor: colors.inputBg }]}>
                            <Ionicons name="search" size={18} color={colors.subText} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder="Search contacts..."
                                placeholderTextColor={colors.subText}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                        <FlatList
                            data={filteredContacts}
                            keyExtractor={(item) => item._id}
                            style={{ maxHeight: 320 }}
                            renderItem={({ item }) => {
                                const isSelected = selectedNew.includes(item?.appUser?._id);
                                return (
                                    <TouchableOpacity
                                        style={styles.contactRow}
                                        onPress={() => setSelectedNew(prev =>
                                            isSelected ? prev.filter(id => id !== item?.appUser?._id) : [...prev, item?.appUser?._id]
                                        )}
                                    >
                                        {item.profilePicture ? (
                                            <Image source={{ uri: item.profilePicture }} style={styles.memberAvatar} />
                                        ) : (
                                            <View style={[styles.memberAvatar, styles.avatarFallback]}>
                                                <Text style={styles.avatarLetter}>{item.name?.[0]?.toUpperCase()}</Text>
                                            </View>
                                        )}
                                        <Text style={[styles.memberName, { color: colors.text, flex: 1 }]}>{item.name}</Text>
                                        <View style={[styles.checkbox, { borderColor: colors.border }, isSelected && styles.checkboxActive]}>
                                            {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                            ListEmptyComponent={
                                <Text style={{ textAlign: 'center', color: colors.subText, marginTop: 20 }}>No contacts found</Text>
                            }
                        />

                        <TouchableOpacity
                            style={[styles.submitBtn, !selectedNew.length && { opacity: 0.5 }]}
                            onPress={addMembers}
                            disabled={!selectedNew.length}
                        >
                            <Text style={styles.submitText}>
                                Add {selectedNew.length > 0 ? `(${selectedNew.length})` : ''} Members
                            </Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: {
        height: 60,
        backgroundColor: '#1296F3',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    headerSub: { color: '#E0F2FE', fontSize: 12, marginTop: 1 },

    // Tabs
    tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: '#1296F3' },
    tabText: { fontSize: 14, fontWeight: '600' },

    // Messages
    msgBubble: {
        alignSelf: 'flex-end',
        maxWidth: SCREEN_W * 0.78,
        borderRadius: 12,
        padding: 10,
        marginVertical: 4,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    msgImg: { width: SCREEN_W * 0.55, height: 180, borderRadius: 8, marginBottom: 6 },
    msgText: { fontSize: 14, lineHeight: 20 },
    docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    docName: { fontSize: 13, flex: 1 },

    // Stats
    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 6 },
    timeText: { fontSize: 10 },
    statPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    statNum: { fontSize: 10, fontWeight: '600' },

    // Input
    inputBar: { flexDirection: 'row', alignItems: 'center', padding: 8, paddingHorizontal: 12, borderTopWidth: 1 },
    iconBtn: { padding: 6 },
    textInput: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, maxHeight: 100, marginHorizontal: 6 },
    sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1296F3', alignItems: 'center', justifyContent: 'center' },

    // Members
    addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderBottomWidth: 1 },
    addMemberText: { fontSize: 15, color: '#1296F3', fontWeight: '600' },
    memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    memberAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12 },
    avatarFallback: { backgroundColor: '#1296F3', alignItems: 'center', justifyContent: 'center' },
    avatarLetter: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    memberName: { fontSize: 14, fontWeight: '600' },
    memberPhone: { fontSize: 12, marginTop: 2 },
    removeBtn: { padding: 4 },

    emptyMsg: { alignItems: 'center', marginTop: 80, gap: 12 },
    emptyText: { fontSize: 14 },

    // Modal
    ctxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    ctxMenu: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24, paddingTop: 12 },
    ctxItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
    ctxLabel: { fontSize: 15, fontWeight: '500' },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12 },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
    sheetTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 14 },

    searchWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12, gap: 8 },
    searchInput: { flex: 1, fontSize: 14 },

    contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
    checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    checkboxActive: { backgroundColor: '#1296F3', borderColor: '#1296F3' },

    submitBtn: { backgroundColor: '#1296F3', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
    submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});