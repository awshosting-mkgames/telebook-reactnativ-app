import { useCallback, useContext, useState } from 'react';
import {
    ActivityIndicator, FlatList, Modal, Platform, Pressable, RefreshControl,
    SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import { fetchMyPlan, fetchPlanHistory } from '../../redex/slices/plansSlice';

const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

export default function PlanHistory({ navigation }) {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const dispatch = useDispatch();
    const { me, history, historyLoading, historyError, historyPagination, historyCurrent } = useSelector((s) => s.plans);

    const [refreshing, setRefreshing] = useState(false);
    const [detail, setDetail] = useState(null);

    const isDark = theme?.mode === 'dark';
    const headerBg = theme?.header || '#1199ff';
    const colors = {
        bg: isDark ? '#121212' : '#f2f4f7',
        card: isDark ? '#1e1e1e' : '#ffffff',
        txt: isDark ? '#f0f0f0' : '#1a1a1a',
        sub: isDark ? '#9a9a9a' : '#8a8f98',
        divider: isDark ? '#2a2a2a' : '#eceef1',
        accent: headerBg,
        ok: '#27ae60',
        bad: '#e74c3c',
    };

    const load = useCallback(() => {
        dispatch(fetchMyPlan());
        return dispatch(fetchPlanHistory({ page: 1 }));
    }, [dispatch]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const onRefresh = async () => {
        setRefreshing(true);
        try { await load(); } finally { setRefreshing(false); }
    };

    const loadMore = () => {
        const p = historyPagination;
        if (historyLoading || !p || p.page >= p.pages) return;
        dispatch(fetchPlanHistory({ page: p.page + 1 }));
    };

    const ent = me?.entitlements;
    const isActive = !!ent?.isActive;
    // Active wala top card mein hai — "Previous" list mein sirf purane
    const previous = (history || []).filter((h) => h.status !== 'active');
    const topPlan = ent?.planName || historyCurrent?.planName;
    const badgeLabel = ent?.badge?.label || historyCurrent?.badgeLabel;
    const badgeColor = ent?.badge?.color || headerBg;
    const startAt = ent?.startAt || historyCurrent?.startAt;
    const endAt = ent?.endAt || historyCurrent?.endAt;

    const statusColor = (st) => (st === 'active' ? colors.ok : st === 'superseded' ? colors.accent : colors.sub);

    const renderTop = () => (
        <>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
                <Text style={[styles.label, { color: colors.sub }]}>{t('ph_current_plan')}</Text>
                <View style={styles.rowWrap}>
                    <Text style={[styles.planName, { color: colors.txt }]}>{topPlan || t('ph_free')}</Text>
                    {!!badgeLabel && (
                        <View style={[styles.pill, { backgroundColor: badgeColor }]}>
                            <Text style={styles.pillText}>{badgeLabel}</Text>
                        </View>
                    )}
                    <View style={[styles.chip, { borderColor: isActive ? colors.ok : colors.sub }]}>
                        <Text style={{ color: isActive ? colors.ok : colors.sub, fontSize: 11, fontWeight: '700' }}>
                            {isActive ? t('ph_active') : t('ph_expired')}
                        </Text>
                    </View>
                </View>

                {!!(startAt || endAt) && (
                    <View style={styles.datesRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.sub }]}>{t('ph_start')}</Text>
                            <Text style={[styles.value, { color: colors.txt }]}>{fmtDate(startAt)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.sub }]}>{t('ph_expiry')}</Text>
                            <Text style={[styles.value, { color: colors.txt }]}>{fmtDate(endAt)}</Text>
                        </View>
                    </View>
                )}

                <View style={[styles.daysBox, { borderColor: colors.divider }]}>
                    <Text style={[styles.label, { color: colors.sub, marginBottom: 0 }]}>{t('ph_days_remaining')}</Text>
                    {/* Server ka daysRemaining (expiry din par 0); inactive ho to 'Expired' */}
                    <Text style={[styles.daysValue, { color: isActive ? colors.txt : colors.bad }]}>
                        {isActive ? (ent?.daysRemaining ?? 0) : t('ph_expired')}
                    </Text>
                </View>

                <TouchableOpacity style={[styles.cta, { backgroundColor: colors.accent }]} onPress={() => navigation.navigate('Plans')} activeOpacity={0.8}>
                    <Text style={styles.ctaText}>{isActive ? t('ph_renew') : t('ph_upgrade')}</Text>
                </TouchableOpacity>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.sub }]}>{t('ph_previous').toUpperCase()}</Text>
        </>
    );

    const renderItem = ({ item }) => (
        <TouchableOpacity style={[styles.histRow, { backgroundColor: colors.card }]} onPress={() => setDetail(item)} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.histPlan, { color: colors.txt }]}>{item.planName}</Text>
                <Text style={[styles.histSub, { color: colors.sub }]}>{fmtDate(item.startAt)} – {fmtDate(item.endAt)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.histStatus, { color: statusColor(item.status) }]}>{item.statusLabel || item.status}</Text>
                {item.price != null && <Text style={[styles.histSub, { color: colors.sub }]}>{item.currency} {item.price}</Text>}
            </View>
        </TouchableOpacity>
    );

    const DetailRow = ({ label, value }) => (
        <View style={[styles.detailRow, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.detailLabel, { color: colors.sub }]}>{label}</Text>
            <Text style={[styles.detailValue, { color: colors.txt }]} selectable>{value || '—'}</Text>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar backgroundColor={headerBg} barStyle="light-content" />
            <View style={[styles.header, { backgroundColor: headerBg }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('ph_title')}</Text>
            </View>

            {historyLoading && !history.length && !me ? (
                <ActivityIndicator color={colors.accent} size="large" style={{ flex: 1 }} />
            ) : (
                <FlatList
                    data={previous}
                    keyExtractor={(item) => String(item._id)}
                    renderItem={renderItem}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                    contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                    ListHeaderComponent={renderTop}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
                    onEndReachedThreshold={0.5}
                    onEndReached={loadMore}
                    ListFooterComponent={historyLoading && history.length ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 14 }} /> : null}
                    ListEmptyComponent={
                        historyLoading ? null : historyError ? (
                            <View style={{ alignItems: 'center', marginTop: 20 }}>
                                <Text style={{ color: colors.bad, textAlign: 'center' }}>{t('ph_load_error')}</Text>
                                <TouchableOpacity onPress={load} style={{ marginTop: 10 }}>
                                    <Text style={{ color: colors.accent, fontWeight: '700' }}>{t('ph_retry')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <Text style={{ color: colors.sub, textAlign: 'center', marginTop: 20 }}>{t('ph_empty')}</Text>
                        )
                    }
                />
            )}

            {/* Receipt / detail sheet */}
            <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
                <Pressable style={styles.overlay} onPress={() => setDetail(null)}>
                    <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => { }}>
                        <View style={styles.sheetHandle} />
                        <Text style={[styles.sheetTitle, { color: colors.txt }]}>{t('ph_receipt')}</Text>
                        {!!detail && (
                            <>
                                <DetailRow label={t('ph_plan')} value={detail.planName} />
                                <DetailRow label={t('ph_period')} value={`${fmtDate(detail.startAt)} – ${fmtDate(detail.endAt)}`} />
                                <DetailRow label={t('ph_duration')} value={detail.durationDays ? t('ph_days', { n: detail.durationDays }) : ''} />
                                <DetailRow label={t('ph_status')} value={detail.statusLabel || detail.status} />
                                <DetailRow label={t('ph_amount')} value={detail.price != null ? `${detail.currency || ''} ${detail.price}` : ''} />
                                <DetailRow label={t('ph_source')} value={detail.source} />
                                <DetailRow label={t('ph_payment_ref')} value={detail.paymentReference} />
                                {!!detail.note && <DetailRow label={t('ph_note')} value={detail.note} />}
                            </>
                        )}
                        <TouchableOpacity style={[styles.cta, { backgroundColor: colors.accent }]} onPress={() => setDetail(null)}>
                            <Text style={styles.ctaText}>{t('ph_close')}</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 18,
        paddingHorizontal: 16, paddingBottom: 14,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    card: { borderRadius: 16, padding: 16, marginBottom: 14 },
    label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
    rowWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    planName: { fontSize: 20, fontWeight: '700' },
    pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    pillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
    datesRow: { flexDirection: 'row', marginTop: 14 },
    value: { fontSize: 14, fontWeight: '600' },
    daysBox: { marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    daysValue: { fontSize: 26, fontWeight: '800' },
    cta: { marginTop: 14, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    ctaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginBottom: 10 },
    histRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14 },
    histPlan: { fontSize: 15, fontWeight: '600' },
    histSub: { fontSize: 12, marginTop: 2 },
    histStatus: { fontSize: 12, fontWeight: '700' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30 },
    sheetHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
    sheetTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
    detailLabel: { fontSize: 13 },
    detailValue: { fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
