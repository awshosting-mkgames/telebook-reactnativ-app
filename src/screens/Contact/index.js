import React, { useState, useContext, useRef, useEffect } from 'react';
import {
    StyleSheet, Text, View, TextInput, Image, TouchableOpacity,
    FlatList, SafeAreaView, StatusBar, ActivityIndicator,
    Platform, Alert, Keyboard, Share,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';
import { searchUserByPhone } from '../../components/searchUserByPhone';
import CreateChannelPopup from '../../components/CreateChannelPopup';
import apiService from '../../services/apiService';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

export default function Contact({ navigation }) {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);

    const isDark = theme.mode === 'dark';

    const contacts = useSelector((state) => state.contacts?.contacts ?? [], shallowEqual);
    const loading = useSelector((state) => state.contacts?.syncing ?? false);
    const maniAllData = useSelector((state) => state.totalappData);
    const MY_USER_ID = maniAllData?.userId ?? '';

    const debounceRef = useRef(null);
    const [createChannelPopup, setCreateChannelPopup] = useState(false);
    const [search, setSearch] = useState('');
    const [searchResult, setSearchResult] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [contactSearch, setContactSearch] = useState('');

    useEffect(() => {
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, []);

    const cleanPhoneNumber = (raw) => {
        let digits = (raw || '').toString().replace(/\D/g, '');
        if (digits.startsWith('91') && digits.length > 10) {
            digits = digits.slice(2);
        }
        return digits;
    };

    const handleInvite = async (phone) => {
        try {
            const cleaned = cleanPhoneNumber(phone);
            await Share.share({
                title: 'App Install',
                message:
                    'Hey! Install the Telebook app and start using it. Download it from this link: https://telebookservices.com/download',
            });
        } catch (err) {
            console.log('Share error:', err);
        }
    };

    const handleSearch = (text) => {
        setSearch(text);
        const query = text.toLowerCase().trim();
        const digits = cleanPhoneNumber(text);
        if (!query) {
            setSearchResult([]);
            return;
        }
        const isNumberSearch = /^\d+$/.test(query);

        const filteredContacts =
            contacts?.filter((item) => {
                const name = (item?.name || item?.displayName || '')
                    .trim()
                    .toLowerCase();

                const phone = (item?.phone || item?.mobile || '')
                    .replace(/\D/g, '');

                if (isNumberSearch) {
                    return phone.startsWith(digits);
                }

                return name.startsWith(query);
            }) || [];

        setSearchResult(filteredContacts);
    };

    const gotoCreateNew = (type) => {
        if (type === 'channel') setCreateChannelPopup(true);
        else navigation.navigate('FindContact', { createType: type });
    };

    const gotoContactChat = async (item, type) => {
        try {
            const response = await apiService({
                method: 'POST',
                endpoint: 'chats',
                data: { userId: type === 1 ? item?.appUser?._id : item?._id },
            });
            if (response?.success) {
                const otherUser = (response?.data?.chat?.users || []).find(u => u?._id !== MY_USER_ID);
                navigation.navigate('Chat', {
                    chatId: response?.data?.chat?._id,
                    chatName: otherUser?.name || 'User',
                    chatImage: otherUser?.profilePicture,
                    isGroup: false,
                });
            } else {
                Alert.alert('Error', response?.message || 'Something went wrong');
            }
        } catch (err) {
            console.log('Chat creation error:', err);
            Alert.alert('Error', 'Failed to start chat');
        }
    };

    const filteredContacts = contacts && contacts.length > 0 && contacts.filter((item) => {
        const name = (item?.name || item?.displayName || '').toLowerCase();
        const phone = (item?.phone || item?.mobile || '').toLowerCase();
        const query = contactSearch.toLowerCase();
        return name.includes(query) || phone.includes(query);
    });

    const ContactItem = ({ item, type }) => {
        const isUnregistered = type === 1 && !item?.isRegistered;
        const phone = item?.phone || item?.mobile || '';

        return (
            <TouchableOpacity
                onPress={() => (isUnregistered ? handleInvite(phone) : gotoContactChat(item, type))}
                style={[
                    styles.contactItem,
                    {
                        backgroundColor: theme.background,
                        borderBottomColor: isDark ? '#333' : '#eee',
                    },
                ]}>
                <Image
                    source={{ uri: item?.avatar || DEFAULT_AVATAR }}
                    style={[styles.avatar, { backgroundColor: isDark ? '#3a3a3a' : '#e0e0e0' }]}
                />
                <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, { color: theme.text }]}>
                        {item?.name || item?.displayName || 'Unknown'}
                    </Text>
                    <Text style={[styles.contactStatus, { color: isDark ? '#aaaaaa' : '#777777' }]}>
                        {phone || 'No number'}
                    </Text>
                </View>
                {isUnregistered ? (
                    <TouchableOpacity onPress={() => handleInvite(phone)} style={styles.inviteContainer}>
                        <Text style={styles.inviteText}>{t('Invite Now')}</Text>
                    </TouchableOpacity>
                ) : (
                    <View
                        style={{
                            ...styles.inviteContainer,
                            borderColor: '#4491f2',
                            borderWidth: 2,
                            borderRadius: 15,
                            paddingVertical: 5,
                            paddingHorizontal: 15,
                        }}
                    >
                        <Text style={styles.inviteText}>{t('Chat')}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const ActionItem = ({ type, icon, label }) => (
        <TouchableOpacity onPress={() => gotoCreateNew(type)} style={styles.actionItem}>
            <View style={styles.actionIconContainer}>
                <Ionicons name={icon} size={22} color="white" />
            </View>
            <Text style={[styles.actionLabel, { color: theme.text }]}>{label}</Text>
        </TouchableOpacity>
    );

    const SearchResultList = () => {
        if (!search.trim()) return null;
        if (searchLoading)
            return <ActivityIndicator size="small" color={theme.primary || '#4491f2'} style={{ marginVertical: 20 }} />;
        const digits = cleanPhoneNumber(search);
        if (!searchResult.length) {
            if (digits.length === 10) {
                return (
                    <View style={[styles.searchResultBox, { backgroundColor: theme.background, borderBottomColor: isDark ? '#333' : '#eee' }]}>
                        <View style={[styles.contactItem, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
                            <Image source={{ uri: DEFAULT_AVATAR }} style={[styles.avatar, { backgroundColor: isDark ? '#3a3a3a' : '#e0e0e0' }]} />
                            <View style={styles.contactInfo}>
                                <Text style={[styles.contactName, { color: theme.text }]}>{digits}</Text>
                                <Text style={[styles.contactStatus, { color: isDark ? '#aaaaaa' : '#777777' }]}>{t('Not on Telebook')}</Text>
                            </View>
                            <TouchableOpacity onPress={() => handleInvite(digits)} style={styles.inviteContainer}>
                                <Text style={styles.inviteText}>{t('Invite Now')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            }
            return null;
        }
        return (
            <View style={[styles.searchResultBox, { backgroundColor: theme.background, borderBottomColor: isDark ? '#333' : '#eee' }]}>
                <FlatList
                    data={searchResult}
                    keyExtractor={(item, i) => item?.id?.toString() || i.toString()}
                    renderItem={({ item }) => <ContactItem item={item} type={1} />}
                    scrollEnabled={true}
                    nestedScrollEnabled={true}
                    style={{ maxHeight: 280 }}
                />
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle="light-content" backgroundColor="#4491f2" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={26} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('Contact')}</Text>
            </View>
            <View>
                <View style={styles.searchSection}>
                    <View style={[styles.searchBar, { backgroundColor: isDark ? '#2a2a2a' : '#f2f2f2' }]}>
                        <Ionicons name="search" size={20} color={isDark ? '#aaaaaa' : '#666666'} style={styles.searchIcon} />
                        <TextInput
                            placeholder={t('Search')}
                            style={[styles.searchInput, { color: isDark ? '#e6e3e3' : '#000000' }]}
                            placeholderTextColor={isDark ? '#888888' : '#999999'}
                            value={search}
                            onChangeText={handleSearch}
                            autoCorrect={false}
                            autoComplete="off"
                            autoCapitalize="none"
                            blurOnSubmit={false}
                            returnKeyType="search"
                            importantForAutofill="no"
                        />
                        <TouchableOpacity onPress={() => Keyboard.dismiss()}>
                            <Ionicons name="apps" size={20} color={isDark ? '#dddddd' : '#333333'} style={styles.dialpadIcon} />
                        </TouchableOpacity>
                    </View>
                </View>
                <SearchResultList />
                <View style={styles.actionsContainer}>
                    <ActionItem type="group" icon="people" label={t('New group')} />
                    <ActionItem type="channel" icon="people-circle" label={t('New Channel')} />
                    <ActionItem type="broadcast" icon="megaphone" label={t('New broadcast')} />
                </View>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionHeaderText, { color: theme.textSecondary || '#888', marginBottom: 8 }]}>
                        {t('Contacts on app')}
                    </Text>
                </View>
            </View>
            {loading ? (
                <ActivityIndicator size="large" color="#4491f2" style={{ marginTop: 100 }} />
            ) : (
                <View style={{ flex: 1 }}>
                    <FlatList
                        data={filteredContacts}
                        keyExtractor={(item, i) => item?.id?.toString() || i.toString()}
                        renderItem={({ item }) => <ContactItem item={item} type={1} />}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        initialNumToRender={10}
                        windowSize={11}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </View>
            )}
            {createChannelPopup && (
                <CreateChannelPopup visible={createChannelPopup} onClose={() => setCreateChannelPopup(false)} />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        backgroundColor: '#4491f2', height: 90,
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 20,
    },
    headerTitle: { color: 'white', fontSize: 20, fontWeight: '500', marginLeft: 25 },
    searchSection: { padding: 15 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', borderRadius: 25,
        paddingHorizontal: 15, height: 48,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 16 },
    dialpadIcon: { marginLeft: 10 },
    actionsContainer: { paddingHorizontal: 15, paddingVertical: 8 },
    actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    actionIconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#4491f2', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    actionLabel: { fontSize: 16, fontWeight: '600' },
    sectionHeader: { paddingHorizontal: 15, paddingVertical: 12 },
    sectionHeaderText: { fontSize: 15, fontWeight: '600' },
    contactItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, },
    avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e0e0e0' },
    contactInfo: { flex: 1, marginLeft: 15 },
    contactName: { fontSize: 16, fontWeight: '600' },
    contactStatus: { fontSize: 13, color: '#777', marginTop: 2 },
    inviteContainer: { right: 5 },
    inviteText: { color: '#4491f2', fontWeight: '600', fontSize: 14 },
    searchResultBox: { backgroundColor: '#fff', maxHeight: 280 },
});