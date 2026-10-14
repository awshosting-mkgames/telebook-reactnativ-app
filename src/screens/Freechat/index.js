import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useContext, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Keyboard,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Toast from 'react-native-toast-message';
import { ThemeContext } from '../../components/ThemeContext';
import {
    clearUnread,
    removeChat,
} from '../../redex/slices/chatListSlice';
import { ensureChatTabsLoaded, loadTabsFromDb, persistChatTabs, syncAllTabData } from '../../services/chatSync';
import { isChatPinned as chatIsPinned, setBlocked, setChatPinned } from '../../services/chatActions';
import { deleteChatFromDb } from '../../services/chatsDb';
import { contactSync } from '../../services/contactSync';
import apiService from '../../services/apiService';

import ContextMenuPopup from './ContextMenuPopup';
import HeaderMenu from './HeaderMenu';
import SwipeableChatItem from './SwipeableChatItem';
import Config from '../../services/config';
const BASE_URL = Config.MEDIA_URL;

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const filters = ['All', 'Groups', 'Unread', 'Calls'];

const resolveAvatar = (path, fallback) => (!path ? fallback : BASE_URL + path);

const Freechat = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);
    const dispatch = useDispatch();

    const isDark = theme.text === '#FFFFFF';

    const [activeFilter, setActiveFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuItem, setMenuItem] = useState(null);
    const [headerMenuVisible, setHeaderMenu] = useState(false);

    // Tab change par koi API/loading nahi — chaaron tabs ka data pehle se
    // Redux me hai, isliye filter switch instant hona chahiye (no spinner).
    const changeFilter = (f) => {
        if (f === activeFilter) return;
        setActiveFilter(f);
    };

    const maniAllData = useSelector((state) => state.totalappData);
    const MY_USER_ID = maniAllData?.userId ?? '';
    const userData = maniAllData?.user ?? null;

    // Contact sync sirf OTP success aur Settings se hota hai. Yahan sirf
    // Redux ka flag padhte hain taki header par status dikha saken.
    const syncLoading = useSelector((state) => state.contacts?.syncing ?? false);

    // Tab change par koi API nahi — chaaron tabs ka data pehle se Redux me hai
    // (app open par SQL se, ya SQL khali hone par pehli sync se).
    const chats = useSelector((state) => state.chatList.tabs?.[activeFilter] ?? []);
    const loading = useSelector((state) => state.chatList.loading);
    const syncing = useSelector((state) => state.chatList.syncing);
    const blockedIds = useSelector((state) => state.chatList.blockedIds ?? []);

    // Chats tab par aate hi: list khali mili to SQL se dobara load (koi API nahi,
    // jab tak SQL bhi khali na ho)
    useFocusEffect(useCallback(() => {
        dispatch(ensureChatTabsLoaded(MY_USER_ID));
    }, [dispatch, MY_USER_ID]));

    const handleSyncData = useCallback(async () => {
        if (syncing) return;
        // background: true — poora loader nahi dikhega. Requirement: loader sirf
        // tab jab SQL se Redux me data load ho raha ho. Manual sync ke liye
        // header par "Syncing..." indicator kaafi hai, UI purane data par chalti rahegi.
        await syncAllTabData(dispatch, MY_USER_ID, { background: true });
    }, [syncing, dispatch, MY_USER_ID]);

    // WhatsApp jaisa manual contact-sync button, header me — koi automatic sync nahi.
    const handleSyncContacts = useCallback(async () => {
        if (syncLoading) return;
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
    }, [syncLoading, dispatch]);

    // Socket se list update ab app root par hota hai (components/ChatListSocketSync.js),
    // taaki koi bhi tab / screen khuli ho, list hamesha taaza rahe.

    const filteredChats = searchQuery.trim()
        ? chats.filter((c) => {
            const q = searchQuery.toLowerCase().trim();
            const digits = q.replace(/\D/g, '');
            // API user ka number `mobile` me deti hai
            const mobile = String(c.displayUser?.mobile ?? '');
            return (
                c.displayName?.toLowerCase().includes(q) ||
                (digits.length > 0 && mobile.includes(digits)) ||
                (!c.latestMessage?.isDeleted && c.latestMessage?.content?.toLowerCase().includes(q))
            );
        })
        : chats;

    const isChatPinned = (chatItem) => chatIsPinned(chatItem, MY_USER_ID);
    const isChatBlocked = (chatItem) =>
        !chatItem?.isGroupChat && !!chatItem?.displayUser?._id && blockedIds.includes(chatItem.displayUser._id);

    const sortedChats = [
        ...filteredChats.filter(c => isChatPinned(c)),
        ...filteredChats.filter(c => !isChatPinned(c)),
    ];

    // Jaldi-jaldi do tap par Chat screen do baar na khule
    const openingChat = useRef(false);
    const gotoChatPage = (item) => {
        if (openingChat.current) return;
        openingChat.current = true;
        setTimeout(() => { openingChat.current = false; }, 800);
        Keyboard.dismiss();
        dispatch(clearUnread(item._id));
        dispatch(persistChatTabs());
        navigation.navigate('Chat', {
            chatId: item._id,
            chatName: item.displayName,
            chatImage: item.displayAvatar,
            isGroup: item.isGroupChat,
            otherUserId: item.displayUser?._id,
        });
    };

    const handleLongPress = (item) => {
        setMenuItem(item);
        setMenuVisible(true);
    };

    // Redux (aur SQL) me isPinned turant badalta hai; fail hua to wapas
    const handlePin = async (item) => {
        const res = await setChatPinned(dispatch, item, !isChatPinned(item), MY_USER_ID);
        if (!res.ok && res.message) Alert.alert('Error', res.message);
    };

    const handleDelete = async (item) => {
        dispatch(removeChat(item._id));
        try {
            const res = await apiService({ method: 'DELETE', endpoint: `chats/${item._id}` });
            if (res?.success && res?.data?.success !== false) {
                // Redux se to hat gaya; SQL se bhi hatao warna agle app open par
                // dobara dikhne lagega.
                await deleteChatFromDb(item._id);
            } else {
                // Fail hua to SQL se wapas load kar lo — chat waapas aa jayegi.
                await loadTabsFromDb(dispatch);
                Alert.alert('Error', res?.error?.message || 'Chat delete nahi hui, dobara try karo');
            }
        } catch (e) {
            console.error('Delete chat error:', e);
            await loadTabsFromDb(dispatch);
        }
    };

    // Block / Unblock — PUT /users/block/:id, PUT /users/unblock/:id.
    // Block karne se chat list se nahi hatti (WhatsApp jaisa); sirf label badalta hai.
    const handleBlock = async (item) => {
        const userId = item?.displayUser?._id;
        if (!userId) { console.warn('Block failed: userId not found', item); return; }
        const res = await setBlocked(dispatch, userId, !isChatBlocked(item));
        if (!res.ok) Alert.alert('Error', res.message);
    };

    const renderChat = ({ item }) => (
        <SwipeableChatItem
            item={item}
            theme={theme}
            onPress={gotoChatPage}
            onDelete={handleDelete}
            onBlock={handleBlock}
            onLongPress={handleLongPress}
            isPinned={isChatPinned(item)}
            isBlocked={isChatBlocked(item)}
        />
    );

    const avatarUri = userData?.profilePicture
        ? resolveAvatar(userData.profilePicture, DEFAULT_AVATAR)
        : DEFAULT_AVATAR;
    const totalUnread = chats.reduce((sum, c) => sum + (c.unreadCount || c.unseenCount || 0), 0);

    const searchBg = isDark ? '#2a2a2a' : '#f2f2f2';
    const searchFocusedBg = isDark ? '#222222' : '#ffffff';
    const searchBorderColor = searchFocused ? '#1199ff' : isDark ? '#3a3a3a' : 'transparent';
    const searchIconColor = searchFocused ? '#1199ff' : isDark ? '#888' : '#bbb';
    const searchTextColor = isDark ? '#e0e0e0' : '#000000';
    const placeholderColor = isDark ? '#777' : '#bbb';
    const clearIconColor = isDark ? '#777' : '#ccc';
    const filterBorderColor = isDark ? '#3a3a3a' : '#e0e0e0';
    const filterTextColor = isDark ? '#aaa' : '#777';
    const emptyIconBg = isDark ? '#1e1e1e' : '#f5f5f5';
    const emptyIconColor = isDark ? '#444' : '#ccc';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor="#1199ff" barStyle="light-content" />
            <ContextMenuPopup
                visible={menuVisible}
                item={menuItem}
                onClose={() => setMenuVisible(false)}
                onPin={handlePin}
                onDelete={handleDelete}
                onBlock={handleBlock}
                isPinned={isChatPinned(menuItem)}
                isBlocked={isChatBlocked(menuItem)}
            />
            <HeaderMenu
                visible={headerMenuVisible}
                onClose={() => setHeaderMenu(false)}
                onSyncData={handleSyncData}
                syncing={syncing}
                onProfile={() => navigation.navigate('Settings')}
            />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.profileBtn} activeOpacity={0.8}>
                    <Image source={{ uri: avatarUri }} style={styles.profileAvatar} />
                    {totalUnread > 0 && <View style={styles.headerBadge} />}
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{userData?.name || 'Chats'}</Text>
                    {syncing ? (
                        <Text style={styles.syncingLabel}>Syncing...</Text>
                    ) : syncLoading ? (
                        <Text style={styles.syncingLabel}>Syncing contacts...</Text>
                    ) : null}
                </View>
                <TouchableOpacity
                    onPress={handleSyncContacts}
                    style={styles.headerIconBtn}
                    activeOpacity={0.7}
                    disabled={syncLoading}
                >
                    {syncLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Ionicons name="sync-outline" size={21} color="#fff" />
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => navigation.navigate('Contact')}
                    style={styles.headerIconBtn}
                    activeOpacity={0.7}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setHeaderMenu(true)} style={styles.threeDotBtn} activeOpacity={0.7}>
                    <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
                </TouchableOpacity>
            </View>
            <View style={[
                styles.searchContainer,
                {
                    backgroundColor: searchFocused ? searchFocusedBg : searchBg,
                    borderColor: searchBorderColor,
                },
            ]}>
                <Ionicons name="search-outline" size={17} color={searchIconColor} />
                <TextInput
                    style={[styles.searchInput, { color: searchTextColor }]}
                    placeholder="Search by name or number..."
                    placeholderTextColor={placeholderColor}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                        <Ionicons name="close-circle" size={16} color={clearIconColor} />
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.filterRow}>
                {filters.map((f) => (
                    <TouchableOpacity
                        key={f}
                        onPress={() => changeFilter(f)}
                        style={[
                            styles.filterBtn,
                            { borderColor: activeFilter === f ? '#1199ff' : filterBorderColor },
                            activeFilter === f && styles.activeFilter,
                        ]}
                        activeOpacity={0.75}
                    >
                        <Text style={[
                            styles.filterText,
                            { color: activeFilter === f ? '#fff' : filterTextColor },
                        ]}>
                            {f}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            {loading ? (
                <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color="#1199ff" />
                    <Text style={[styles.loadingText, { color: isDark ? '#666' : '#aaa' }]}>Loading chats...</Text>
                </View>
            ) : (
                <FlatList
                    data={sortedChats}
                    keyExtractor={(item) => item._id.toString()}
                    renderItem={renderChat}
                    showsVerticalScrollIndicator={false}
                    // Search ka keyboard khula ho tab bhi ek hi tap me chat khule
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    ItemSeparatorComponent={() => (
                        <View style={{ height: 0.5, backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0', marginLeft: 82 }} />
                    )}
                    contentContainerStyle={sortedChats.length === 0 ? styles.emptyContainer : styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <View style={[styles.emptyIcon, { backgroundColor: emptyIconBg }]}>
                                <Ionicons name="chatbubbles-outline" size={44} color={emptyIconColor} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: theme.text || '#333' }]}>
                                {searchQuery ? 'No results found' : 'No chats yet'}
                            </Text>
                            <Text style={[styles.emptySubtitle, { color: isDark ? '#555' : '#aaa' }]}>
                                {searchQuery ? 'Try a different name or number' : 'Start a new conversation!'}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

export default Freechat;

const styles = StyleSheet.create({
    container: { flex: 1 },
    loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14 },
    emptyContainer: { flexGrow: 1 },
    listContent: { paddingBottom: 16 },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80, gap: 10 },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    emptyTitle: { fontSize: 17, fontWeight: '600' },
    emptySubtitle: { fontSize: 13 },

    header: { backgroundColor: '#1199ff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10, gap: 8 },
    profileBtn: { position: 'relative' },
    profileAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: '#cce5ff' },
    headerBadge: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#25D366', borderWidth: 1.5, borderColor: '#1199ff' },
    headerCenter: { flex: 1 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    syncingLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 },
    headerIconBtn: { padding: 6, minWidth: 30, alignItems: 'center' },
    threeDotBtn: { padding: 6 },

    searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginTop: 12, marginBottom: 2, paddingHorizontal: 12, borderRadius: 14, height: 44, borderWidth: 1.5, gap: 8 },
    searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
    clearBtn: { padding: 4 },

    filterRow: { flexDirection: 'row', paddingHorizontal: 14, marginTop: 10, marginBottom: 6, gap: 8 },
    filterBtn: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
    activeFilter: { backgroundColor: '#1199ff', borderColor: '#1199ff' },
    filterText: { fontSize: 13, fontWeight: '500' },
});