import { useCallback, useContext, useState } from 'react';
import {
    ActivityIndicator, FlatList, Platform, SafeAreaView,
    StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import { fetchWallet, fetchWalletTransactions } from '../../redex/slices/walletSlice';
import { fetchPaymentConfig, getCachedPaymentConfig, canBuy } from '../../services/paymentConfigStore';
import { handleBuyCoins } from '../../services/paymentActions';

const TABS = [
    { key: 'all', label: 'All' },
    { key: 'credit', label: 'Credit' },
    { key: 'debit', label: 'Debit' },
];

const fmtTalkTime = (secs) => {
    if (!secs) return '0 min';
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
};

const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export default function Wallet({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const dispatch = useDispatch();
    const { wallet, walletLoading, transactions, txLoading, txPagination, txType } = useSelector((s) => s.wallet);

    const [tab, setTab] = useState('all');
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
            dispatch(fetchWallet());
            dispatch(fetchWalletTransactions({ type: 'all', page: 1 }));
            (async () => setPaymentConfig(await fetchPaymentConfig()))();
        }, [dispatch])
    );

    const changeTab = (key) => {
        setTab(key);
        dispatch(fetchWalletTransactions({ type: key, page: 1 }));
    };

    const loadMore = () => {
        if (txLoading || !txPagination) return;
        if (txPagination.page < txPagination.pages && txType === tab) {
            dispatch(fetchWalletTransactions({ type: tab, page: txPagination.page + 1 }));
        }
    };

    const buyActive = canBuy(paymentConfig);
    const packs = wallet?.packs ?? [];

    const renderTxRow = ({ item }) => {
        const isCredit = item.type === 'credit';
        return (
            <View style={[styles.txRow, { borderBottomColor: colors.divider }]}>
                <View style={[styles.txIcon, { backgroundColor: isCredit ? 'rgba(39,174,96,0.12)' : 'rgba(229,57,53,0.12)' }]}>
                    <Ionicons name={isCredit ? 'arrow-down' : 'arrow-up'} size={16} color={isCredit ? '#27ae60' : '#e53935'} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.txDesc, { color: colors.txt }]} numberOfLines={1}>{item.description || item.reason}</Text>
                    <Text style={[styles.txDate, { color: colors.sub }]}>{fmtDate(item.createdAt)} · Balance: {item.balanceAfter}</Text>
                </View>
                <Text style={[styles.txAmount, { color: isCredit ? '#27ae60' : '#e53935' }]}>
                    {isCredit ? '+' : '-'}{item.amount}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar backgroundColor="#0084ff" barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Coin Wallet</Text>
            </View>

            {walletLoading && !wallet ? (
                <ActivityIndicator color="#0084ff" size="large" style={{ flex: 1 }} />
            ) : (
                <FlatList
                    data={transactions}
                    keyExtractor={(item) => item._id}
                    renderItem={renderTxRow}
                    contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                    onEndReachedThreshold={0.5}
                    onEndReached={loadMore}
                    ListFooterComponent={txLoading && transactions.length ? <ActivityIndicator color="#0084ff" style={{ marginVertical: 14 }} /> : null}
                    ListHeaderComponent={
                        <>
                            {/* Balance card */}
                            <View style={[styles.balanceCard, { backgroundColor: colors.card }]}>
                                <View style={styles.balanceRow}>
                                    <Ionicons name="logo-bitcoin" size={28} color="#f39c12" />
                                    <Text style={[styles.balanceValue, { color: colors.txt }]}>{wallet?.balance ?? 0}</Text>
                                    <Text style={[styles.balanceLabel, { color: colors.sub }]}>coins</Text>
                                </View>
                                <View style={styles.talkTimeRow}>
                                    <View style={styles.talkTimeItem}>
                                        <Ionicons name="call-outline" size={14} color={colors.sub} />
                                        <Text style={[styles.talkTimeText, { color: colors.sub }]}>{fmtTalkTime(wallet?.talkTimeSeconds?.audio)} voice</Text>
                                    </View>
                                    <View style={styles.talkTimeItem}>
                                        <Ionicons name="videocam-outline" size={14} color={colors.sub} />
                                        <Text style={[styles.talkTimeText, { color: colors.sub }]}>{fmtTalkTime(wallet?.talkTimeSeconds?.video)} video</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Coin packs */}
                            {!!packs.length && (
                                <>
                                    <Text style={[styles.sectionLabel, { color: colors.sub }]}>TOP UP</Text>
                                    <View style={styles.packsGrid}>
                                        {packs.map((pack) => (
                                            <TouchableOpacity
                                                key={pack.id}
                                                style={[styles.packCard, { backgroundColor: colors.card }]}
                                                onPress={() => handleBuyCoins(pack, paymentConfig)}
                                            >
                                                <Ionicons name="logo-bitcoin" size={22} color="#f39c12" />
                                                <Text style={[styles.packCoins, { color: colors.txt }]}>{pack.coins} coins</Text>
                                                <Text style={[styles.packPrice, { color: colors.sub }]}>₹{pack.price}</Text>
                                                <View style={[styles.packCta, !buyActive && styles.packCtaInfo]}>
                                                    <Text style={buyActive ? styles.packCtaText : styles.packCtaInfoText}>
                                                        {buyActive ? 'Buy' : 'Contact support'}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}

                            <Text style={[styles.sectionLabel, { color: colors.sub, marginTop: 16 }]}>TRANSACTIONS</Text>
                            <View style={styles.tabRow}>
                                {TABS.map((t) => (
                                    <TouchableOpacity
                                        key={t.key}
                                        style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
                                        onPress={() => changeTab(t.key)}
                                    >
                                        <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    }
                    ListEmptyComponent={
                        !txLoading ? <Text style={{ color: colors.sub, textAlign: 'center', marginTop: 24 }}>No transactions yet</Text> : null
                    }
                />
            )}
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

    balanceCard: { borderRadius: 16, padding: 18, marginBottom: 16 },
    balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    balanceValue: { fontSize: 28, fontWeight: '800' },
    balanceLabel: { fontSize: 14, marginLeft: 2 },
    talkTimeRow: { flexDirection: 'row', gap: 18, marginTop: 10 },
    talkTimeItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    talkTimeText: { fontSize: 12 },

    sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginBottom: 10 },
    packsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    packCard: { width: '31%', borderRadius: 14, padding: 10, alignItems: 'center', marginBottom: 10 },
    packCoins: { fontSize: 13, fontWeight: '700', marginTop: 6 },
    packPrice: { fontSize: 12, marginTop: 2, marginBottom: 8 },
    packCta: { backgroundColor: '#0084ff', paddingVertical: 6, borderRadius: 10, width: '100%', alignItems: 'center' },
    packCtaText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    packCtaInfo: { backgroundColor: 'rgba(0,132,255,0.1)' },
    packCtaInfoText: { color: '#0084ff', fontSize: 10, fontWeight: '700' },

    tabRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    tabBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(0,132,255,0.08)' },
    tabBtnActive: { backgroundColor: '#0084ff' },
    tabText: { fontSize: 13, fontWeight: '600', color: '#0084ff' },
    tabTextActive: { color: '#fff' },

    txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
    txIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    txDesc: { fontSize: 14, fontWeight: '600' },
    txDate: { fontSize: 11, marginTop: 2 },
    txAmount: { fontSize: 14, fontWeight: '700' },
});
