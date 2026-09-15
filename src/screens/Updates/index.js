import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Platform,
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
const BASE_URL = Config.Main_url;


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

const EmptyState = ({ icon = 'alert-circle-outline', message = 'No data found', isDark }) => (
    <View style={emptyStyles.wrap}>
        <Ionicons name={icon} size={36} color={isDark ? '#444' : '#ccc'} />
        <Text style={[emptyStyles.text, { color: isDark ? '#555' : '#aaa' }]}>{message}</Text>
    </View>
);
const emptyStyles = StyleSheet.create({
    wrap: { alignItems: 'center', paddingVertical: 24, gap: 8 },
    text: { fontSize: 14 },
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
        const imageUri = item.channelIcon ? `${BASE_URL?.MEDIA_URL}${item.channelIcon}` : null;
        const subCount = item?.subscribers?.length ?? item?.subscriberCount ?? item?.followersCount ?? 0;
        const desc = item?.channelDescription || item?.description || item?.bio || '';
        const verified = item?.verified || item?.isVerified;
        const updatedAt = item?.updatedAt || item?.createdAt;

        return (
            <TouchableOpacity
                style={[styles.row, { borderBottomColor: isDark ? '#1e1e1e' : '#f1f1f1' }]}
                onPress={() => channalDetils(id, type)}
                activeOpacity={0.75}
            >
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: isDark ? '#1a2a3a' : '#e8f4fd' }]}>
                        <Ionicons name="megaphone-outline" size={22} color="#1296f3" />
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                        <Text style={[styles.name, { color: isDark ? '#e0e0e0' : '#111' }]} numberOfLines={1}>{name}</Text>
                        {verified && <Ionicons name="checkmark-circle" size={15} color="#1296f3" />}
                    </View>
                    {!!desc && <Text style={[styles.sub, { color: isDark ? '#666' : '#888' }]} numberOfLines={1}>{desc}</Text>}
                    <Text style={[styles.subCount, { color: isDark ? '#555' : '#aaa' }]}>
                        {formatCount(subCount)} {subCount === 1 ? 'subscriber' : 'subscribers'}
                    </Text>
                </View>
                <Text style={styles.time}>{timeAgo(updatedAt)}</Text>
            </TouchableOpacity>
        );
    };

    // theme-derived
    const sectionTitleColor = isDark ? '#d0d0d0' : '#222';
    const createBtnBg = isDark ? '#0d1e2e' : '#e8f4fd';
    const exploreBtnBg = isDark ? '#1e1e1e' : '#f2f2f2';
    const exploreBtnColor = isDark ? '#888' : '#888';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor="#1296f3" barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('Updates')}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

                {/* Status Section */}
                <StatusSection navigation={navigation} myUserId={MY_USER_ID} />

                {/* Divider */}
                <View style={[styles.divider, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]} />

                {/* My Channels */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>My Channels</Text>
                    <TouchableOpacity style={[styles.createBtn, { backgroundColor: createBtnBg }]} onPress={() => setCreateChannelPopup(true)}>
                        <Ionicons name="add" size={16} color="#1296f3" />
                        <Text style={styles.createBtnText}>Create</Text>
                    </TouchableOpacity>
                </View>

                {loadingMyChannels ? (
                    <ActivityIndicator color="#1296f3" style={{ marginVertical: 16 }} />
                ) : myChannels.length === 0 ? (
                    <EmptyState icon="megaphone-outline" message="Aapne koi channel nahi banaya" isDark={isDark} />
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
                    <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>Subscribed Channels</Text>

                </View>

                {loadingSubscribed ? (
                    <ActivityIndicator color="#1296f3" style={{ marginVertical: 16 }} />
                ) : subscribedChannels.length === 0 ? (
                    <EmptyState icon="people-outline" message="Koi subscribed channel nahi hai" isDark={isDark} />
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
    exploreBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
    exploreBtnText: { fontSize: 13 },

    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,

    },
    avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
    name: { fontSize: 15, fontWeight: '600', flex: 1 },
    sub: { fontSize: 13, marginTop: 1 },
    subCount: { fontSize: 12, marginTop: 2 },
    time: { fontSize: 11, color: '#1296f3', marginLeft: 8 },
});

