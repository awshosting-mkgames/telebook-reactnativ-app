import React, { useState, useContext, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    Image,
    SafeAreaView,
    StatusBar,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import Config from '../../services/config';

// Icon relative path me aata hai — media host ke saath jodna hota hai.
// Pehle Config.Main_url ki string par .MEDIA_URL lagta tha (undefined), isliye
// kisi bhi channel ka icon load nahi hota tha.
const mediaUrl = (path) => {
    if (!path) return null;
    return path.startsWith('http') ? path : `${Config.MEDIA_URL}${path}`;
};

const formatCount = (n = 0) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

// Icon load fail ho to placeholder — warna khali circle reh jata tha
const ChannelAvatar = ({ uri, isDark }) => {
    const [failed, setFailed] = useState(false);
    if (!uri || failed) {
        return (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: isDark ? '#1a2a3a' : '#e8f4fd' }]}>
                <Ionicons name="megaphone" size={22} color="#1296f3" />
            </View>
        );
    }
    return <Image source={{ uri }} style={styles.avatar} onError={() => setFailed(true)} />;
};

const Channels = ({ navigation }) => {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const isDark = theme.text === '#FFFFFF';

    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [following, setFollowing] = useState({});
    const [loadingFollow, setLoadingFollow] = useState({});

    const fetchChannels = useCallback(async ({ silent = false } = {}) => {
        try {
            if (silent) setRefreshing(true); else setLoading(true);
            const response = await apiService({
                method: 'GET',
                endpoint: 'channels',
            });

            const list = response?.data?.channels ?? [];
            setChannels(list);

            const followMap = {};
            list.forEach(item => {
                followMap[item._id] =
                    item.isSubscribed ?? item.is_followed ?? false;
            });
            setFollowing(followMap);
        } catch (e) {
            console.error('Channels fetch error:', e);
            Alert.alert('Error', 'Could not load channels');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Focus par refresh — Updates/detail screen se subscribe badalne ke baad
    // yahan purani state dikhti rehti thi.
    useFocusEffect(
        useCallback(() => { fetchChannels({ silent: true }); }, [fetchChannels])
    );

    const filteredChannels = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return channels;
        return channels.filter((c) =>
            c?.channelName?.toLowerCase().includes(q) ||
            c?.channelDescription?.toLowerCase().includes(q)
        );
    }, [channels, search]);

    const handleFollow = async (item) => {
        const isFollowed = following[item._id];
        const delta = isFollowed ? -1 : 1;

        setFollowing(prev => ({ ...prev, [item._id]: !isFollowed }));
        setLoadingFollow(prev => ({ ...prev, [item._id]: true }));

        const revert = () => {
            setFollowing(prev => ({ ...prev, [item._id]: isFollowed }));
            setChannels(prev => prev.map(c =>
                c._id === item._id
                    ? { ...c, subscriberCount: Math.max(0, (c.subscriberCount ?? 0) - delta) }
                    : c
            ));
        };

        // Count turant update — warna subscribe ke baad number purana dikhta tha
        setChannels(prev => prev.map(c =>
            c._id === item._id
                ? { ...c, subscriberCount: Math.max(0, (c.subscriberCount ?? 0) + delta), isSubscribed: !isFollowed }
                : c
        ));

        try {
            // apiService HTTP error par throw nahi karta — success check zaroori hai,
            // warna fail hone par bhi button "Subscribed" dikhata reh jata tha.
            const res = await apiService({
                method: 'PUT',
                endpoint: isFollowed
                    ? `channels/${item._id}/unsubscribe`
                    : `channels/${item._id}/subscribe`,
                data: {},
            });
            if (!res?.success) {
                revert();
                Alert.alert('Error', res?.error?.message || 'Something went wrong, please try again');
            }
        } catch (e) {
            console.error('Follow error:', e);
            revert();
            Alert.alert('Error', 'Something went wrong, please try again');
        } finally {
            setLoadingFollow(prev => ({ ...prev, [item._id]: false }));
        }
    };

    const gotoChannalDetils = (item) => {
        navigation.navigate('Channeldetailscreen', { channelId: item?._id });
    };

    const renderItem = ({ item }) => {

        const isFollowed = following[item._id];
        const isLoading = loadingFollow[item._id];

        const name = item.channelName ?? 'Unknown';
        const imageUri = mediaUrl(item.channelIcon);
        // API subscriberCount deta hai; subscribers array har response me nahi hota
        const followerCount = item.subscriberCount ?? item.subscribers?.length ?? 0;
        const isVerified = item.verified ?? false;
        const desc = item.channelDescription || '';

        return (
            <View style={[styles.row, { borderBottomColor: isDark ? '#1e1e1e' : '#f1f1f1' }]}>
                <TouchableOpacity onPress={() => gotoChannalDetils(item)} style={styles.left} activeOpacity={0.75}>
                    <ChannelAvatar uri={imageUri} isDark={isDark} />
                    <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                            {isVerified && (
                                <Ionicons name="checkmark-circle" size={16} color="#1d9bf0" />
                            )}
                            {item.isPrivate && (
                                <Ionicons name="lock-closed" size={12} color={isDark ? '#666' : '#999'} />
                            )}
                        </View>
                        {!!desc && (
                            <Text style={[styles.desc, { color: isDark ? '#777' : '#777' }]} numberOfLines={1}>{desc}</Text>
                        )}
                        <Text style={[styles.followers, { color: isDark ? '#555' : '#9aa5ad' }]} numberOfLines={1}>
                            {formatCount(followerCount)} {followerCount === 1 ? 'subscriber' : 'subscribers'}
                            {item.category && item.category !== 'other' ? ` · ${item.category}` : ''}
                        </Text>
                    </View>
                </TouchableOpacity>


                <TouchableOpacity
                    style={[styles.followBtn, isFollowed && styles.followedBtn]}
                    onPress={() => handleFollow(item)}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator
                            size="small"
                            color={isFollowed ? '#16a34a' : '#fff'}
                        />
                    ) : isFollowed ? (
                        <View style={styles.followedInner}>
                            <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                            <Text style={styles.followedText}>Subscribed</Text>
                        </View>
                    ) : (
                        <Text style={styles.followText}>Subscribe</Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                {/* Ye ek tab screen hai — back arrow tabhi jab sach me wapas ja sakein */}
                {navigation.canGoBack() && (
                    <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>
                )}
                <Text style={[styles.headerTitle, !navigation.canGoBack() && { marginLeft: 0 }]}>
                    {t('Channels')}
                </Text>
            </View>

            <View style={[styles.searchBar, { backgroundColor: isDark ? '#1e1e1e' : '#f2f2f2' }]}>
                <Ionicons name="search" size={17} color={isDark ? '#666' : '#aaa'} />
                <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Search channels..."
                    placeholderTextColor={isDark ? '#666' : '#aaa'}
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close-circle" size={17} color={isDark ? '#666' : '#aaa'} />
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <ActivityIndicator color="#1296f3" size="large" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filteredChannels}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
                    onRefresh={() => fetchChannels({ silent: true })}
                    refreshing={refreshing}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#141414' : '#f4f7f9' }]}>
                                <Ionicons name="megaphone-outline" size={30} color="#1296f3" />
                            </View>
                            <Text style={[styles.emptyTitle, { color: isDark ? '#bbb' : '#555' }]}>
                                {search ? 'No channels found' : 'No channels yet'}
                            </Text>
                            <Text style={[styles.emptyText, { color: isDark ? '#555' : '#9aa5ad' }]}>
                                {search
                                    ? `Nothing matches "${search}"`
                                    : 'Channels created by others will show up here'}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

export default Channels;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        height: 90,
        backgroundColor: '#1296f3',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '500',
        marginLeft: 16,
        flex: 1,
    },
    headerRight: {
        flexDirection: 'row',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 14,
        marginTop: 12,
        marginBottom: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 22,
    },
    searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        justifyContent: 'space-between',
        borderBottomWidth: 0.5,
        gap: 10,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    desc: { fontSize: 13, marginTop: 1 },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
    },
    avatarPlaceholder: {
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    followers: {
        fontSize: 12,
        marginTop: 2,
    },

    // ── Follow (not subscribed) ──
    followBtn: {
        backgroundColor: '#1296f3',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        minWidth: 108,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#1296f3',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    followText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },

    // ── Followed (isSubscribed === true) — soft green pill with tick ──
    followedBtn: {
        backgroundColor: '#e8f8ee',
        borderWidth: 1.5,
        borderColor: '#16a34a',
        elevation: 0,
        shadowOpacity: 0,
    },
    followedInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    followedText: {
        color: '#16a34a',
        fontSize: 14,
        fontWeight: '700',
    },

    emptyWrap: { alignItems: 'center', paddingTop: 70, gap: 6 },
    emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    emptyTitle: { fontSize: 15, fontWeight: '700' },
    emptyText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
});
