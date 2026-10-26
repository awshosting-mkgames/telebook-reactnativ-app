import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
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
    TouchableOpacity,
    View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Toast from 'react-native-toast-message';
import { ThemeContext } from '../../components/ThemeContext';
import SearchBar from '../../components/SearchBar';
import { searchUsersPaged } from '../../components/searchUserByPhone';
import { useBadgePlacements } from '../../services/badgeConfig';
import {
    clearUnread,
    removeChat,
} from '../../redex/slices/chatListSlice';
import { ensureChatTabsLoaded, loadTabsFromDb, persistChatTabs, syncAllTabData } from '../../services/chatSync';
import { isChatPinned as chatIsPinned, setBlocked, setChatPinned } from '../../services/chatActions';
import { deleteChatFromDb } from '../../services/chatsDb';
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
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuItem, setMenuItem] = useState(null);
    const [headerMenuVisible, setHeaderMenu] = useState(false);
    const placements = useBadgePlacements();

    const [remote, setRemote] = useState({ users: [], loading: false, loadingMore: false, page: 1, hasMore: false, done: false });
    const remoteReq = useRef(0);
    const openingChat = useRef(false);


    const changeFilter = (f) => {
        if (f === activeFilter) return;
        setActiveFilter(f);
    };

    const maniAllData = useSelector((state) => state.totalappData);
    const MY_USER_ID = maniAllData?.userId ?? '';
    const userData = maniAllData?.user ?? null;
    const chats = useSelector((state) => state.chatList.tabs?.[activeFilter] ?? []);
    const loading = useSelector((state) => state.chatList.loading);
    const syncing = useSelector((state) => state.chatList.syncing);
    const blockedIds = useSelector((state) => state.chatList.blockedIds ?? []);


    useFocusEffect(useCallback(() => {
        dispatch(ensureChatTabsLoaded(MY_USER_ID));
    }, [dispatch, MY_USER_ID]));

    const handleSyncData = useCallback(async () => {
        if (syncing) return;

        await syncAllTabData(dispatch, MY_USER_ID, { background: true });
    }, [syncing, dispatch, MY_USER_ID]);


    const filteredChats = searchQuery.trim()
        ? chats.filter((c) => {
            const q = searchQuery.toLowerCase().trim();
            const digits = q.replace(/\D/g, '');
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


    const q = searchQuery.trim();
    const qDigits = q.replace(/\D/g, '');
    const looksLikeNumber = /^[\d\s+()-]+$/.test(q);
    const isNumberQuery = looksLikeNumber && qDigits.length >= 10;
    const remoteEligible = isNumberQuery || (!looksLikeNumber && q.length >= 3);
    const fewLocal = filteredChats.length < 3;
    const remoteActive = remoteEligible && fewLocal;
    const remoteTerm = isNumberQuery ? qDigits : q;

    useEffect(() => {
        const id = ++remoteReq.current; // purane response ko stale mark karo
        if (!remoteActive) {
            setRemote({ users: [], loading: false, loadingMore: false, page: 1, hasMore: false, done: false });
            return undefined;
        }
        setRemote({ users: [], loading: true, loadingMore: false, page: 1, hasMore: false, done: false });
        const timer = setTimeout(async () => {
            const { users, hasMore } = await searchUsersPaged(remoteTerm, { page: 1 });
            if (id !== remoteReq.current) return;
            setRemote({ users, loading: false, loadingMore: false, page: 1, hasMore, done: true });
        }, 400);
        return () => clearTimeout(timer);
    }, [remoteActive, remoteTerm]);

    const loadMoreRemote = async () => {
        if (remote.loadingMore || !remote.hasMore) return;
        const id = remoteReq.current;
        const nextPage = remote.page + 1;
        setRemote((r) => ({ ...r, loadingMore: true }));
        const { users, hasMore } = await searchUsersPaged(remoteTerm, { page: nextPage });
        if (id !== remoteReq.current) return;
        setRemote((r) => ({
            ...r,
            users: [...r.users, ...users.filter((u) => !r.users.some((x) => x._id === u._id))],
            page: nextPage, hasMore, loadingMore: false,
        }));
    };

    // Jinse pehle se chat list me chat hai unhe 'more people' me dobara nahi dikhana
    const localUserIds = new Set(chats.map((c) => c.displayUser?._id).filter(Boolean));
    const remoteUsers = remote.users.filter((u) => u?._id && u._id !== MY_USER_ID && !localUserIds.has(u._id));

    const openRemoteUser = async (user) => {
        if (openingChat.current) return;
        openingChat.current = true;
        setTimeout(() => { openingChat.current = false; }, 800);
        Keyboard.dismiss();
        const res = await apiService({ method: 'POST', endpoint: 'chats', data: { userId: user._id } });
        const chat = res?.data?.chat;
        if (!res?.success || !chat?._id) {
            Toast.show({ type: 'error', text1: 'Could not open chat' });
            return;
        }
        const other = (chat.users || []).find((u) => u?._id !== MY_USER_ID) || user;
        navigation.navigate('Chat', {
            chatId: chat._id,
            chatName: user.name || user.mobile || other?.mobile || 'User',
            chatImage: other?.profilePicture,
            isGroup: false,
            otherUserId: user._id,
        });
    };

    // Jaldi-jaldi do tap par Chat screen do baar na khule
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
        if (!res.ok && res.planLimit) {
            Alert.alert('Plan Limit Reached', ['Plan Limit Reached – Upgrade your plan to continue.', res.message].filter(Boolean).join('\n'), [
                { text: 'Upgrade Plan', onPress: () => navigation.navigate('Plans') },
                { text: 'Cancel', style: 'cancel' },
            ]);
        } else if (!res.ok && res.message) Alert.alert('Error', res.message);
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
            showBadge={activeFilter === 'All' ? placements.home : placements.chatList}
            showRing={!!placements.ring}
        />
    );

    const renderRemoteFooter = () => {
        if (!remoteActive) return null;
        const mutedColor = isDark ? '#8696a0' : '#667781';
        return (
            <View style={styles.remoteSection}>
                <Text style={[styles.remoteTitle, { color: mutedColor }]}>More people on Telebook</Text>
                {remote.loading ? (
                    <ActivityIndicator size="small" color={theme.header || '#1199ff'} style={{ marginVertical: 16 }} />
                ) : remoteUsers.length === 0 ? (
                    <Text style={[styles.remoteEmpty, { color: mutedColor }]}>No user found</Text>
                ) : (
                    <>
                        {remoteUsers.map((u) => (
                            <TouchableOpacity key={u._id} style={styles.remoteRow} onPress={() => openRemoteUser(u)} activeOpacity={0.7}>
                                <Image
                                    source={{ uri: resolveAvatar(u.profilePicture, DEFAULT_AVATAR) }}
                                    style={styles.remoteAvatar}
                                />
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={[styles.remoteName, { color: theme.text || '#111' }]} numberOfLines={1}>
                                        {u.name || u.mobile || 'User'}
                                    </Text>
                                    {!!u.mobile && (
                                        <Text style={[styles.remoteSub, { color: mutedColor }]} numberOfLines={1}>{u.mobile}</Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                        {remote.hasMore && (
                            <TouchableOpacity onPress={loadMoreRemote} style={styles.loadMoreBtn} disabled={remote.loadingMore}>
                                {remote.loadingMore ? (
                                    <ActivityIndicator size="small" color={theme.header || '#1199ff'} />
                                ) : (
                                    <Text style={[styles.loadMoreText, { color: theme.header || '#1199ff' }]}>Load more</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>
        );
    };

    const avatarUri = userData?.profilePicture
        ? resolveAvatar(userData.profilePicture, DEFAULT_AVATAR)
        : DEFAULT_AVATAR;
    const totalUnread = chats.reduce((sum, c) => sum + (c.unreadCount || c.unseenCount || 0), 0);

    const filterBorderColor = isDark ? '#3a3a3a' : '#e0e0e0';
    const filterTextColor = isDark ? '#aaa' : '#777';
    const emptyIconBg = isDark ? '#1e1e1e' : '#f5f5f5';
    const emptyIconColor = isDark ? '#444' : '#ccc';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor={theme.header || '#1199ff'} barStyle="light-content" />
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
            <View style={[styles.header, { backgroundColor: theme.header || '#1199ff' }]}>
                <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.profileBtn} activeOpacity={0.8}>
                    <Image source={{ uri: avatarUri }} style={styles.profileAvatar} />
                    {totalUnread > 0 && <View style={styles.headerBadge} />}
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: theme.headerText || '#fff' }]}>{userData?.name || userData?.mobile || 'Chats'}</Text>
                </View>
                <TouchableOpacity onPress={() => setHeaderMenu(true)} style={styles.threeDotBtn} activeOpacity={0.7}>
                    <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
                </TouchableOpacity>
            </View>
            <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name or number..."
                theme={theme}
            />
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
            {loading && sortedChats.length === 0 ? (
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
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    contentContainerStyle={sortedChats.length === 0 && !remoteActive ? styles.emptyContainer : styles.listContent}
                    ListFooterComponent={renderRemoteFooter}
                    ListEmptyComponent={
                        remoteActive ? null : <View style={styles.emptyWrap}>
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
            <TouchableOpacity
                onPress={() => navigation.navigate('Contact')}
                style={styles.fab}
                activeOpacity={0.8}
            >
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
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

    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10, gap: 8 },
    profileBtn: { position: 'relative' },
    profileAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: '#cce5ff' },
    headerBadge: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#25D366', borderWidth: 1.5, borderColor: '#1199ff' },
    headerCenter: { flex: 1 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    syncingLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 },
    headerIconBtn: { padding: 6, minWidth: 30, alignItems: 'center' },
    threeDotBtn: { padding: 6 },
    fab: { position: 'absolute', bottom: 15, right: 15, width: 56, height: 56, borderRadius: 28, backgroundColor: '#1199ff', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4 },

    remoteSection: { paddingTop: 10 },
    remoteTitle: { fontSize: 13, fontWeight: '600', paddingHorizontal: 16, paddingVertical: 6 },
    remoteEmpty: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 12 },
    remoteRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 13 },
    remoteAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#eee' },
    remoteName: { fontSize: 15, fontWeight: '600' },
    remoteSub: { fontSize: 12, marginTop: 2 },
    loadMoreBtn: { alignItems: 'center', paddingVertical: 12 },
    loadMoreText: { fontSize: 14, fontWeight: '600' },

    filterRow: { flexDirection: 'row', paddingHorizontal: 14, marginTop: 10, marginBottom: 6, gap: 8 },
    filterBtn: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
    activeFilter: { backgroundColor: '#1199ff', borderColor: '#1199ff' },
    filterText: { fontSize: 13, fontWeight: '500' },
});