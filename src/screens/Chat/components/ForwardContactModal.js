import React, { useState, useMemo, useEffect } from 'react';
import {
    View, Text, TextInput, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, Image, Modal,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import Config from '../../../services/config';
const BASE_URL = Config.Main_url;

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const resolveAvatar = (path) => {
    if (!path) return DEFAULT_AVATAR;
    return Config?.MEDIA_URL + path;
};

const ForwardContactModal = ({ visible, onClose, onForward }) => {
    const chats = useSelector((state) => state.chatList?.chats ?? []);
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
        const q = searchText.toLowerCase();
        return chats.filter(
            (c) =>
                c.displayName?.toLowerCase().includes(q) ||
                c.displayUser?.phone?.toLowerCase().includes(q) ||
                c.displayUser?.phoneNumber?.toLowerCase().includes(q)
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
                style={[s.chatItem, selected && s.chatItemSelected]}
                onPress={() => toggleSelect(item)}
                activeOpacity={0.7}
            >
                <Image
                    source={{ uri: resolveAvatar(item.displayAvatar) }}
                    style={s.avatar}
                />
                <View style={s.chatInfo}>
                    <Text style={s.chatName} numberOfLines={1}>{item.displayName}</Text>
                    {item.lastMessage?.content ? (
                        <Text style={s.chatLastMsg} numberOfLines={1}>
                            {item.lastMessage.content}
                        </Text>
                    ) : null}
                </View>
                <View style={[s.checkbox, selected && s.checkboxSelected]}>
                    {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <Pressable style={s.overlay} onPress={onClose} />

            <View style={s.sheet}>
                <View style={s.handle} />

                <View style={s.header}>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={22} color="#444" />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>
                        Forward to{selectedChats.length > 0 ? ` (${selectedChats.length})` : ''}
                    </Text>
                    <View style={{ width: 22 }} />
                </View>

                <View style={s.searchBar}>
                    <Ionicons name="search" size={16} color="#999" />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Search chats..."
                        placeholderTextColor="#bbb"
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
                    <View style={s.chipsRow}>
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
                                <Ionicons name="chatbubbles-outline" size={48} color="#ddd" />
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
