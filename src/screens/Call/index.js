import { useCallback, useContext, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, BackHandler, FlatList, Image, Modal, Pressable,
    StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderMetrics } from '../../utils/headerMetrics';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import Config from '../../services/config';
import { fetchCallsConfig, getCachedCallsConfig } from '../../services/callConfigStore';
import { startCall } from '../../services/callHelpers';
import { deleteCallsLocal, loadCalls, upsertCalls } from '../../services/callsDb';
import { useNameResolver } from '../../services/nameResolver';
import GradientFill from '../../components/GradientFill';
import CallDetailsSheet from './CallDetailsSheet';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'missed', label: 'Missed' },
    { key: 'incoming', label: 'Incoming' },
    { key: 'outgoing', label: 'Outgoing' },
    { key: 'audio', label: 'Audio' },
    { key: 'video', label: 'Video' },
];

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

export default function Call({ navigation }) {
    const resolveName = useNameResolver();
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const { top, height } = useHeaderMetrics(); // status bar + 60 header

    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [filter, setFilter] = useState('all');
    const filterRef = useRef('all');
    const [detailCall, setDetailCall] = useState(null);
    const [available, setAvailable] = useState(getCachedCallsConfig()?.available ?? null);

    // Call history delete: long press -> select mode, Select all, Delete; 3-dots -> Select / Clear call history
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState(() => new Set());
    const [menuOpen, setMenuOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const exitSelect = useCallback(() => { setSelectMode(false); setSelected(new Set()); }, []);
    const toggleSelect = (id) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        if (next.size === 0) setSelectMode(false);
        return next;
    });
    const allSelected = calls.length > 0 && selected.size === calls.length;
    const selectAll = () => setSelected(allSelected ? new Set() : new Set(calls.map((c) => c._id)));

    useFocusEffect(useCallback(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (selectMode) { exitSelect(); return true; }
            return false;
        });
        return () => sub.remove();
    }, [selectMode, exitSelect]));

    const runDelete = async (payload, removeLocal) => {
        setDeleting(true);
        const res = await apiService({ method: 'DELETE', endpoint: 'calls/history', data: payload });
        setDeleting(false);
        if (res?.success && res.data?.success !== false) {
            setCalls((prev) => prev.filter((c) => !removeLocal(c)));
            deleteCallsLocal(payload.all ? null : payload.ids).catch(() => {});
            exitSelect();
            if (payload.all) { setHasMore(false); fetchCalls(1); }
        } else {
            Alert.alert('Error', res?.error?.message || 'Could not delete call history. Please try again.');
        }
    };
    const deleteSelected = () => {
        if (!selected.size) return;
        const ids = [...selected];
        Alert.alert('Delete call history', `Delete ${ids.length} selected call${ids.length > 1 ? 's' : ''}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => runDelete(allSelected && !hasMore ? { all: true } : { ids }, (c) => selected.has(c._id)) },
        ]);
    };
    const clearAll = () => {
        setMenuOpen(false);
        Alert.alert('Clear call history', 'Delete all your call history? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear all', style: 'destructive', onPress: () => runDelete({ all: true }, () => true) },
        ]);
    };

    // SQL pehle (turant, offline me bhi) → API → SQL → UI
    const fetchCalls = useCallback(async (pageNum = 1) => {
        const f = filterRef.current;
        if (pageNum === 1) {
            const cached = await loadCalls(f);
            if (cached.length) { setCalls(cached); setLoading(false); }
        }
        try {
            const res = await apiService({ method: 'GET', endpoint: 'calls', params: { page: pageNum, limit: 20, filter: f } });
            if (res?.success && res.data?.success !== false) {
                const body = res.data?.data ?? {};
                const rows = body.calls ?? [];
                const more = (body.pagination?.page ?? pageNum) < (body.pagination?.pages ?? pageNum);
                // Reconcile sirf unfiltered page 1 par (filtered list poori history nahi hoti)
                await upsertCalls(rows, { reconcile: pageNum === 1 && f === 'all', hasMore: more });
                setCalls((prev) => (pageNum === 1 ? rows : [...prev, ...rows.filter((r) => !prev.some((p) => p._id === r._id))]));
                setPage(pageNum);
                setHasMore(more);
            }
            // API fail (offline) → jo cache dikh raha hai wahi rehne do
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

    const changeFilter = (key) => {
        if (key === filterRef.current) return;
        filterRef.current = key;
        setFilter(key);
        exitSelect();
        setCalls([]);
        fetchCalls(1);
    };

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
            <TouchableOpacity
                style={[styles.row, selectMode && selected.has(item._id) && { backgroundColor: 'rgba(18,150,243,0.12)' }]}
                onPress={() => (selectMode ? toggleSelect(item._id) : setDetailCall(item))}
                onLongPress={() => { if (!selectMode) { setSelectMode(true); setSelected(new Set([item._id])); } else toggleSelect(item._id); }}
                delayLongPress={300}
                activeOpacity={0.7}
            >
                {selectMode && (
                    <Ionicons
                        name={selected.has(item._id) ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={selected.has(item._id) ? theme.main : '#9aa0a6'}
                        style={{ marginRight: 10 }}
                    />
                )}
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
                {!selectMode && (
                    <TouchableOpacity hitSlop={8} onPress={() => recall(item)} style={[styles.callBtn, { backgroundColor: isMissed ? '#e53935' : '#2ecc71' }]}>
                        <Ionicons name={isVideo ? 'videocam' : 'call'} size={15} color="#fff" />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            {/* Android 15/16 me edge-to-edge force hai: status bar ke neeche header ko insets.top se hi dhakna padta hai */}
            <View style={[styles.header, { backgroundColor: theme?.header || '#1199ff', height, paddingTop: top, paddingBottom: 0, overflow: 'hidden' }]}>
                <GradientFill />
                {selectMode ? (
                    <>
                        <TouchableOpacity onPress={exitSelect} hitSlop={10} style={styles.hdrBtn}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { flex: 1 }]}>{selected.size} selected</Text>
                        <TouchableOpacity onPress={selectAll} hitSlop={10} style={styles.hdrBtn}>
                            <Ionicons name={allSelected ? 'checkmark-done-circle' : 'checkmark-done-outline'} size={24} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={deleteSelected} hitSlop={10} style={styles.hdrBtn} disabled={deleting || !selected.size}>
                            {deleting ? <ActivityIndicator color="#fff" /> : <Ionicons name="trash-outline" size={23} color="#fff" />}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={[styles.headerTitle, { flex: 1 }]}>{t('Calls')}</Text>
                        {calls.length > 0 && (
                            <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={10} style={styles.hdrBtn}>
                                <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>

            <Modal statusBarTranslucent visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
                <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
                    <View style={[styles.menuBox, { backgroundColor: theme?.mode === 'dark' ? '#1f2c34' : '#fff', top: height - 8 }]}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuOpen(false); setSelectMode(true); setSelected(new Set()); }}>
                            <Ionicons name="checkmark-circle-outline" size={18} color={theme.main} />
                            <Text style={[styles.menuText, { color: theme.text }]}>Select calls</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={clearAll}>
                            <Ionicons name="trash-outline" size={18} color="#e74c3c" />
                            <Text style={[styles.menuText, { color: '#e74c3c' }]}>Clear call history</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {available !== false && (
                <View style={styles.filterBar}>
                    <FlatList
                        horizontal
                        data={FILTERS}
                        keyExtractor={(f) => f.key}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
                        renderItem={({ item: f }) => {
                            const on = filter === f.key;
                            return (
                                <TouchableOpacity
                                    onPress={() => changeFilter(f.key)}
                                    activeOpacity={0.7}
                                    style={[styles.filterChip, on
                                        ? { backgroundColor: theme.main, borderColor: theme.main }
                                        : { borderColor: theme?.mode === 'dark' ? '#3a474f' : '#d5d9dd' }]}
                                >
                                    <Text style={[styles.filterText, { color: on ? '#fff' : theme.text }]}>{f.label}</Text>
                                </TouchableOpacity>
                            );
                        }}
                    />
                </View>
            )}

            {available === false ? (
                <View style={styles.emptyWrap}>
                    <Ionicons name="call-outline" size={56} color="#ccc" />
                    <Text style={styles.emptyTitle}>Calling isn't available right now</Text>
                </View>
            ) : loading ? (
                <ActivityIndicator color={theme.main} size="large" style={{ flex: 1 }} />
            ) : (
                <FlatList
                    data={calls}
                    keyExtractor={(item) => item._id}
                    extraData={[selectMode, selected]}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    refreshing={loading}
                    onRefresh={() => fetchCalls(1)}
                    onEndReachedThreshold={0.4}
                    onEndReached={loadMore}
                    ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.main} style={{ marginVertical: 16 }} /> : null}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Ionicons name="call-outline" size={56} color="#ccc" />
                            <Text style={styles.emptyTitle}>{filter === 'all' ? 'No calls yet' : 'No calls in this list'}</Text>
                            <Text style={styles.emptySub}>{filter === 'all' ? 'Start a voice or video call from any chat' : 'Try another filter'}</Text>
                        </View>
                    }
                />
            )}
            {!!detailCall && <CallDetailsSheet call={detailCall} onClose={() => setDetailCall(null)} navigation={navigation} />}
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
    hdrBtn: { paddingHorizontal: 8, paddingVertical: 6 },
    filterBar: { paddingVertical: 8 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
    filterText: { fontSize: 13, fontWeight: '500' },
    menuOverlay: { flex: 1 },
    menuBox: { position: 'absolute', right: 10, borderRadius: 12, paddingVertical: 6, minWidth: 190, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    menuText: { fontSize: 15, fontWeight: '500' },

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
