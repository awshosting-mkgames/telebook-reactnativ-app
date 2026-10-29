import React, { useState, useMemo, useEffect, useContext } from 'react';
import {
    View, Text, TextInput, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, Image, Modal,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import Config from '../../../services/config';
import { ThemeContext } from '../../../components/ThemeContext';
const BASE_URL = Config.Main_url;

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

// displayAvatar processChat me pehle se poora URL hai — dobara MEDIA_URL mat jodo
const resolveAvatar = (path) => {
    if (!path) return DEFAULT_AVATAR;
    return /^(https?:|file:|data:)/.test(path) ? path : Config?.MEDIA_URL + path;
};

const previewOf = (m) => {
    if (!m || m.isDeleted) return '';
    if (m.messageType === 'image') return '📷 Photo';
    if (m.messageType === 'video') return '🎥 Video';
    if (m.messageType === 'audio') return '🎤 Voice';
    if (m.messageType === 'document') return '📄 Document';
    return m.content ?? '';
};

const ForwardContactModal = ({ visible, onClose, onForward }) => {
    const { theme } = useContext(ThemeContext);
    const dark = theme?.mode === 'dark';
    // Point 4: popup current theme (dark/light) ke hisaab se
    const c = {
        sheet: dark ? '#1b1b1b' : '#fff',
        text: dark ? '#f2f2f2' : '#111',
        sub: dark ? '#9a9a9a' : '#888',
        icon: dark ? '#ddd' : '#444',
        line: dark ? '#2e2e2e' : '#f0f0f0',
        input: dark ? '#2a2a2a' : '#f5f5f5',
        inputText: dark ? '#f2f2f2' : '#222',
        placeholder: dark ? '#777' : '#bbb',
        selectedRow: dark ? '#23323f' : '#f0f6ff',
        handle: dark ? '#444' : '#e0e0e0',
        checkBorder: dark ? '#666' : '#ccc',
    };
    const chats = useSelector((state) => state.chatList?.tabs?.All ?? []);
    const loading = useSelector((state) => state.chatList?.loading ?? false);

    const [searchText, setSearchText] = useState('');
    const [selectedChats, setSelectedChats] = useState([]);

    useEffect(() => {
        if (!visible) {
            setSearchText('');
            setSelectedChats([]);
        }
    }, [visible]);

    const filteredChats = useMemo(() => {
        if (!searchText.trim()) return chats;
        const q = searchText.toLowerCase().trim();
        const digits = q.replace(/\D/g, '');
        return chats.filter(
            (c) =>
                c.displayName?.toLowerCase().includes(q) ||
                (digits.length > 0 && String(c.displayUser?.mobile ?? '').includes(digits))
        );
    }, [searchText, chats]);

    const toggleSelect = (chat) => {
        setSelectedChats((prev) => {
            const exists = prev.find((c) => c._id === chat._id);
            return exists ? prev.filter((c) => c._id !== chat._id) : [...prev, chat];
        });
    };

    const isSelected = (id) => selectedChats.some((c) => c._id === id);

    const handleForward = () => {
        if (!selectedChats.length) return;
        const chatIds = selectedChats.map((c) => c._id).filter(Boolean);
        onForward(chatIds);
    };

    const renderItem = ({ item }) => {
        const selected = isSelected(item._id);
        return (
            <TouchableOpacity
                style={[s.chatItem, { borderBottomColor: c.line }, selected && { backgroundColor: c.selectedRow }]}
                onPress={() => toggleSelect(item)}
                activeOpacity={0.7}
            >
                <Image
                    source={{ uri: resolveAvatar(item.displayAvatar) }}
                    style={s.avatar}
                />
                <View style={s.chatInfo}>
                    <Text style={[s.chatName, { color: c.text }]} numberOfLines={1}>{item.displayName}</Text>
                    {previewOf(item.latestMessage) ? (
                        <Text style={[s.chatLastMsg, { color: c.sub }]} numberOfLines={1}>
                            {previewOf(item.latestMessage)}
                        </Text>
                    ) : null}
                </View>
                <View style={[s.checkbox, { borderColor: c.checkBorder }, selected && s.checkboxSelected]}>
                    {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <Pressable style={s.overlay} onPress={onClose} />

            <View style={[s.sheet, { backgroundColor: c.sheet }]}>
                <View style={[s.handle, { backgroundColor: c.handle }]} />

                <View style={[s.header, { borderBottomColor: c.line }]}>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={22} color={c.icon} />
                    </TouchableOpacity>
                    <Text style={[s.headerTitle, { color: c.text }]}>
                        Forward to{selectedChats.length > 0 ? ` (${selectedChats.length})` : ''}
                    </Text>
                    <View style={{ width: 22 }} />
                </View>

                <View style={[s.searchBar, { backgroundColor: c.input }]}>
                    <Ionicons name="search" size={16} color="#999" />
                    <TextInput
                        style={[s.searchInput, { color: c.inputText }]}
                        placeholder="Search chats..."
                        placeholderTextColor={c.placeholder}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <Ionicons name="close" size={16} color="#999" />
                        </TouchableOpacity>
                    )}
                </View>

                {selectedChats.length > 0 && (
                    <View style={[s.chipsRow, { borderBottomColor: c.line }]}>
                        {selectedChats.map((c) => (
                            <TouchableOpacity
                                key={c._id}
                                style={s.chip}
                                onPress={() => toggleSelect(c)}
                            >
                                <Image
                                    source={{ uri: resolveAvatar(c.displayAvatar) }}
                                    style={s.chipAvatar}
                                />
                                <Text style={s.chipName} numberOfLines={1}>
                                    {c.displayName?.split(' ')[0]}
                                </Text>
                                <View style={s.chipClose}>
                                    <Ionicons name="close" size={10} color="#fff" />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1296f3" />
                ) : (
                    <FlatList
                        data={filteredChats}
                        keyExtractor={(item) => item._id}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        ListEmptyComponent={
                            <View style={s.emptyBox}>
                                <Ionicons name="chatbubbles-outline" size={48} color={c.checkBorder} />
                                <Text style={s.emptyText}>No chats found</Text>
                            </View>
                        }
                    />
                )}

                {selectedChats.length > 0 && (
                    <TouchableOpacity style={s.sendBtn} onPress={handleForward} activeOpacity={0.85}>
                        <Ionicons name="send" size={18} color="#fff" />
                        <Text style={s.sendBtnText}>
                            Send to {selectedChats.length} chat{selectedChats.length > 1 ? 's' : ''}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </Modal>
    );
};

const s = StyleSheet.create({
    overlay: {
        flex: 0.3,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
        flex: 0.7,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    handle: {
        width: 40, height: 4, backgroundColor: '#e0e0e0',
        borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6,
    },
    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#f5f5f5', borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 9,
        marginTop: 12, gap: 8,
    },
    searchInput: { flex: 1, fontSize: 14, color: '#222' },
    chipsRow: {
        flexDirection: 'row', flexWrap: 'wrap',
        paddingVertical: 10, gap: 8,
        borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    },
    chip: {
        alignItems: 'center', gap: 4,
        position: 'relative',
    },
    chipAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eee' },
    chipName: { fontSize: 11, color: '#1296f3', maxWidth: 55 },
    chipClose: {
        position: 'absolute', top: -2, right: -2,
        backgroundColor: '#1296f3', borderRadius: 8,
        width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    },
    chatItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, paddingHorizontal: 4,
        borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0',
        gap: 12,
    },
    chatItemSelected: { backgroundColor: '#f0f6ff' },
    avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#eee' },
    chatInfo: { flex: 1 },
    chatName: { fontSize: 15, fontWeight: '600', color: '#111' },
    chatLastMsg: { fontSize: 12, color: '#888', marginTop: 2 },
    checkbox: {
        width: 24, height: 24, borderRadius: 12,
        borderWidth: 2, borderColor: '#ccc',
        alignItems: 'center', justifyContent: 'center',
    },
    checkboxSelected: { backgroundColor: '#1296f3', borderColor: '#1296f3' },
    emptyBox: { paddingTop: 50, alignItems: 'center', gap: 10 },
    emptyText: { fontSize: 14, color: '#bbb' },
    sendBtn: {
        position: 'absolute', bottom: 16, left: 16, right: 16,
        backgroundColor: '#1296f3', borderRadius: 28,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 14, gap: 10, elevation: 4,
    },
    sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default ForwardContactModal;
