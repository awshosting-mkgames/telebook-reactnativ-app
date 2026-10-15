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
    Modal,
    Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';
import CreateChannelPopup from '../../components/CreateChannelPopup';
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

const toArray = (val) => (Array.isArray(val) ? val : []);

const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
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

const EmptyState = ({ icon = 'alert-circle-outline', message = 'No data found', hint, action, onAction, isDark }) => (
    <View style={styles.emptyWrap}>
        <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#141414' : '#f4f7f9' }]}>
            <Ionicons name={icon} size={30} color="#1296f3" />
        </View>
        <Text style={[styles.emptyTitle, { color: isDark ? '#bbb' : '#555' }]}>{message}</Text>
        {!!hint && <Text style={[styles.emptyText, { color: isDark ? '#555' : '#9aa5ad' }]}>{hint}</Text>}
        {!!action && (
            <TouchableOpacity
                style={[styles.emptyActionBtn, { backgroundColor: isDark ? '#0d1e2e' : '#e8f4fd' }]}
                onPress={onAction}
                activeOpacity={0.8}
            >
                <Text style={styles.emptyActionText}>{action}</Text>
            </TouchableOpacity>
        )}
    </View>
);

const TABS = [
    { key: 'all', label: 'Discover' },
    { key: 'my', label: 'My Channels' },
    { key: 'subscribed', label: 'Subscribed' },
];

