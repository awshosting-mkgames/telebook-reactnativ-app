import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import Config from '../../services/config';

const mediaUrl = (path) => {
    if (!path) return null;
    return path.startsWith('http') ? path : `${Config.MEDIA_URL}${path}`;
};

const formatCount = (n = 0) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

const ChannelAvatar = ({ uri, isDark }) => {
    const [failed, setFailed] = useState(false);
    if (!uri || failed) {
        return (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: isDark ? '#1a2a3a' : '#e8f4fd' }]}>
                <Ionicons name="megaphone" size={20} color="#1296f3" />
            </View>
        );
    }
    return <Image source={{ uri }} style={styles.avatar} onError={() => setFailed(true)} />;
};

// Sponsored + popular channel recommendations — "Status" aur "Viewed Status"
// ke neeche, Updates screen par. Backend `channels/recommended` sponsored
// pehle (boost-eligible, sabse upar) aur uske baad subscriber-count ke
// hisaab se top-5 "popular" deta hai, dono me subscribed/owned channels
// already exclude hote hain.
const RecommendedChannels = ({ navigation, refreshSignal = 0 }) => {
    const { theme } = useContext(ThemeContext);
    const isDark = theme.text === '#FFFFFF';

    const [sponsored, setSponsored] = useState([]);
    const [popular, setPopular] = useState([]);
    const [loading, setLoading] = useState(true);
    const [subscribingId, setSubscribingId] = useState(null);

    const fetchRecommended = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiService({ method: 'GET', endpoint: 'channels/recommended' });
            if (res?.success) {
                setSponsored(res.data?.data?.sponsored ?? []);
                setPopular(res.data?.data?.popular ?? []);
            }
        } catch (e) {
            console.error('Recommended channels error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRecommended(); }, [fetchRecommended]);

    useFocusEffect(useCallback(() => { fetchRecommended(); }, [fetchRecommended]));

    useEffect(() => {
        if (refreshSignal) fetchRecommended();
    }, [refreshSignal, fetchRecommended]);

    const handleSubscribe = async (item) => {
        const id = item?._id;
        if (!id || subscribingId) return;
        setSubscribingId(id);
        try {
            const res = await apiService({ method: 'PUT', endpoint: `channels/${id}/subscribe`, data: {} });
            if (res?.success) {
                // Subscribe hone ke baad yeh channel ab eligible nahi — list se hata do,
                // pura refetch karne ki zaroorat nahi.
                setSponsored((prev) => prev.filter((c) => c._id !== id));
                setPopular((prev) => prev.filter((c) => c._id !== id));
            } else {
                Alert.alert('Error', res?.error?.message || 'Could not subscribe, please try again');
            }
        } catch (e) {
            console.error('Subscribe error:', e);
            Alert.alert('Error', 'Could not subscribe, please try again');
        } finally {
            setSubscribingId(null);
        }
    };

    const renderRow = (item) => {
        const id = item?._id;
        const name = item?.channelName || 'Channel';
        const imageUri = mediaUrl(item?.channelIcon);
        const desc = item?.channelDescription || '';
        const isSubscribing = subscribingId === id;

        return (
            <View key={id} style={[styles.row, { borderBottomColor: isDark ? '#1e1e1e' : '#f1f1f1' }]}>
                <TouchableOpacity
                    style={styles.left}
                    activeOpacity={0.75}
                    onPress={() => navigation.navigate('Channeldetailscreen', { channelId: id })}
                >
                    <ChannelAvatar uri={imageUri} isDark={isDark} />
                    <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                            {item?.verified && <Ionicons name="checkmark-circle" size={14} color="#1296f3" />}
                        </View>
                        {!!desc && (
                            <Text style={[styles.desc, { color: isDark ? '#777' : '#777' }]} numberOfLines={1}>{desc}</Text>
                        )}
                        <Text style={[styles.subCount, { color: isDark ? '#555' : '#9aa5ad' }]} numberOfLines={1}>
                            {formatCount(item?.subscriberCount ?? 0)} {item?.subscriberCount === 1 ? 'subscriber' : 'subscribers'}
                        </Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.subscribeBtn}
                    onPress={() => handleSubscribe(item)}
                    disabled={!!subscribingId}
                    activeOpacity={0.8}
                >
                    {isSubscribing ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.subscribeText}>Subscribe</Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    if (!loading && sponsored.length === 0 && popular.length === 0) return null;

    return (
        <View style={{ backgroundColor: theme.background }}>
            <View style={[styles.divider, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]} />

            {loading ? (
                <ActivityIndicator color="#1296f3" style={{ marginVertical: 20 }} />
            ) : (
                <>
                    {sponsored.length > 0 && (
                        <>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.sectionTitle, { color: isDark ? '#d0d0d0' : '#222' }]}>Sponsored</Text>
                            </View>
                            {sponsored.map(renderRow)}
                        </>
                    )}

                    {popular.length > 0 && (
                        <>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.sectionTitle, { color: isDark ? '#d0d0d0' : '#222' }]}>Popular Channels</Text>
                            </View>
                            {popular.map(renderRow)}
                        </>
                    )}

                    <TouchableOpacity
                        style={[styles.moreBtn, { backgroundColor: isDark ? '#0d1e2e' : '#e8f4fd' }]}
                        onPress={() => navigation.navigate('Channels')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.moreBtnText}>More Channels</Text>
                        <Ionicons name="chevron-forward" size={15} color="#1296f3" />
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    divider: { height: 1, marginVertical: 4 },
    sectionHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '600' },

    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: 0.5, gap: 10,
    },
    left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    name: { fontSize: 14, fontWeight: '600', flex: 1 },
    desc: { fontSize: 12, marginTop: 1 },
    subCount: { fontSize: 11, marginTop: 2 },

    subscribeBtn: {
        backgroundColor: '#1296f3', paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 18, minWidth: 92, alignItems: 'center', justifyContent: 'center',
    },
    subscribeText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    moreBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        marginHorizontal: 16, marginTop: 10, paddingVertical: 10, borderRadius: 18,
    },
    moreBtnText: { color: '#1296f3', fontSize: 13, fontWeight: '700' },
});

export default RecommendedChannels;
