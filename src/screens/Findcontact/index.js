import React, { useState, useMemo, useContext } from 'react';
import {
    View, Text, TextInput, SectionList, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, Image, Platform, StatusBar, Share,
} from 'react-native';

// Avatar with fallback initials
const AvatarImg = ({ uri, name: rawName = '', size = 50, style }) => {
    const [error, setError] = useState(false);
    const name = rawName || '';
    const initials = name.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    const colors = ['#4491f2', '#25D366', '#FF9500', '#AF52DE', '#FF3B30', '#5AC8FA'];
    const bg = colors[(name.charCodeAt(0) || 0) % colors.length];
    const r = size / 2;

    if (!uri || error) {
        return (
            <View style={[{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
                <Text style={{ color: '#fff', fontSize: size * 0.36, fontWeight: '700' }}>{initials}</Text>
            </View>
        );
    }
    return (
        <Image
            source={{ uri }}
            style={[{ width: size, height: size, borderRadius: r }, style]}
            onError={() => setError(true)}
        />
    );
};
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import Config from '../../services/config';

const getAvatar = (item) =>
    item?.appUser?.profilePicture ? Config.Main_url + item.appUser.profilePicture : null;

const FindContact = ({ navigation, route }) => {
    const createType = route?.params?.createType || [];
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const isDark = theme.text === '#FFFFFF';

    const allContacts = useSelector((state) => state.contacts?.contacts ?? []);
    const loading = useSelector((state) => state.contacts?.syncing ?? false);

    const [searchText, setSearchText] = useState('');
    const [selectedContacts, setSelectedContacts] = useState([]);

    // Select sirf app par registered contacts ho sakte hain, par list me baaki
    // contacts bhi "invite" ke saath dikhte hain — warna jis phone me koi app
    // user nahi hai, uske liye screen puri khali lagti thi.
    // Redux se direct derive karte hain — beech me state rakhne se list sync ke
    // baad stale reh jati thi.
    const filteredContacts = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        if (!q) return allContacts ?? [];
        return (allContacts ?? []).filter(
            (c) => (c.name || '').toLowerCase().includes(q) || c.phone?.includes(q)
        );
    }, [searchText, allContacts]);

    const sections = useMemo(() => {
        const onApp = filteredContacts.filter((c) => c?.isRegistered);
        const toInvite = filteredContacts.filter((c) => !c?.isRegistered);
        return [
            { key: 'onApp', title: `On Telebook (${onApp.length})`, data: onApp },
            { key: 'invite', title: `Not on Telebook (${toInvite.length})`, data: toInvite },
        ].filter((section) => section.data.length > 0);
    }, [filteredContacts]);

    const inviteContact = async () => {
        try {
            await Share.share({
                title: 'App Install',
                message:
                    'Hey! Install the Telebook app and start using it. Download it from this link: https://telebookservices.com/download',
            });
        } catch (err) {
            console.log('Share error:', err);
        }
    };

    const toggleSelect = (contact) => {
        setSelectedContacts((prev) => {
            const exists = prev.find((c) => c.id === contact.id);
            return exists ? prev.filter((c) => c.id !== contact.id) : [...prev, contact];
        });
    };
    const isSelected = (id) => selectedContacts.some((c) => c.id === id);
    const removeSelected = (id) => setSelectedContacts((prev) => prev.filter((c) => c.id !== id));

    const handleCreateGroup = () => {
        if (createType === 'group') {
            navigation.navigate('CreateGroup', { members: selectedContacts, createType: route?.params?.createType });
        } else {
            navigation.navigate('CreateBroadcast', { members: selectedContacts, createType: route?.params?.createType });
        }
    };

    // ── theme values ──────────────────────────────────────────────
    const bgColor = isDark ? '#0a0a0a' : '#ffffff';
    const cardBg = isDark ? '#111111' : '#ffffff';
    const selectedBg = isDark ? '#0d1e35' : '#f0f6ff';
    const textPrimary = isDark ? '#e0e0e0' : '#111111';
    const textSecondary = isDark ? '#666666' : '#888888';
    const borderColor = isDark ? '#1e1e1e' : '#f0f0f0';
    const searchBg = isDark ? '#1e1e1e' : '#f5f5f5';
    const chipsBg = isDark ? '#111111' : '#fafafa';
    const chipsBorder = isDark ? '#1e1e1e' : '#ececec';
    const placeholderClr = isDark ? '#555' : '#bbb';
    const searchIconClr = isDark ? '#555' : '#aaa';
    const countColor = isDark ? '#555' : '#aaa';
    const emptyIconClr = isDark ? '#333' : '#ddd';
    const emptyTextClr = isDark ? '#444' : '#bbb';

    // ── Contact row ───────────────────────────────────────────────
    const renderItem = ({ item }) => {
        const selected = isSelected(item.id);
        const registered = !!item?.isRegistered;
        return (
            <TouchableOpacity
                style={[
                    styles.contactItem,
                    {
                        backgroundColor: selected ? selectedBg : cardBg,
                        borderBottomColor: borderColor,
                    },
                ]}
                onPress={() => (registered ? toggleSelect(item) : inviteContact())}
                activeOpacity={0.7}
            >
                <View style={styles.avatarWrapper}>
                    <AvatarImg uri={getAvatar(item)} name={item.name || item.phone || 'User'} size={50} />
                    {registered && (
                        <View style={[styles.onlineDot, { borderColor: selected ? selectedBg : cardBg }]} />
                    )}
                </View>
                <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, { color: textPrimary }]} numberOfLines={1}>
                        {item.name || item.phone || 'User'}
                    </Text>
                    <Text style={[styles.contactPhone, { color: textSecondary }]} numberOfLines={1}>
                        {item.phone}
                    </Text>
                </View>
                {registered ? (
                    <View style={[
                        styles.checkbox,
                        { borderColor: selected ? '#4491f2' : (isDark ? '#333' : '#ccc') },
                        selected && styles.checkboxSelected,
                    ]}>
                        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                ) : (
                    <Text style={styles.inviteText}>Invite</Text>
                )}
            </TouchableOpacity>
        );
    };

    // ── Selected chips — FIXED layout ────────────────────────────
    const SelectedChips = () => {
        if (!selectedContacts.length) return null;
        return (
            <View style={[styles.chipsOuter, { backgroundColor: chipsBg, borderBottomColor: chipsBorder }]}>
                <FlatList
                    data={selectedContacts}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.chipsScroll, { paddingTop: 8 }]}
                    renderItem={({ item }) => (
                        <View style={styles.chipWrap}>
                            {/* Avatar row with close button absolutely on top-right */}
                            <View style={styles.chipAvatarWrap}>
                                <AvatarImg uri={getAvatar(item)} name={item.name || item.phone || 'User'} size={CHIP_AVATAR} />
                                <TouchableOpacity
                                    onPress={() => removeSelected(item.id)}
                                    style={[styles.chipRemove, { backgroundColor: isDark ? '#0a0a0a' : '#ffffff' }]}
                                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                >
                                    <Ionicons name="close-circle" size={18} color="#4491f2" />
                                </TouchableOpacity>
                            </View>
                            {/* Name strictly below avatar, no overlap */}
                            <Text
                                style={[styles.chipName, { color: isDark ? '#7ab4f5' : '#4491f2' }]}
                                numberOfLines={1}
                            >
                                {(item.name || item.phone || 'User').split(' ')[0]}
                            </Text>
                        </View>
                    )}
                />
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: bgColor }]}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.headerBack}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Add members</Text>
                    {selectedContacts.length > 0 && (
                        <Text style={styles.headerSub}>{selectedContacts.length} selected</Text>
                    )}
                </View>
            </View>

            {/* Selected chips */}
            <SelectedChips />

            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: searchBg }]}>
                <Ionicons name="search" size={17} color={searchIconClr} />
                <TextInput
                    style={[styles.searchInput, { color: textPrimary }]}
                    placeholder="Search by name or phone..."
                    placeholderTextColor={placeholderClr}
                    value={searchText}
                    onChangeText={setSearchText}
                />
                {searchText.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchText('')}>
                        <Ionicons name="close-circle" size={18} color={searchIconClr} />
                    </TouchableOpacity>
                )}
            </View>

            {!loading && (
                <Text style={[styles.countText, { color: countColor }]}>
                    {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
                </Text>
            )}

            {loading ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#4491f2" />
                    <Text style={[styles.loadingText, { color: textSecondary }]}>Loading contacts...</Text>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item, index) => String(item?.id ?? item?.phone ?? index)}
                    renderItem={renderItem}
                    renderSectionHeader={({ section }) => (
                        <Text style={[styles.sectionHeader, { color: textSecondary, backgroundColor: bgColor }]}>
                            {section.title}
                        </Text>
                    )}
                    stickySectionHeadersEnabled={false}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    contentContainerStyle={{ paddingBottom: 120 }}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }]}>
                                <Ionicons name="people-outline" size={44} color={emptyIconClr} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: textPrimary }]}>
                                {searchText ? 'No results found' : 'No contacts yet'}
                            </Text>
                            <Text style={[styles.emptyText, { color: emptyTextClr }]}>
                                {searchText
                                    ? `No match for "${searchText}"`
                                    : 'Your phone contacts will appear here.\nTry Settings → Sync Contacts to refresh.'}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Floating button */}
            {selectedContacts.length >= 1 && (
                <TouchableOpacity style={styles.floatingBtn} onPress={handleCreateGroup} activeOpacity={0.85}>
                    <Ionicons name="people" size={20} color="#fff" />
                    <Text style={styles.floatingBtnText}>
                        {createType === 'group' ? 'Create Group' : 'Broadcast'} ({selectedContacts.length})
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
            )}
        </View>
    );
};

