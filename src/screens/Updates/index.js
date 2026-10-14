import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSelector } from 'react-redux';
import CreateChannelPopup from '../../components/CreateChannelPopup';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import StatusSection from './StatusSection';
import Config from '../../services/config';

// Channel icon relative path me aata hai (uploads/...) — media host chahiye.
// Pehle yahan Config.Main_url ki string par .MEDIA_URL lagaya ja raha tha, jo
// undefined deta tha, isliye kisi bhi channel ka icon load nahi hota tha.
const mediaUrl = (path) => {
    if (!path) return null;
    return path.startsWith('http') ? path : `${Config.MEDIA_URL}${path}`;
};


const toArray = (val) => (Array.isArray(val) ? val : []);

const formatCount = (n) => {
    if (!n && n !== 0) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

// Icon load fail/na ho to megaphone placeholder — pehle blank circle reh jata tha
const ChannelAvatar = ({ uri, isDark }) => {
    const [failed, setFailed] = useState(false);

    if (!uri || failed) {
        return (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: isDark ? '#1a2a3a' : '#e8f4fd' }]}>
                <Ionicons name="megaphone" size={22} color="#1296f3" />
            </View>
        );
    }
    return (
        <Image
            source={{ uri }}
            style={[styles.avatar, { backgroundColor: isDark ? '#1a2a3a' : '#e8f4fd' }]}
            onError={() => setFailed(true)}
        />
    );
};

const EmptyState = ({ icon = 'alert-circle-outline', message = 'No data found', hint, action, onAction, isDark }) => (
    <View style={emptyStyles.wrap}>
        <View style={[emptyStyles.iconWrap, { backgroundColor: isDark ? '#141414' : '#f4f7f9' }]}>
            <Ionicons name={icon} size={30} color="#1296f3" />
        </View>
        <Text style={[emptyStyles.text, { color: isDark ? '#bbb' : '#555' }]}>{message}</Text>
        {!!hint && <Text style={[emptyStyles.hint, { color: isDark ? '#555' : '#9aa5ad' }]}>{hint}</Text>}
        {!!action && (
            <TouchableOpacity
                style={[emptyStyles.actionBtn, { backgroundColor: isDark ? '#0d1e2e' : '#e8f4fd' }]}
                onPress={onAction}
                activeOpacity={0.8}
            >
                <Text style={emptyStyles.actionText}>{action}</Text>
            </TouchableOpacity>
        )}
    </View>
);
const emptyStyles = StyleSheet.create({
    wrap: { alignItems: 'center', paddingVertical: 24, gap: 6 },
    iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    text: { fontSize: 14, fontWeight: '600' },
    hint: { fontSize: 12, textAlign: 'center', paddingHorizontal: 40 },
    actionBtn: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18 },
    actionText: { color: '#1296f3', fontSize: 13, fontWeight: '700' },
});