const Channels = ({ navigation }) => {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const isDark = theme.text === '#FFFFFF';

    const [activeTab, setActiveTab] = useState('all');

    // ── Discover tab (existing, unchanged behavior) ──
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [following, setFollowing] = useState({});
    const [loadingFollow, setLoadingFollow] = useState({});

    // ── My Channels / Subscribed tabs (moved from Updates screen) ──
    const [myChannels, setMyChannels] = useState([]);
    const [subscribedChannels, setSubscribedChannels] = useState([]);
    const [loadingMyChannels, setLoadingMyChannels] = useState(true);
    const [loadingSubscribed, setLoadingSubscribed] = useState(true);
    const [createChannelPopup, setCreateChannelPopup] = useState(false);

    // Sponsor (Channel Boost) — "channels/my/owned" isSponsored flag nahi deta
    // (sirf general "channels" listing deti hai), isliye success ke baad
    // local optimistic state se row ko sponsored mark karte hain.
    const [boostLoadingId, setBoostLoadingId] = useState(null);
    const [boostSheet, setBoostSheet] = useState(null);
    const [boostPurchasingId, setBoostPurchasingId] = useState(null);

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

    const fetchMyChannels = useCallback(async () => {
        try {
            setLoadingMyChannels(true);
            const res = await apiService({ method: 'GET', endpoint: 'channels/my/owned' });
            const list = toArray(res?.data?.channels ?? res?.data ?? res?.channels ?? res);
            setMyChannels(list);
        } catch (e) {
            console.error('My channels error:', e);
        } finally {
            setLoadingMyChannels(false);
        }
    }, []);

    const fetchSubscribedChannels = useCallback(async () => {
        try {
            setLoadingSubscribed(true);
            const res = await apiService({ method: 'GET', endpoint: 'channels/my/subscribed' });
            const list = toArray(res?.data?.channels ?? res?.data ?? res?.channels ?? res);
            setSubscribedChannels(list);
        } catch (e) {
            console.error('Subscribed channels error:', e);
        } finally {
            setLoadingSubscribed(false);
        }
    }, []);

    // Focus par current tab ka data refresh — Updates/detail screen se subscribe
    // badalne ke baad yahan purani state dikhti rehti thi.
    useFocusEffect(
        useCallback(() => {
            fetchChannels({ silent: true });
            if (activeTab === 'my') fetchMyChannels();
            if (activeTab === 'subscribed') fetchSubscribedChannels();
        }, [fetchChannels, fetchMyChannels, fetchSubscribedChannels, activeTab])
    );

    const handleTabPress = (tab) => {
        setActiveTab(tab);
        if (tab === 'my') fetchMyChannels();
        if (tab === 'subscribed') fetchSubscribedChannels();
    };

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

    // ── My Channels / Subscribed rows (moved from Updates screen, unchanged logic) ──

    const markChannelSponsored = (channelId) => {
        setMyChannels((prev) =>
            prev.map((c) => ((c?._id || c?.id) === channelId ? { ...c, isSponsored: true } : c))
        );
    };

    const closeSponsorSheet = () => setBoostSheet(null);

    const openSponsorSheet = async (item) => {
        const channelId = item?._id || item?.id;
        if (!channelId || boostLoadingId) return;

        setBoostLoadingId(channelId);
        try {
            const res = await apiService({ method: 'GET', endpoint: 'channels/boost/options' });
            if (!res?.success) {
                Alert.alert('Error', res?.error?.message || 'Could not load sponsor options');
                return;
            }
            const payload = res.data?.data || {};
            if (!payload.enabled) {
                Alert.alert('Not available', "Channel sponsoring isn't available right now");
                return;
            }
            setBoostSheet({
                channelId,
                channelName: item?.channelName || item?.name || item?.title || 'Channel',
                balance: payload.balance ?? 0,
                options: toArray(payload.options),
            });
        } catch (e) {
            console.error('Boost options error:', e);
            Alert.alert('Error', 'Could not load sponsor options');
        } finally {
            setBoostLoadingId(null);
        }
    };

    const pickBoostOption = async (optionId) => {
        if (!boostSheet || boostPurchasingId) return;
        const { channelId } = boostSheet;

        setBoostPurchasingId(optionId);
        try {
            const res = await apiService({
                method: 'POST',
                endpoint: `channels/${channelId}/boost`,
                data: { optionId },
            });

            if (res?.success) {
                const message = res.data?.message || 'Channel promoted!';
                closeSponsorSheet();
                markChannelSponsored(channelId);
                Alert.alert('Channel promoted!', message);
                return;
            }

            const err = res?.error;
            closeSponsorSheet();
            if (err?.code === 'INSUFFICIENT_COINS') {
                Alert.alert(
                    'Not enough coins',
                    err?.message || 'You need more coins to promote this channel',
                    [
                        { text: 'Buy coins', onPress: () => navigation.navigate('Wallet') },
                        { text: 'Cancel', style: 'cancel' },
                    ]
                );
            } else {
                Alert.alert('Error', err?.message || 'Could not sponsor this channel');
            }
        } catch (e) {
            console.error('Boost purchase error:', e);
            closeSponsorSheet();
            Alert.alert('Error', 'Could not sponsor this channel');
        } finally {
            setBoostPurchasingId(null);
        }
    };

    const channalDetils = (id, type) => {
        if (type === 'otherChannal') {
            navigation.navigate('Channeldetailscreen', { channelId: id });
        } else {
            navigation.navigate('Mychannelscreen', { channelId: id });
        }
    };

    const renderChannelRow = ({ item, type = 'otherChannal' }) => {
        const id = item?._id || item?.id;
        const name = item?.channelName || item?.name || item?.title || 'Channel';
        const imageUri = mediaUrl(item?.channelIcon);
        const subCount = item?.subscriberCount ?? item?.subscribers?.length ?? item?.followersCount ?? 0;
        const postCount = item?.totalMessages ?? item?.messageCount ?? 0;
        const unseen = item?.unseenCount ?? 0;
        const desc = item?.channelDescription || item?.description || item?.bio || '';
        const verified = item?.verified || item?.isVerified;
        const updatedAt = item?.updatedAt || item?.createdAt;

        return (
            <TouchableOpacity
                style={[styles.row, { borderBottomColor: isDark ? '#1e1e1e' : '#f1f1f1' }]}
                onPress={() => channalDetils(id, type)}
                activeOpacity={0.75}
            >
                <ChannelAvatar uri={imageUri} isDark={isDark} />

                <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                        {verified && <Ionicons name="checkmark-circle" size={15} color="#1296f3" />}
                        {item?.isPrivate && <Ionicons name="lock-closed" size={12} color={isDark ? '#666' : '#999'} />}
                    </View>

                    {!!desc && (
                        <Text style={[styles.desc, { color: isDark ? '#777' : '#777' }]} numberOfLines={1}>{desc}</Text>
                    )}

                    <Text style={[styles.followers, { color: isDark ? '#555' : '#9aa5ad' }]} numberOfLines={1}>
                        {formatCount(subCount)} {subCount === 1 ? 'subscriber' : 'subscribers'}
                        {postCount > 0 ? ` · ${formatCount(postCount)} ${postCount === 1 ? 'post' : 'posts'}` : ''}
                    </Text>
                </View>

                <View style={styles.rowEnd}>
                    <Text style={styles.time}>{timeAgo(updatedAt)}</Text>
                    {unseen > 0 && (
                        <View style={styles.unseenBadge}>
                            <Text style={styles.unseenText}>{unseen > 99 ? '99+' : unseen}</Text>
                        </View>
                    )}
                    {type === 'mychannel' && (
                        item?.isSponsored ? (
                            <View style={[styles.sponsoredBadge, { backgroundColor: isDark ? '#07240f' : '#e8f8ee' }]}>
                                <Ionicons name="star" size={11} color="#16a34a" />
                                <Text style={styles.sponsoredText}>Sponsored</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.sponsorBtn, { backgroundColor: isDark ? '#0d1e2e' : '#e8f4fd' }]}
                                onPress={() => openSponsorSheet(item)}
                                disabled={boostLoadingId === id}
                                activeOpacity={0.8}
                            >
                                {boostLoadingId === id ? (
                                    <ActivityIndicator size="small" color="#1296f3" />
                                ) : (
                                    <>
                                        <Ionicons name="rocket-outline" size={13} color="#1296f3" />
                                        <Text style={styles.sponsorText}>Sponsor</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const sectionTitleColor = isDark ? '#d0d0d0' : '#222';
    const createBtnBg = isDark ? '#0d1e2e' : '#e8f4fd';

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

            {/* Tab bar — Discover / My Channels / Subscribed */}
            <View style={[styles.tabBar, { borderBottomColor: isDark ? '#1e1e1e' : '#eee' }]}>
                {TABS.map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tabItem, active && { borderBottomColor: '#1296f3' }]}
                            onPress={() => handleTabPress(tab.key)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabLabel, { color: active ? '#1296f3' : (isDark ? '#888' : '#667781') }]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {activeTab === 'all' && (
                <>
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
                                <EmptyState
                                    icon="megaphone-outline"
                                    message={search ? 'No channels found' : 'No channels yet'}
                                    hint={search ? `Nothing matches "${search}"` : 'Channels created by others will show up here'}
                                    isDark={isDark}
                                />
                            }
                        />
                    )}
                </>
            )}

            {activeTab === 'my' && (
                <>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>My Channels</Text>
                            {myChannels.length > 0 && (
                                <View style={[styles.countPill, { backgroundColor: isDark ? '#1e1e1e' : '#eef2f5' }]}>
                                    <Text style={[styles.countPillText, { color: isDark ? '#aaa' : '#667781' }]}>{myChannels.length}</Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity
                            style={[styles.createBtn, { backgroundColor: createBtnBg }]}
                            onPress={() => setCreateChannelPopup(true)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add" size={16} color="#1296f3" />
                            <Text style={styles.createBtnText}>Create</Text>
                        </TouchableOpacity>
                    </View>

                    {loadingMyChannels ? (
                        <ActivityIndicator color="#1296f3" style={{ marginTop: 40 }} />
                    ) : (
                        <FlatList
                            data={myChannels}
                            renderItem={({ item }) => renderChannelRow({ item, type: 'mychannel' })}
                            keyExtractor={(item, i) => (item?._id || i).toString()}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
                            onRefresh={fetchMyChannels}
                            refreshing={loadingMyChannels}
                            ListEmptyComponent={
                                <EmptyState
                                    icon="megaphone-outline"
                                    message="No channels yet"
                                    hint="Create a channel to broadcast posts to your subscribers"
                                    action="Create channel"
                                    onAction={() => setCreateChannelPopup(true)}
                                    isDark={isDark}
                                />
                            }
                        />
                    )}
                </>
            )}

            {activeTab === 'subscribed' && (
                <>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>Subscribed Channels</Text>
                            {subscribedChannels.length > 0 && (
                                <View style={[styles.countPill, { backgroundColor: isDark ? '#1e1e1e' : '#eef2f5' }]}>
                                    <Text style={[styles.countPillText, { color: isDark ? '#aaa' : '#667781' }]}>{subscribedChannels.length}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {loadingSubscribed ? (
                        <ActivityIndicator color="#1296f3" style={{ marginTop: 40 }} />
                    ) : (
                        <FlatList
                            data={subscribedChannels}
                            renderItem={({ item }) => renderChannelRow({ item, type: 'otherChannal' })}
                            keyExtractor={(item, i) => (item?._id || i).toString()}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
                            onRefresh={fetchSubscribedChannels}
                            refreshing={loadingSubscribed}
                            ListEmptyComponent={
                                <EmptyState
                                    icon="people-outline"
                                    message="Not subscribed to any channel"
                                    hint="Open Discover and subscribe to see their posts here"
                                    action="Go to Discover"
                                    onAction={() => handleTabPress('all')}
                                    isDark={isDark}
                                />
                            }
                        />
                    )}
                </>
            )}

            {createChannelPopup && (
                <CreateChannelPopup
                    visible={createChannelPopup}
                    onClose={() => { setCreateChannelPopup(false); fetchMyChannels(); }}
                />
            )}

            {/* Sponsor options bottom-sheet — local ad-hoc Modal, no shared Modal component (see PROGRESS.md §3) */}
            <Modal visible={!!boostSheet} transparent animationType="slide" onRequestClose={closeSponsorSheet}>
                <Pressable style={styles.sheetOverlay} onPress={closeSponsorSheet}>
                    <Pressable
                        style={[styles.sheet, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}
                        onStartShouldSetResponder={() => true}
                    >
                        <View style={styles.sheetHandle} />
                        <Text style={[styles.sheetTitle, { color: theme.text }]}>
                            Sponsor {boostSheet?.channelName}
                        </Text>
                        <Text style={[styles.sheetSub, { color: isDark ? '#777' : '#9aa5ad' }]}>
                            Your balance: {boostSheet?.balance ?? 0} coins
                        </Text>

                        {toArray(boostSheet?.options).length === 0 ? (
                            <Text style={[styles.sheetEmpty, { color: isDark ? '#777' : '#9aa5ad' }]}>
                                No boost options available right now
                            </Text>
                        ) : (
                            toArray(boostSheet?.options).map((opt) => {
                                const isPurchasingThis = boostPurchasingId === opt.id;
                                return (
                                    <TouchableOpacity
                                        key={opt.id}
                                        style={[
                                            styles.optionRow,
                                            { borderBottomColor: isDark ? '#2a2a2a' : '#eee' },
                                            !opt.affordable && styles.optionRowDim,
                                        ]}
                                        onPress={() => pickBoostOption(opt.id)}
                                        disabled={!!boostPurchasingId}
                                        activeOpacity={0.75}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.optionTitle, { color: theme.text }]}>
                                                {opt.hours} {opt.hours === 1 ? 'hour' : 'hours'}
                                            </Text>
                                            <Text style={styles.optionCoins}>{opt.coins} coins</Text>
                                            {!opt.affordable && (
                                                <Text style={styles.optionInsufficient}>Insufficient coins</Text>
                                            )}
                                        </View>
                                        {isPurchasingThis ? (
                                            <ActivityIndicator color="#1296f3" />
                                        ) : (
                                            <Ionicons name="rocket-outline" size={18} color="#1296f3" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
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

    // ── Tab bar ──
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabLabel: { fontSize: 13, fontWeight: '600' },

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

    // ── My Channels / Subscribed section header ──
    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600' },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    countPill: { minWidth: 22, paddingHorizontal: 6, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    countPillText: { fontSize: 12, fontWeight: '700' },
    createBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    },
    createBtnText: { color: '#1296f3', fontSize: 13, fontWeight: '600' },

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
    rowEnd: { alignItems: 'flex-end', marginLeft: 8, gap: 5 },
    time: { fontSize: 11, color: '#1296f3' },
    unseenBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: '#1296f3', alignItems: 'center', justifyContent: 'center' },
    unseenText: { color: '#fff', fontSize: 11, fontWeight: '700' },
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

    // ── Sponsor button / Sponsored badge (My Channels rows only) ──
    sponsorBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginTop: 2 },
    sponsorText: { color: '#1296f3', fontSize: 11, fontWeight: '700' },
    sponsoredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginTop: 2, borderWidth: 1, borderColor: '#16a34a' },
    sponsoredText: { color: '#16a34a', fontSize: 10, fontWeight: '700' },

    // ── Sponsor options bottom-sheet ──
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28 },
    sheetHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    sheetTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
    sheetSub: { fontSize: 12, textAlign: 'center', marginBottom: 14 },
    sheetEmpty: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
    optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 0.5 },
    optionRowDim: { opacity: 0.5 },
    optionTitle: { fontSize: 14, fontWeight: '600' },
    optionCoins: { fontSize: 12, color: '#1296f3', marginTop: 2 },
    optionInsufficient: { fontSize: 11, color: '#e25555', marginTop: 2 },

    emptyWrap: { alignItems: 'center', paddingTop: 70, gap: 6 },
    emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    emptyTitle: { fontSize: 15, fontWeight: '700' },
    emptyText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
    emptyActionBtn: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18 },
    emptyActionText: { color: '#1296f3', fontSize: 13, fontWeight: '700' },
});
