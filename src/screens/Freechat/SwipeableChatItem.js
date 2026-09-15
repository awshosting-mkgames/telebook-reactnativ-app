// components/SwipeableChatItem.js
import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import {
    Alert,
    Animated,
    Image,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const ACTION_WIDTH = 140;
const SWIPE_THRESHOLD = 60;
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const lastMsgPreview = (lastMsg) => {
    if (!lastMsg) return 'No messages yet';
    if (lastMsg.isDeleted) return '🚫 Message deleted';
    if (lastMsg.messageType === 'image') return '📷 Photo';
    if (lastMsg.messageType === 'video') return '🎥 Video';
    if (lastMsg.messageType === 'audio') return '🎤 Voice';
    if (lastMsg.messageType === 'document') return '📄 Document';
    return lastMsg.content || 'No messages yet';
};

const getInitials = (name = '') => name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const AVATAR_COLORS = ['#1199ff', '#25D366', '#FF9500', '#FF3B30', '#AF52DE', '#5AC8FA'];
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

export default function SwipeableChatItem({ item, theme, onPress, onDelete, onBlock, onLongPress, pinnedIds, userId }) {
    const translateX = useRef(new Animated.Value(0)).current;
    const rowOpen = useRef(false);
    console.log("item_________", item)
    // Check BOTH local pinnedIds AND API pinnedBy field
    const isLocalPinned = pinnedIds?.includes(item?._id);
    const isApiPinned = item?.pinnedBy?.includes(userId);
    const isPinned = isLocalPinned || isApiPinned;

    const isGroup = item?.isGroupChat;
    const lastMsg = item?.latestMessage;
    const msgText = lastMsgPreview(lastMsg);
    const timeStr = formatTime(lastMsg?.createdAt || item?.updatedAt);
    const unread = item?.unreadCount || item?.unseenCount || 0;
    const hasAvatar = !!item.displayAvatar;

    const panResponder = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
            Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 8,
        onPanResponderGrant: () => {
            translateX.setOffset(rowOpen.current ? -ACTION_WIDTH : 0);
            translateX.setValue(0);
        },
        onPanResponderMove: (_, g) => translateX.setValue(Math.min(0, g.dx)),
        onPanResponderRelease: (_, g) => {
            translateX.flattenOffset();
            const cur = rowOpen.current ? -ACTION_WIDTH + g.dx : g.dx;
            if (cur < -SWIPE_THRESHOLD) {
                Animated.spring(translateX, { toValue: -ACTION_WIDTH, useNativeDriver: true, bounciness: 4 }).start();
                rowOpen.current = true;
            } else {
                Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
                rowOpen.current = false;
            }
        },
    })).current;

    const closeRow = () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        rowOpen.current = false;
    };

    const handleSwipeDelete = () => {
        closeRow();
        Alert.alert(
            'Delete Chat',
            `"${item.displayName}" ka chat delete karna chahte ho?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(item) },
            ]
        );
    };

    const handleSwipeBlock = () => {
        closeRow();
        Alert.alert(
            'Block Contact',
            `Block ${item.displayName}? They won't be able to send you messages.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Block', style: 'destructive', onPress: () => onBlock(item) },
            ]
        );
    };

    return (
        <View style={styles.swipeContainer}>
            {isPinned && <View style={styles.pinStripe} />}

            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.blockBtn} onPress={handleSwipeBlock} activeOpacity={0.85}>
                    <Ionicons name="ban-outline" size={22} color="#fff" />
                    <Text style={styles.actionBtnText}>Block</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={handleSwipeDelete} activeOpacity={0.85}>
                    <Ionicons name="trash-outline" size={22} color="#fff" />
                    <Text style={styles.actionBtnText}>Delete</Text>
                </TouchableOpacity>
            </View>

            {/* Chat Row */}
            <Animated.View
                style={[
                    styles.chatRowAnimated,
                    {
                        backgroundColor: isPinned ? (theme.mode === 'light' ? '#dbdbdb' : '#393939') : (theme.mode === 'light' ? '#ffffff' : '#000000'),
                        transform: [{ translateX }],
                    },
                ]}
                {...panResponder.panHandlers} >
                <TouchableOpacity
                    onPress={() => { rowOpen.current ? closeRow() : onPress(item); }}
                    onLongPress={() => { closeRow(); onLongPress(item); }}
                    delayLongPress={350}
                    style={styles.chatItem}
                    activeOpacity={0.75} >
                    {/* Avatar */}
                    <View style={styles.avatarWrap}>
                        {hasAvatar ? (
                            <Image
                                source={{ uri: item.displayAvatar }}
                                style={styles.avatar}
                                defaultSource={{ uri: DEFAULT_AVATAR }}
                            />
                        ) : (
                            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: avatarColor(item.displayName) }]}>
                                <Text style={styles.avatarInitials}>{getInitials(item.displayName)}</Text>
                            </View>
                        )}
                        {!isGroup && item?.displayUser?.isOnline && <View style={styles.onlineDot} />}
                        {isPinned && (
                            <View style={styles.pinBadge}>
                                <Ionicons name="pin" size={9} color="#fff" />
                            </View>
                        )}
                    </View>

                    {/* Content */}
                    <View style={styles.chatContent}>
                        <View style={styles.chatTopRow}>
                            <View style={styles.nameRow}>
                                {isGroup && (
                                    <View style={styles.groupTag}>
                                        <Ionicons name="people" size={11} color="#1199ff" />
                                    </View>
                                )}
                                <Text style={[styles.name, { color: theme.text || '#111' }]} numberOfLines={1}>
                                    {item.displayName}
                                </Text>
                            </View>
                            <Text style={[styles.time, unread > 0 && styles.timeUnread, { color: theme.mode === 'light' ? '#161616' : '#cdcdcd' }]}>{timeStr}</Text>
                        </View>

                        <View style={styles.chatBottomRow}>
                            <Text
                                style={[styles.message, { color: theme.mode === 'light' ? '#161616' : '#cdcdcd' }, unread > 0 && styles.unreadMsg]}
                                numberOfLines={1}
                            >
                                {isGroup && lastMsg?.sender?.name
                                    ? `${lastMsg.sender.name}: ${msgText}`
                                    : msgText}
                            </Text>
                            {unread > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    swipeContainer: { overflow: 'hidden' },
    pinStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#1199ff', zIndex: 10 },
    actionsContainer: { position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_WIDTH, flexDirection: 'row' },
    blockBtn: { flex: 1, backgroundColor: '#FF9500', alignItems: 'center', justifyContent: 'center', gap: 4 },
    deleteBtn: { flex: 1, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', gap: 4 },
    actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    chatRowAnimated: { backgroundColor: '#fff' },
    chatItem: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
    avatarWrap: { position: 'relative', marginRight: 13 },
    avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#eee' },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarInitials: { color: '#fff', fontSize: 18, fontWeight: '700' },
    onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#25D366' },
    pinBadge: { position: 'absolute', top: -1, right: -1, width: 18, height: 18, borderRadius: 9, backgroundColor: '#1199ff', alignItems: 'center', justifyContent: 'center' },
    chatContent: { flex: 1, minWidth: 0 },
    chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    chatBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    nameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6, marginRight: 8 },
    groupTag: { backgroundColor: '#e8f4ff', borderRadius: 8, padding: 3 },
    name: { fontSize: 15, fontWeight: '600', flex: 1 },
    message: { fontSize: 13, flex: 1, marginRight: 8 },
    unreadMsg: { fontWeight: '600' },
    time: { color: '#bbb', fontSize: 12, flexShrink: 0 },
    timeUnread: { color: '#1199ff', fontWeight: '600' },
    badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#1199ff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});