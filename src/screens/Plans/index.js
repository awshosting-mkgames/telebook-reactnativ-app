import { useCallback, useContext, useState } from 'react';
import {
    ActivityIndicator, FlatList, Modal, Platform, Pressable,
    SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import { fetchPlans, fetchMyPlan, fetchPlanHistory } from '../../redex/slices/plansSlice';
import { fetchPaymentConfig, getCachedPaymentConfig, canBuy } from '../../services/paymentConfigStore';
import { handleBuyPlan } from '../../services/paymentActions';

const USAGE_LABELS = {
    devices: 'Linked devices',
    pins: 'Pinned chats',
    groups: 'Groups',
    broadcasts: 'Broadcast lists',
    broadcastRecipients: 'Broadcast recipients',
    themes: 'Premium themes',
    stickerPacks: 'Sticker packs',
    autoReply: 'Auto Reply',
};

const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export default function Plans({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const dispatch = useDispatch();
    const plansState = useSelector((s) => s.plans);
    const { plans, plansLoading, me, meLoading, history, historyLoading, historyPagination } = plansState;

    const [showHistory, setShowHistory] = useState(false);
    const [paymentConfig, setPaymentConfig] = useState(getCachedPaymentConfig());

    const isDark = theme?.mode === 'dark';
    const colors = {
        bg: isDark ? '#121212' : '#f2f4f7',
        card: isDark ? '#1e1e1e' : '#ffffff',
        txt: isDark ? '#f0f0f0' : '#1a1a1a',
        sub: isDark ? '#9a9a9a' : '#8a8f98',
        divider: isDark ? '#2a2a2a' : '#eceef1',
    };

    useFocusEffect(
        useCallback(() => {
            dispatch(fetchPlans());
            dispatch(fetchMyPlan());
            (async () => setPaymentConfig(await fetchPaymentConfig()))();
        }, [dispatch])
    );

    const entitlements = me?.entitlements;
    const usage = me?.usage || {};
    const isActivePlan = !!entitlements?.isActive;

    const renderUsageRow = (key, entry) => {
        const label = USAGE_LABELS[key] || key;
        if (entry && typeof entry.allowed === 'boolean') {
            return (
                <View key={key} style={styles.usageRow}>
                    <Text style={[styles.usageLabel, { color: colors.txt }]}>{label}</Text>
                    <Text style={{ color: entry.allowed ? '#27ae60' : '#999', fontSize: 12, fontWeight: '600' }}>
                        {entry.allowed ? 'Available' : 'Not available'}
                    </Text>
                </View>
            );
        }
        const isUnlimited = entry?.limit === 'unlimited';
        const used = entry?.used ?? 0;
        const limitNum = isUnlimited ? null : Number(entry?.limit ?? 0);
        const pct = isUnlimited || !limitNum ? 0 : Math.min(100, (used / limitNum) * 100);
        return (
            <View key={key} style={styles.usageRow}>
                <View style={styles.usageTop}>
                    <Text style={[styles.usageLabel, { color: colors.txt }]}>{label}</Text>
                    <Text style={[styles.usageValue, { color: colors.sub }]}>
                        {isUnlimited ? `${used} / Unlimited` : `${used} / ${entry?.limit ?? 0}`}
                    </Text>
                </View>
                {!isUnlimited && (
                    <View style={styles.usageBarBg}>
                        <View style={[styles.usageBarFill, { width: `${pct}%` }]} />
                    </View>
                )}
            </View>
        );
    };

    const onBuyPlan = (plan) => handleBuyPlan(plan, paymentConfig);
    const buyActive = canBuy(paymentConfig);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar backgroundColor="#0084ff" barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Plans & Subscription</Text>
            </View>

            {(plansLoading || meLoading) && !plans.length ? (
                <ActivityIndicator color="#0084ff" size="large" style={{ flex: 1 }} />
            ) : (
                <FlatList
                    data={plans}
                    keyExtractor={(item) => item.code}
                    contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                    ListHeaderComponent={
                        <>
                            {/* Current plan card */}
                            <View style={[styles.currentCard, { backgroundColor: colors.card }]}>
                                {isActivePlan ? (
                                    <>
                                        <View style={styles.currentTop}>
                                            <Text style={[styles.currentPlanName, { color: colors.txt }]}>{entitlements.planName}</Text>
                                            {!!entitlements.badge?.label && (
                                                <View style={[styles.badgePill, { backgroundColor: entitlements.badge.color || '#0084ff' }]}>
                                                    <Text style={styles.badgePillText}>{entitlements.badge.label}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={[styles.currentSub, { color: colors.sub }]}>
                                            {entitlements.daysRemaining != null ? `${entitlements.daysRemaining} days remaining` : 'Active'}
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Text style={[styles.currentPlanName, { color: colors.txt }]}>Free plan</Text>
                                        <Text style={[styles.currentSub, { color: colors.sub }]}>Upgrade to unlock more</Text>
                                    </>
                                )}

                                <TouchableOpacity style={styles.historyLink} onPress={() => { setShowHistory(true); dispatch(fetchPlanHistory({ page: 1 })); }}>
                                    <Text style={styles.historyLinkText}>View plan history</Text>
                                    <Ionicons name="chevron-forward" size={14} color="#0084ff" />
                                </TouchableOpacity>
                            </View>

                            {/* Usage */}
                            {!!Object.keys(usage).length && (
                                <View style={[styles.card, { backgroundColor: colors.card }]}>
                                    <Text style={[styles.sectionLabel, { color: colors.sub }]}>USAGE</Text>
                                    {Object.entries(usage).map(([key, entry]) => renderUsageRow(key, entry))}
                                </View>
                            )}

                            <Text style={[styles.sectionLabel, { color: colors.sub, marginTop: 12 }]}>AVAILABLE PLANS</Text>
                        </>
                    }
                    renderItem={({ item: plan }) => {
                        const isCurrent = isActivePlan && entitlements?.planCode === plan.code;
                        return (
                            <View style={[styles.planCard, { backgroundColor: colors.card }]}>
                                <View style={styles.planTop}>
                                    <Text style={[styles.planName, { color: colors.txt }]}>{plan.name}</Text>
                                    {!!plan.badge?.label && (
                                        <View style={[styles.badgePill, { backgroundColor: plan.badge.color || '#0084ff' }]}>
                                            <Text style={styles.badgePillText}>{plan.badge.label}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.planDesc, { color: colors.sub }]}>{plan.description}</Text>
                                <Text style={[styles.planPrice, { color: colors.txt }]}>
                                    {plan.currency} {plan.price} <Text style={{ fontSize: 12, color: colors.sub }}>/ {plan.durationDays} days</Text>
                                </Text>
                                {(plan.highlights || []).map((h, i) => (
                                    <View key={i} style={styles.highlightRow}>
                                        <Ionicons name="checkmark-circle" size={14} color="#27ae60" />
                                        <Text style={[styles.highlightText, { color: colors.txt }]}>{h}</Text>
                                    </View>
                                ))}
                                {isCurrent ? (
                                    <View style={[styles.ctaBtn, styles.ctaCurrent]}>
                                        <Text style={styles.ctaCurrentText}>Current plan</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.ctaBtn, !buyActive && styles.ctaInfo]}
                                        onPress={() => onBuyPlan(plan)}
                                    >
                                        <Text style={buyActive ? styles.ctaText : styles.ctaInfoText}>
                                            {buyActive ? 'Upgrade' : 'Contact support'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    }}
                />
            )}

            {/* History sheet */}
            <Modal visible={showHistory} transparent animationType="slide" onRequestClose={() => setShowHistory(false)}>
                <Pressable style={styles.overlay} onPress={() => setShowHistory(false)}>
                    <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.sheetHandle} />
                        <Text style={[styles.sheetTitle, { color: colors.txt }]}>Plan History</Text>
                        {historyLoading && !history.length ? (
                            <ActivityIndicator color="#0084ff" style={{ marginVertical: 24 }} />
                        ) : (
                            <FlatList
                                data={history}
                                keyExtractor={(item) => item._id}
                                style={{ maxHeight: 420 }}
                                onEndReachedThreshold={0.5}
                                onEndReached={() => {
                                    const p = historyPagination;
                                    if (p && p.page < p.pages) dispatch(fetchPlanHistory({ page: p.page + 1 }));
                                }}
                                renderItem={({ item }) => (
                                    <View style={[styles.historyRow, { borderBottomColor: colors.divider }]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.historyPlan, { color: colors.txt }]}>{item.planName}</Text>
                                            <Text style={[styles.historySub, { color: colors.sub }]}>
                                                {fmtDate(item.startAt)} – {fmtDate(item.endAt)} · {item.source}
                                            </Text>
                                        </View>
                                        <Text style={[styles.historyStatus, { color: item.status === 'active' ? '#27ae60' : colors.sub }]}>{item.status}</Text>
                                    </View>
                                )}
                                ListEmptyComponent={<Text style={{ color: colors.sub, textAlign: 'center', marginVertical: 20 }}>No plan history yet</Text>}
                            />
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
        backgroundColor: '#0084ff', flexDirection: 'row', alignItems: 'center', gap: 18,
        paddingHorizontal: 16, paddingBottom: 14,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

    currentCard: { borderRadius: 16, padding: 16, marginBottom: 14 },
    currentTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    currentPlanName: { fontSize: 18, fontWeight: '700' },
    currentSub: { fontSize: 13, marginTop: 4 },
    historyLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
    historyLinkText: { color: '#0084ff', fontSize: 13, fontWeight: '600' },

    badgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    badgePillText: { color: '#fff', fontSize: 11, fontWeight: '700' },

    card: { borderRadius: 16, padding: 16, marginBottom: 14 },
    sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginBottom: 10 },

    usageRow: { marginBottom: 12 },
    usageTop: { flexDirection: 'row', justifyContent: 'space-between' },
    usageLabel: { fontSize: 13, fontWeight: '500' },
    usageValue: { fontSize: 12 },
    usageBarBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,132,255,0.12)', marginTop: 6, overflow: 'hidden' },
    usageBarFill: { height: 6, backgroundColor: '#0084ff', borderRadius: 3 },

    planCard: { borderRadius: 16, padding: 16, marginBottom: 14 },
    planTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    planName: { fontSize: 17, fontWeight: '700' },
    planDesc: { fontSize: 13, marginTop: 4, marginBottom: 8 },
    planPrice: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
    highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    highlightText: { fontSize: 13 },

    ctaBtn: { marginTop: 10, backgroundColor: '#0084ff', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    ctaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    ctaInfo: { backgroundColor: 'rgba(0,132,255,0.1)' },
    ctaInfoText: { color: '#0084ff', fontSize: 14, fontWeight: '700' },
    ctaCurrent: { backgroundColor: 'rgba(39,174,96,0.12)' },
    ctaCurrentText: { color: '#27ae60', fontSize: 14, fontWeight: '700' },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30, maxHeight: '80%' },
    sheetHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
    sheetTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 16 },

    historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    historyPlan: { fontSize: 14, fontWeight: '600' },
    historySub: { fontSize: 12, marginTop: 2 },
    historyStatus: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});
