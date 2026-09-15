import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
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
import { ThemeContext } from '../../components/ThemeContext';
import useContactSync from '../../components/useContactSync';
import {
    clearUnread,
    fetchChatList,
    removeChat,
    updateChatLastMessage,
} from '../../redex/slices/chatListSlice';
import apiService from '../../services/apiService';
import socketService from '../../services/socketService';

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
    const [pinnedIds, setPinnedIds] = useState([]);
    const [selectedPinnedItem, setSelectedPinnedItem] = useState(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuItem, setMenuItem] = useState(null);
    const [headerMenuVisible, setHeaderMenu] = useState(false);

    const maniAllData = useSelector((state) => state.totalappData);
    const MY_USER_ID = maniAllData?.userId ?? '';
    const MY_TOKEN = maniAllData?.apiToken ?? '';
    const userData = maniAllData?.user ?? null;

    const { fetchAndSyncContacts, manualSync, loading: syncLoading } = useContactSync();

    const chats = useSelector((state) => state.chatList.chats);
    const loading = useSelector((state) => state.chatList.loading);

    const fetchChats = useCallback((filterType = activeFilter) => {
        dispatch(fetchChatList({ filter: filterType, myUserId: MY_USER_ID }));
    }, [activeFilter, MY_USER_ID, dispatch]);

    useEffect(() => { fetchChats(activeFilter); }, [activeFilter]);

    useFocusEffect(
        useCallback(() => {
            fetchChats(activeFilter);
            fetchAndSyncContacts();
        }, [activeFilter])
    );

    useEffect(() => {
        if (!MY_TOKEN || !MY_USER_ID) return;
        if (!socketService.isConnected()) {
            socketService.connect(MY_TOKEN, MY_USER_ID);
        }
        const handleNewMessage = (msg) => {
            const incomingChatId = msg?.chat?._id ?? msg?.chat;
            if (!incomingChatId) return;
            const exists = chats.some((c) => c._id === incomingChatId);
            if (!exists) { fetchChats(activeFilter); return; }
            dispatch(updateChatLastMessage({ msg, myUserId: MY_USER_ID }));
        };
        socketService.on('message-received', handleNewMessage);
        socketService.on('new-message', handleNewMessage);
        return () => {
            socketService.off('message-received', handleNewMessage);
            socketService.off('new-message', handleNewMessage);
        };
    }, [MY_TOKEN, MY_USER_ID, chats, activeFilter, dispatch]);

    const filteredChats = searchQuery.trim()
        ? chats.filter((c) => {
            const q = searchQuery.toLowerCase().trim();
            return (
                c.displayName?.toLowerCase().includes(q) ||
                c.displayUser?.phone?.toLowerCase().includes(q) ||
                c.displayUser?.phoneNumber?.toLowerCase().includes(q)
            );
        })
        : chats;

    // Check if chat is pinned - BOTH local state AND API pinnedBy field
    const isChatPinned = (chatItem) => {
        const isLocalPinned = pinnedIds.includes(chatItem._id);
        const isApiPinned = chatItem?.pinnedBy?.includes(MY_USER_ID);
        return isLocalPinned || isApiPinned;
    };

    const sortedChats = [
        ...filteredChats.filter(c => isChatPinned(c)),
        ...filteredChats.filter(c => !isChatPinned(c)),
    ];

    const gotoChatPage = (item) => {
        dispatch(clearUnread(item._id));
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
        // Check BOTH local pinnedIds AND API pinnedBy field
        const isLocalPinned = pinnedIds.includes(item._id);
        const isApiPinned = item?.pinnedBy?.includes(MY_USER_ID);
        setSelectedPinnedItem(isLocalPinned || isApiPinned);
        setMenuVisible(true);
    };

    const handlePin = async (item) => {
        const isLocalPinned = pinnedIds.includes(item._id);
        const isApiPinned = item?.pinnedBy?.includes(MY_USER_ID);
        const isPinned = isLocalPinned || isApiPinned;



        try {
            const endpoint = isPinned
                ? `chats/${item._id}/unpin`
                : `chats/${item._id}/pin`;
            const res = await apiService({ method: 'PUT', endpoint, data: {} });
            if (res?.success) {
                fetchChats(activeFilter);
                setPinnedIds([]);
            }
        } catch (e) {
            console.error('Pin/Unpin error:', e);
            // Revert optimistic update on error
            if (isPinned) {
                setPinnedIds(prev => [...prev, item._id]);
            } else {
                setPinnedIds(prev => prev.filter(id => id !== item._id));
            }
        }
    };

    const handleDelete = async (item) => {
        dispatch(removeChat(item._id));
        // Remove from pinned list if it was pinned
        setPinnedIds(prev => prev.filter(id => id !== item._id));
        try {
            const res = await apiService({ method: 'DELETE', endpoint: `chats/${item._id}` });
            if (!res?.success) fetchChats(activeFilter);
        } catch (e) {
            console.error('Delete chat error:', e);
            fetchChats(activeFilter);
        }
    };

    const handleBlock = async (item) => {
        const userId = item?.displayUser?._id;
        if (!userId) { console.warn('Block failed: userId not found', item); return; }
        dispatch(removeChat(item._id));
        // Remove from pinned list if it was pinned
        setPinnedIds(prev => prev.filter(id => id !== item._id));
        try {
            const res = await apiService({ method: 'POST', endpoint: `users/block/${userId}` });
            if (!res?.success) fetchChats(activeFilter);
        } catch (e) {
            console.error('Block user error:', e);
            fetchChats(activeFilter);
        }
    };

    const renderChat = ({ item }) => (
        <SwipeableChatItem
            item={item}
            theme={theme}
            onPress={gotoChatPage}
            onDelete={handleDelete}
            onBlock={handleBlock}
            onLongPress={handleLongPress}
            pinnedIds={pinnedIds}
            userId={MY_USER_ID}
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
                isPinned={selectedPinnedItem}
            />
            <HeaderMenu
                visible={headerMenuVisible}
                onClose={() => setHeaderMenu(false)}
                syncLoading={syncLoading}
                onSyncContacts={manualSync}
                onProfile={() => navigation.navigate('Settings')}
            />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.profileBtn} activeOpacity={0.8}>
                    <Image source={{ uri: avatarUri }} style={styles.profileAvatar} />
                    {totalUnread > 0 && <View style={styles.headerBadge} />}
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{userData?.name || 'Chats'}</Text>
                    {syncLoading && (
                        <Text style={styles.syncingLabel}>Syncing contacts...</Text>
                    )}
                </View>
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
                        onPress={() => setActiveFilter(f)}
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
                    ItemSeparatorComponent={() => (
                        <View style={{ height: 0.5, backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0', marginLeft: 82 }} />
                    )}
                    contentContainerStyle={sortedChats.length === 0 && styles.emptyContainer}
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
            <TouchableOpacity onPress={() => navigation.navigate('Contact')} style={styles.fab} activeOpacity={0.85}>
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
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80, gap: 10 },
    emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    emptyTitle: { fontSize: 17, fontWeight: '600' },
    emptySubtitle: { fontSize: 13 },

    header: { backgroundColor: '#1199ff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10, gap: 12 },
    profileBtn: { position: 'relative' },
    profileAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: '#cce5ff' },
    headerBadge: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#25D366', borderWidth: 1.5, borderColor: '#1199ff' },
    headerCenter: { flex: 1 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    syncingLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 },
    threeDotBtn: { padding: 6 },

    searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginTop: 12, marginBottom: 2, paddingHorizontal: 12, borderRadius: 14, height: 44, borderWidth: 1.5, gap: 8 },
    searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
    clearBtn: { padding: 4 },

    filterRow: { flexDirection: 'row', paddingHorizontal: 14, marginTop: 10, marginBottom: 6, gap: 8 },
    filterBtn: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
    activeFilter: { backgroundColor: '#1199ff', borderColor: '#1199ff' },
    filterText: { fontSize: 13, fontWeight: '500' },

    fab: { position: 'absolute', right: 18, bottom: 28, backgroundColor: '#1199ff', width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6 },
});