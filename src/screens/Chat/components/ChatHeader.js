import { Ionicons } from '@expo/vector-icons';
import { useState, useContext } from 'react';
import {
    Image, Modal, Platform,
    Pressable, StatusBar, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';
import { ThemeContext } from '../../../components/ThemeContext';
import { useNameResolver } from '../../../services/nameResolver';

const ChatHeader = ({
    navigation, chatName, chatImage, isGroup, isBroadcast,
    isTyping, isOnline, gotouserDetails, chatDaetils,
    isSelectMode, selectedCount, onCancelSelect, onForwardSelected,
    onDeleteSelected, onCopySelected, onStarSelected, onReplySelected, onMoreSelected, onSelectAll, MY_USER_ID, fmtTime,
    isSearchMode, searchText, onSearchChange, onOpenSearch, onCloseSearch,
    onClearChat, onOpenStarred, onSaveContact, getFullUrl, isBlocked, onToggleBlock,
    onVoiceCall, onVideoCall, callsAvailable,
}) => {
    const [menuVisible, setMenuVisible] = useState(false);
    const [selMenuVisible, setSelMenuVisible] = useState(false);
    const resolveName = useNameResolver();
    const { theme } = useContext(ThemeContext);
    const isDark = theme?.mode ? theme.mode === 'dark' : theme?.text === '#FFFFFF';
    // Header colour theme token se (dark me neutral dark, light me wahi blue)
    const headerBg = theme?.header ?? '#1296f3';
    const headerStyle = [styles.header, { backgroundColor: headerBg }];

    const menuBg = isDark ? '#1f2c34' : '#ffffff';
    const menuText = isDark ? '#e9edef' : '#222222';
    const dividerC = isDark ? '#2a3942' : '#f0f0f0';

    // ── Search mode ───────────────────────────────────────────────
    if (isSearchMode) {
        return (
            <View style={headerStyle}>
                <TouchableOpacity onPress={onCloseSearch} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={styles.searchInputWrap}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search messages..."
                        placeholderTextColor="#e0f0ff"
                        value={searchText}
                        onChangeText={onSearchChange}
                        autoFocus
                        returnKeyType="search"
                    />
                    {searchText?.length > 0 && (
                        <TouchableOpacity onPress={() => onSearchChange('')}>
                            <Ionicons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    }

    // ── Select mode ───────────────────────────────────────────────
    if (isSelectMode) {
        return (
            <View style={headerStyle}>
                <TouchableOpacity onPress={onCancelSelect} style={styles.backBtn}>
                    <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={[styles.name, { flex: 1 }]}>{selectedCount}</Text>
                {/* Order: Delete(1) · Star(2) · Copy(3) · Forward(4) · Reply (sirf 1 select) */}
                <TouchableOpacity onPress={onDeleteSelected} style={styles.headerActionBtn} disabled={selectedCount === 0}>
                    <Ionicons name="trash-outline" size={22} color={selectedCount === 0 ? '#a0c8f0' : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onStarSelected} style={styles.headerActionBtn} disabled={selectedCount === 0}>
                    <Ionicons name="star-outline" size={22} color={selectedCount === 0 ? '#a0c8f0' : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onCopySelected} style={styles.headerActionBtn} disabled={selectedCount === 0}>
                    <Ionicons name="copy-outline" size={22} color={selectedCount === 0 ? '#a0c8f0' : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onForwardSelected} style={styles.headerActionBtn} disabled={selectedCount === 0}>
                    <Ionicons name="share-outline" size={22} color={selectedCount === 0 ? '#a0c8f0' : '#fff'} />
                </TouchableOpacity>
                {selectedCount === 1 && !!onReplySelected && (
                    <TouchableOpacity onPress={onReplySelected} style={styles.headerActionBtn}>
                        <Ionicons name="arrow-undo-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setSelMenuVisible(true)} style={styles.headerActionBtn}>
                    <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
                </TouchableOpacity>
                <Modal visible={selMenuVisible} transparent animationType="fade" onRequestClose={() => setSelMenuVisible(false)}>
                    <Pressable style={styles.menuOverlay} onPress={() => setSelMenuVisible(false)}>
                        <View style={[styles.menuBox, { backgroundColor: menuBg }]}>
                            {selectedCount === 1 && !!onMoreSelected && (
                                <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { setSelMenuVisible(false); onMoreSelected(); }}>
                                    <Ionicons name="options-outline" size={18} color="#1296f3" />
                                    <Text style={[styles.menuText, { color: menuText }]}>More options</Text>
                                </TouchableOpacity>
                            )}
                            {!!onSelectAll && (
                                <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => { setSelMenuVisible(false); onSelectAll(); }}>
                                    <Ionicons name="checkmark-done-outline" size={18} color="#1296f3" />
                                    <Text style={[styles.menuText, { color: menuText }]}>Select all</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </Pressable>
                </Modal>
            </View>
        );
    }

    // ── Normal mode ───────────────────────────────────────────────
    const otherUser = chatDaetils?.users?.find(u => u._id !== MY_USER_ID);
    const lastSeenValue = otherUser?.lastSeen ?? null;
    // Phonebook me save nahi: number title ke neeche profile naam (ya "Unknown") chhote text me
    const otherName = !isGroup && !isBroadcast && otherUser ? resolveName(otherUser) : null;
    const profileSub = otherName && !otherName.isSaved ? otherName.subtitle : null;

    return (
        <>
            <View style={headerStyle}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity onPress={gotouserDetails} style={styles.avatarWrap}>
                    <Image
                        source={{ uri: chatImage }}
                        style={styles.avatar}
                    />
                    {!isGroup && isOnline && <View style={styles.onlineDot} />}
                </TouchableOpacity>

                <TouchableOpacity onPress={gotouserDetails} style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                        {isBroadcast ? '📢 ' : ''}{chatName}
                    </Text>
                    {!!profileSub && <Text style={styles.sub} numberOfLines={1}>{profileSub}</Text>}
                    {isTyping ? (
                        <Text style={styles.subTyping}>typing...</Text>
                    ) : !isGroup && isOnline ? (
                        <Text style={styles.subOnline}>● Online</Text>
                    ) : isGroup ? (
                        <Text style={styles.sub}>Group</Text>
                    ) : (
                        lastSeenValue ? (
                        <Text style={styles.sub} numberOfLines={1}>last seen {fmtTime(lastSeenValue)}</Text>
                    ) : null
                    )}
                </TouchableOpacity>

                {/* Group calling backend contract mein nahi hai — sirf 1:1 chat ke liye,
                    aur sirf tabhi jab server par calling configured ho (calls/config.available). */}
                {!isGroup && callsAvailable && (
                    <>
                        <TouchableOpacity onPress={onVideoCall} style={{ marginRight: 14 }}>
                            <Ionicons name="videocam" size={22} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onVoiceCall} style={{ marginRight: 14 }}>
                            <Ionicons name="call" size={20} color="#fff" />
                        </TouchableOpacity>
                    </>
                )}
                <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ marginRight: 4 }}>
                    <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Dropdown menu */}
            <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
                    <View style={[styles.menuBox, { backgroundColor: menuBg }]}>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => { setMenuVisible(false); onOpenSearch?.(); }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="search" size={18} color="#1296f3" />
                            <Text style={[styles.menuText, { color: menuText }]}>Search</Text>
                        </TouchableOpacity>
                        {!!onOpenStarred && (
                            <>
                                <View style={[styles.menuDivider, { backgroundColor: dividerC }]} />
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => { setMenuVisible(false); onOpenStarred(); }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="star" size={18} color="#f0a500" />
                                    <Text style={[styles.menuText, { color: menuText }]}>Starred messages</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        <View style={[styles.menuDivider, { backgroundColor: dividerC }]} />
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => { setMenuVisible(false); onClearChat?.(); }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="trash-outline" size={18} color="#e74c3c" />
                            <Text style={[styles.menuText, { color: '#e74c3c' }]}>Clear chat</Text>
                        </TouchableOpacity>
                        {!!onSaveContact && !!profileSub && (
                            <>
                                <View style={[styles.menuDivider, { backgroundColor: dividerC }]} />
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => { setMenuVisible(false); onSaveContact(); }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="person-add-outline" size={18} color="#1296f3" />
                                    <Text style={[styles.menuText, { color: menuText }]}>Save contact</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        {!!onToggleBlock && (
                            <>
                                <View style={[styles.menuDivider, { backgroundColor: dividerC }]} />
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => { setMenuVisible(false); onToggleBlock(); }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name={isBlocked ? 'checkmark-circle-outline' : 'ban-outline'} size={18} color={isBlocked ? '#25A55F' : '#e67e22'} />
                                    <Text style={[styles.menuText, { color: menuText }]}>{isBlocked ? 'Unblock' : 'Block'}</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </Pressable>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    header: { height: 90, backgroundColor: '#1296f3', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, gap: 8 },
    backBtn: { padding: 4 },
    headerActionBtn: { padding: 8 },
    avatarWrap: { position: 'relative' },
    avatar: { width: 38, height: 38, borderRadius: 19 },
    onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#25D366', borderWidth: 2, borderColor: '#1296f3' },
    name: { color: '#fff', fontSize: 17, fontWeight: '600' },
    sub: { color: '#d0eeff', fontSize: 12 },
    subTyping: { color: '#b3e5fc', fontSize: 12, fontStyle: 'italic' },
    subOnline: { color: '#a5f3c0', fontSize: 12, fontWeight: '500' },
    searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 14, height: 40, gap: 8 },
    searchInput: { flex: 1, color: '#fff', fontSize: 16, padding: 0 },
    menuOverlay: { flex: 1, paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 44) + 50, paddingRight: 8, alignItems: 'flex-end' },
    menuBox: { borderRadius: 12, paddingVertical: 6, minWidth: 170, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    menuText: { fontSize: 15, fontWeight: '500' },
    menuDivider: { height: 0.5, marginHorizontal: 8 },
});

export default ChatHeader;