export default function Updates({ navigation }) {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const isDark = theme.text === '#FFFFFF';

    const maniAllData = useSelector((state) => state.totalappData);
    const MY_USER_ID = maniAllData?.userId ?? '';

    const [myChannels, setMyChannels] = useState([]);
    const [subscribedChannels, setSubscribedChannels] = useState([]);
    const [loadingMyChannels, setLoadingMyChannels] = useState(true);
    const [loadingSubscribed, setLoadingSubscribed] = useState(true);
    const [createChannelPopup, setCreateChannelPopup] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [statusRefreshSignal, setStatusRefreshSignal] = useState(0);

    // Sponsor (Channel Boost) — "channels/my/owned" isSponsored flag nahi deta
    // (sirf general "channels" listing deti hai), isliye success ke baad
    // local optimistic state se row ko sponsored mark karte hain.
    const [boostLoadingId, setBoostLoadingId] = useState(null); // channelId jiske options fetch ho rahe hain
    const [boostSheet, setBoostSheet] = useState(null); // { channelId, channelName, balance, options }
    const [boostPurchasingId, setBoostPurchasingId] = useState(null); // optionId jo abhi purchase ho raha hai

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

    useFocusEffect(
        useCallback(() => {
            fetchMyChannels();
            fetchSubscribedChannels();
        }, [fetchMyChannels, fetchSubscribedChannels])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setStatusRefreshSignal((n) => n + 1);
        await Promise.all([fetchMyChannels(), fetchSubscribedChannels()]);
        setRefreshing(false);
    }, [fetchMyChannels, fetchSubscribedChannels]);

    const markChannelSponsored = (channelId) => {
        setMyChannels((prev) =>
            prev.map((c) => ((c?._id || c?.id) === channelId ? { ...c, isSponsored: true } : c))
        );
    };

    const closeSponsorSheet = () => setBoostSheet(null);

    // Sponsor tap — ek hi channel ke liye on-demand fetch (list ke sab
    // channels ke liye eagerly prefetch nahi karte, warna N parallel requests).
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
                // BOOST_ALREADY_ACTIVE, FEATURE_OFF, ya koi aur failure — plain error
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
                        <Text style={[styles.name, { color: isDark ? '#e0e0e0' : '#111' }]} numberOfLines={1}>{name}</Text>
                        {verified && <Ionicons name="checkmark-circle" size={15} color="#1296f3" />}
                        {item?.isPrivate && <Ionicons name="lock-closed" size={12} color={isDark ? '#666' : '#999'} />}
                    </View>

                    {!!desc && (
                        <Text style={[styles.sub, { color: isDark ? '#777' : '#777' }]} numberOfLines={1}>{desc}</Text>
                    )}

                    <Text style={[styles.subCount, { color: isDark ? '#555' : '#9aa5ad' }]} numberOfLines={1}>
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

    // theme-derived
    const sectionTitleColor = isDark ? '#d0d0d0' : '#222';
    const createBtnBg = isDark ? '#0d1e2e' : '#e8f4fd';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor="#1296f3" barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('Updates')}</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1296f3']} tintColor="#1296f3" />
                }
            >

                {/* Status Section */}
                <StatusSection
                    navigation={navigation}
                    myUserId={MY_USER_ID}
                    refreshSignal={statusRefreshSignal}
                />

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]} />

                {/* My Channels */}
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
                    <ActivityIndicator color="#1296f3" style={{ marginVertical: 16 }} />
                ) : myChannels.length === 0 ? (
                    <EmptyState
                        icon="megaphone-outline"
                        message="No channels yet"
                        hint="Create a channel to broadcast posts to your subscribers"
                        action="Create channel"
                        onAction={() => setCreateChannelPopup(true)}
                        isDark={isDark}
                    />
                ) : (
                    <FlatList
                        data={myChannels}
                        renderItem={({ item }) => renderChannelRow({ item, type: 'mychannel' })}
                        keyExtractor={(item, i) => (item?._id || i).toString()}
                        scrollEnabled={false}
                    />
                )}

                {/* Subscribed Channels */}
                <View style={[styles.divider, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]} />

                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>Subscribed Channels</Text>
                        {subscribedChannels.length > 0 && (
                            <View style={[styles.countPill, { backgroundColor: isDark ? '#1e1e1e' : '#eef2f5' }]}>
                                <Text style={[styles.countPillText, { color: isDark ? '#aaa' : '#667781' }]}>{subscribedChannels.length}</Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity
                        style={[styles.createBtn, { backgroundColor: createBtnBg }]}
                        onPress={() => navigation.navigate('Channels')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="search" size={14} color="#1296f3" />
                        <Text style={styles.createBtnText}>Explore</Text>
                    </TouchableOpacity>
                </View>

                {loadingSubscribed ? (
                    <ActivityIndicator color="#1296f3" style={{ marginVertical: 16 }} />
                ) : subscribedChannels.length === 0 ? (
                    <EmptyState
                        icon="people-outline"
                        message="Not subscribed to any channel"
                        hint="Explore channels and subscribe to see their posts here"
                        action="Explore channels"
                        onAction={() => navigation.navigate('Channels')}
                        isDark={isDark}
                    />
                ) : (
                    <FlatList
                        data={subscribedChannels}
                        renderItem={({ item }) => renderChannelRow({ item, type: 'otherChannal' })}
                        keyExtractor={(item, i) => (item?._id || i).toString()}
                        scrollEnabled={false}
                    />
                )}

            </ScrollView>

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
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        height: 90, backgroundColor: '#1296f3',
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    headerTitle: { color: '#fff', fontSize: 19, fontWeight: '600' },

    divider: { height: 1, marginVertical: 4 },

    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600' },
    createBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    },
    createBtnText: { color: '#1296f3', fontSize: 13, fontWeight: '600' },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    countPill: { minWidth: 22, paddingHorizontal: 6, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    countPillText: { fontSize: 12, fontWeight: '700' },

    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 0.5,
    },
    avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
    name: { fontSize: 15, fontWeight: '600', flex: 1 },
    sub: { fontSize: 13, marginTop: 1 },
    subCount: { fontSize: 12, marginTop: 2 },
    rowEnd: { alignItems: 'flex-end', marginLeft: 8, gap: 5 },
    time: { fontSize: 11, color: '#1296f3' },
    unseenBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: '#1296f3', alignItems: 'center', justifyContent: 'center' },
    unseenText: { color: '#fff', fontSize: 11, fontWeight: '700' },

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
});

