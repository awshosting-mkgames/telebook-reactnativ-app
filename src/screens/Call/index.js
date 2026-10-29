import { useCallback, useContext, useState } from 'react';
import {
    ActivityIndicator, FlatList, Image,
    StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import Config from '../../services/config';
import { fetchCallsConfig, getCachedCallsConfig } from '../../services/callConfigStore';
import { startCall } from '../../services/callHelpers';
import { useNameResolver } from '../../services/nameResolver';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const toImageUrl = (v) => (!v ? DEFAULT_AVATAR : /^(https?:|file:|data:)/.test(v) ? v : `${Config.MEDIA_URL}${v}`);

const fmtWhen = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    if (sameDay) return time;
    return `${d.getDate()}/${d.getMonth() + 1}, ${time}`;
};

// Freechat header (38px avatar + 10 top + 14 bottom padding) ke barabar, taaki saare tabs ka header same height ka ho
const HEADER_CONTENT_HEIGHT = 62;

export default function Call({ navigation }) {
    const resolveName = useNameResolver();
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const insets = useSafeAreaInsets();

    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [available, setAvailable] = useState(getCachedCallsConfig()?.available ?? null);

    const fetchCalls = useCallback(async (pageNum = 1) => {
        if (pageNum === 1) setLoading(true);
        try {
            const res = await apiService({ method: 'GET', endpoint: 'calls', params: { page: pageNum, limit: 20 } });
            if (res?.success && res.data?.success !== false) {
                const body = res.data?.data ?? {};
                const rows = body.calls ?? [];
                setCalls((prev) => (pageNum === 1 ? rows : [...prev, ...rows]));
                setPage(pageNum);
                setHasMore((body.pagination?.page ?? pageNum) < (body.pagination?.pages ?? pageNum));
            }
        } catch (e) {
            console.error('fetchCalls:', e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                const cfg = getCachedCallsConfig() ?? (await fetchCallsConfig());
                setAvailable(cfg?.available ?? false);
            })();
            fetchCalls(1);
        }, [fetchCalls])
    );

    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        fetchCalls(page + 1);
    };


    const recall = (item) => {
        if (!item?.user?._id) return;
        startCall({
            navigation,
            calleeId: item.user._id,
            type: item.type,
            remoteUser: { _id: item.user._id, name: resolveName(item.user).title, mobile: item.user.mobile, profilePicture: item.user.profilePicture },
        });
    };

    const renderItem = ({ item }) => {
        const isMissed = !!item.missed;
        const isVideo = item.type === 'video';
        const isOutgoing = item.direction === 'outgoing';

        return (
            <TouchableOpacity style={styles.row} onPress={() => recall(item)} activeOpacity={0.7}>
                <Image source={{ uri: toImageUrl(item.user?.profilePicture) }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: theme.text }, isMissed && styles.missed]} numberOfLines={1}>
                        {resolveName(item.user).title}
                    </Text>
                    {!resolveName(item.user).isSaved && !!resolveName(item.user).subtitle && (
                        <Text style={[styles.time, { fontSize: 11 }]} numberOfLines={1}>{resolveName(item.user).subtitle}</Text>
                    )}
                    <View style={styles.timeRow}>
                        {/* Point 8: incoming = green arrow, outgoing = red arrow, missed = red cross */}
                        <MaterialIcons
                            name={isMissed ? 'call-missed' : isOutgoing ? 'call-made' : 'call-received'}
                            size={16}
                            color={isMissed || isOutgoing ? '#e53935' : '#2e7d32'}
                        />
                        <Text style={[styles.time, { color: isMissed || isOutgoing ? '#e53935' : '#2e7d32' }]}>
                            {' '}{isMissed ? 'Missed' : isOutgoing ? 'Outgoing' : 'Incoming'} ·
                        </Text>
                        <Text style={styles.time}> {fmtWhen(item.startedAt)}</Text>
                        {!isMissed && !!item.durationSeconds && (
                            <Text style={styles.time}> · {Math.floor(item.durationSeconds / 60)}:{(item.durationSeconds % 60).toString().padStart(2, '0')}</Text>
                        )}
                    </View>
                </View>
                <View style={[styles.callBtn, { backgroundColor: isMissed ? '#e53935' : '#2ecc71' }]}>
                    <Ionicons name={isVideo ? 'videocam' : 'call'} size={15} color="#fff" />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            {/* Android 15/16 me edge-to-edge force hai: status bar ke neeche header ko insets.top se hi dhakna padta hai */}
            <View style={[styles.header, { backgroundColor: theme?.header || '#1199ff', height: HEADER_CONTENT_HEIGHT + insets.top, paddingTop: insets.top }]}>
                <Text style={styles.headerTitle}>{t('Calls')}</Text>
            </View>

            {available === false ? (
                <View style={styles.emptyWrap}>
                    <Ionicons name="call-outline" size={56} color="#ccc" />
                    <Text style={styles.emptyTitle}>Calling isn't available right now</Text>
                </View>
            ) : loading ? (
                <ActivityIndicator color="#1296f3" size="large" style={{ flex: 1 }} />
            ) : (
                <FlatList
                    data={calls}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    refreshing={loading}
                    onRefresh={() => fetchCalls(1)}
                    onEndReachedThreshold={0.4}
                    onEndReached={loadMore}
                    ListFooterComponent={loadingMore ? <ActivityIndicator color="#1296f3" style={{ marginVertical: 16 }} /> : null}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Ionicons name="call-outline" size={56} color="#ccc" />
                            <Text style={styles.emptyTitle}>No calls yet</Text>
                            <Text style={styles.emptySub}>Start a voice or video call from any chat</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },

    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: '#ddd' },
    name: { fontSize: 15, fontWeight: '500' },
    missed: { color: '#e53935' },
    timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    time: { fontSize: 11, color: '#666' },
    callBtn: { width: 35, height: 35, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 6 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 10 },
    emptySub: { fontSize: 13, color: '#bbb' },
});
