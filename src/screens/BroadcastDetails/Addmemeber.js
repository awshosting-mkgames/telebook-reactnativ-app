import React, { useContext, useState, useMemo, useEffect } from 'react';
import {
    View, Text, TextInput, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, Image, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';

const Addmemeber = ({ navigation, route }) => {

    const { theme } = useContext(ThemeContext);
    const isDark = theme?.background === '#000';

    // ── Route params (create-group flow vs add-to-existing-broadcast flow) ────
    const { createType, broadcastId, broadcast } = route?.params ?? {};

    // ── Redux se contacts + loading ───────────────────────────────────────────
    const allContacts = useSelector((state) => state.contacts?.contacts ?? []);
    const loading = useSelector((state) => state.contacts?.loading ?? false);

    const [searchText, setSearchText] = useState('');
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [showContacts, setShowContacts] = useState([]);

    // Sirf registered contacts dikhao
    useEffect(() => {
        setShowContacts(allContacts.filter((item) => item?.isRegistered));
    }, [allContacts]);

    const filteredContacts = useMemo(() => {
        if (!searchText.trim()) return showContacts;
        const q = searchText.toLowerCase();
        return showContacts.filter(
            (c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
        );
    }, [searchText, showContacts]);

    const toggleSelect = (contact) => {
        setSelectedContacts((prev) => {
            const exists = prev.find((c) => c.id === contact.id);
            return exists ? prev.filter((c) => c.id !== contact.id) : [...prev, contact];
        });
    };

    const isSelected = (id) => selectedContacts.some((c) => c.id === id);
    const removeSelected = (id) => setSelectedContacts((prev) => prev.filter((c) => c.id !== id));


    const handleCreateGroup = async () => {
        if (selectedContacts.length < 2) return;
        const ids = selectedContacts.map((c) => c.id);
        try {
            if (broadcastId) {
                const currentIds = broadcast?.recipients?.map((r) => r._id) ?? [];
                const newIds = [...new Set([...currentIds, ...ids])];
                const fd = new FormData();
                fd.append('recipients', JSON.stringify(newIds));
                const res = await apiService({
                    method: 'PUT', endpoint: `broadcasts/${broadcastId}`,
                    data: fd, isMultipart: true,
                });
                if (res?.success) navigation?.goBack();
            } else {

                navigation?.navigate('CreateGroup', { members: selectedContacts, createType });
            }
        } catch (e) {
            console.error('handleCreateGroup error:', e);
        }
    };

    const renderItem = ({ item }) => {
        const selected = isSelected(item.id);
        return (
            <TouchableOpacity
                style={[
                    styles.contactItem,
                    { borderBottomColor: isDark ? '#2a2a2a' : '#f0f0f0' },
                    selected && { backgroundColor: isDark ? '#132635' : '#f0f6ff' },
                ]}
                onPress={() => toggleSelect(item)}
                activeOpacity={0.7}
            >
                <View style={styles.avatarWrapper}>
                    <Image
                        source={{
                            uri: item?.appUser?.avatar || item?.avatar ||
                                `https://avatar.iran.liara.run/public/boy?username=${item.name}`,
                        }}
                        style={styles.avatar}
                    />
                    {item.isRegistered && <View style={styles.onlineDot} />}
                </View>
                <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, { color: theme?.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.contactPhone, { color: isDark ? '#999' : '#888' }]} numberOfLines={1}>
                        {item.isRegistered ? '● App par hai' : `+${item.phone}`}
                    </Text>
                </View>
                <View style={[
                    styles.checkbox,
                    { borderColor: isDark ? '#555' : '#ccc' },
                    selected && styles.checkboxSelected,
                ]}>
                    {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
            </TouchableOpacity>
        );
    };

    const SelectedChips = () => {
        if (!selectedContacts.length) return null;
        return (
            <View style={[styles.chipsContainer, {
                backgroundColor: isDark ? '#111' : '#fafafa',
                borderBottomColor: isDark ? '#2a2a2a' : '#f0f0f0',
            }]}>
                <FlatList
                    data={selectedContacts}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.chip}>
                            <Image source={{ uri: item?.image }} style={styles.chipAvatar} />
                            <Text style={styles.chipName} numberOfLines={1}>
                                {item.name.split(' ')[0]}
                            </Text>
                            <TouchableOpacity
                                onPress={() => removeSelected(item.id)}
                                style={{ position: 'absolute', top: 0, right: -3, backgroundColor: '#ffffff', borderRadius: 25 }}
                            >
                                <Ionicons name="close-circle" size={24} color="#4491f2" />
                            </TouchableOpacity>
                        </View>
                    )}
                />
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme?.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation?.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Add members</Text>
                    {selectedContacts.length > 0 && (
                        <Text style={styles.headerSub}>{selectedContacts.length} selected</Text>
                    )}
                </View>
                {selectedContacts.length >= 2 && (
                    <TouchableOpacity style={styles.createGroupBtn} onPress={handleCreateGroup}>
                        <Text style={styles.createGroupText}>Group</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            <SelectedChips />

            <View style={[styles.searchBar, { backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5' }]}>
                <Ionicons name="search" size={18} color="#999" />
                <TextInput
                    style={[styles.searchInput, { color: theme?.text }]}
                    placeholder="Search by name or phone number..."
                    placeholderTextColor="#999"
                    value={searchText}
                    onChangeText={setSearchText}
                />
                {searchText.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchText('')}>
                        <Ionicons name="close" size={18} color="#999" />
                    </TouchableOpacity>
                )}
            </View>

            {!loading && (
                <Text style={[styles.countText, { color: isDark ? '#777' : '#aaa' }]}>
                    {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
                </Text>
            )}

            {loading ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#4491f2" />
                    <Text style={[styles.loadingText, { color: isDark ? '#999' : '#888' }]}>Contact is loading...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredContacts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Ionicons name="people-outline" size={52} color={isDark ? '#444' : '#ddd'} />
                            <Text style={[styles.emptyText, { color: isDark ? '#777' : '#bbb' }]}>
                                {searchText ? `"${searchText}" nahi mila` : 'No find any one'}
                            </Text>
                        </View>
                    }
                />
            )}

            {selectedContacts.length >= 2 && (
                <TouchableOpacity style={styles.floatingBtn} onPress={handleCreateGroup} activeOpacity={0.85}>
                    <Ionicons name="people" size={20} color="#fff" />
                    <Text style={styles.floatingBtnText}>
                        {createType === 'group' ? 'Create Group' : 'Broadcast Your Message to'}
                        {' '}({selectedContacts.length})
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    // Header stays the fixed brand blue regardless of theme, per request
    header: {
        height: 90, backgroundColor: '#1296f3', flexDirection: 'row',
        alignItems: 'center', paddingHorizontal: 14,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    headerCenter: { flex: 1, marginLeft: 16 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },
    createGroupBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
    createGroupText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    chipsContainer: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
    chip: { alignItems: 'center', borderRadius: 30, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, gap: 5, maxWidth: 110 },
    chipAvatar: { width: 50, height: 50, borderRadius: 25 },
    chipName: { fontSize: 12, color: '#4491f2', fontWeight: '400', maxWidth: 55 },
    searchBar: { flexDirection: 'row', alignItems: 'center', margin: 12, borderRadius: 25, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
    searchInput: { flex: 1, fontSize: 15 },
    countText: { paddingHorizontal: 16, paddingBottom: 6, fontSize: 12 },
    contactItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 11, borderBottomWidth: 0.5 },
    avatarWrapper: { position: 'relative' },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eee' },
    onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#25D366', borderWidth: 2, borderColor: '#fff' },
    contactInfo: { flex: 1, marginLeft: 13 },
    contactName: { fontSize: 16, fontWeight: '600' },
    contactPhone: { fontSize: 12, marginTop: 3 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    checkboxSelected: { backgroundColor: '#4491f2', borderColor: '#4491f2' },
    loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14 },
    emptyBox: { paddingTop: 60, alignItems: 'center', gap: 12 },
    emptyText: { fontSize: 14, textAlign: 'center' },
    floatingBtn: { position: 'absolute', bottom: 24, left: 24, right: 24, backgroundColor: '#4491f2', borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 10, elevation: 6, shadowColor: '#4491f2', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
    floatingBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default Addmemeber;