const CHIP_AVATAR = 52;

const styles = StyleSheet.create({
    container: { flex: 1 },

    header: { backgroundColor: '#4491f2', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 52, paddingBottom: 14, elevation: 4 },
    headerBack: { padding: 4, marginRight: 4 },
    headerCenter: { flex: 1 },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },

    // ── chips — fixed ──────────────────────────────────────────
    chipsOuter: { borderBottomWidth: 0.5, paddingTop: 8, paddingBottom: 10 },
    chipsScroll: { paddingHorizontal: 16, gap: 12, alignItems: 'flex-start' },
    chipWrap: { alignItems: 'center', width: 64, paddingTop: 6 },
    chipAvatarWrap: { width: CHIP_AVATAR, height: CHIP_AVATAR, position: 'relative', marginBottom: 5 },
    chipRemove: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        elevation: 5,
    },
    chipName: { fontSize: 11, fontWeight: '500', textAlign: 'center', width: '100%' },

    searchBar: { flexDirection: 'row', alignItems: 'center', margin: 12, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
    searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
    countText: { paddingHorizontal: 16, paddingBottom: 6, fontSize: 12 },
    sectionHeader: { paddingHorizontal: 16, paddingVertical: 6, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    inviteText: { color: '#4491f2', fontSize: 13, fontWeight: '600', marginLeft: 10 },

    contactItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
    avatarWrapper: { position: 'relative' },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee' },
    onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#25D366', borderWidth: 2 },
    contactInfo: { flex: 1, marginLeft: 13 },
    contactName: { fontSize: 15, fontWeight: '600' },
    contactPhone: { fontSize: 12, marginTop: 2 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    checkboxSelected: { backgroundColor: '#4491f2', borderColor: '#4491f2' },

    loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14 },
    emptyBox: { paddingTop: 60, alignItems: 'center', gap: 10 },
    emptyIconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    emptyTitle: { fontSize: 16, fontWeight: '600' },
    emptyText: { fontSize: 13, textAlign: 'center' },

    floatingBtn: { position: 'absolute', bottom: 64, left: 20, right: 20, backgroundColor: '#4491f2', borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 10, elevation: 6 },
    floatingBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default FindContact;
