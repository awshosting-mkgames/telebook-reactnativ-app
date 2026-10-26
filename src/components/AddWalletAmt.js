import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeContext } from './ThemeContext';
import { fetchWallet } from '../redex/slices/walletSlice';
import { canBuy, fetchPaymentConfig, getCachedPaymentConfig } from '../services/paymentConfigStore';
import { handleBuyCoins } from '../services/paymentActions';

// Coin pack chuno → Razorpay payment page (amount server se) → wallet me coins.
// Paisa safal hone par onPaid() chalta hai (jaise group create dobara try karna).
const AddWalletAmt = ({ visible, onClose, onPaid, title = 'Add coins to wallet', message }) => {
    const { theme } = useContext(ThemeContext);
    const dispatch = useDispatch();
    const wallet = useSelector((s) => s.wallet.wallet);
    const walletLoading = useSelector((s) => s.wallet.walletLoading);
    const [config, setConfig] = useState(getCachedPaymentConfig());
    const [selectedId, setSelectedId] = useState(null);
    const [paying, setPaying] = useState(false);

    const isDark = theme?.mode === 'dark';
    const accent = theme?.main || '#1199ff';
    const colors = {
        sheet: isDark ? '#1a1a1a' : '#ffffff',
        card: isDark ? '#242424' : '#f4f6fb',
        txt: isDark ? '#f0f0f0' : '#1a1a1a',
        sub: isDark ? '#9a9a9a' : '#777',
    };

    useEffect(() => {
        if (!visible) return;
        setSelectedId(null);
        dispatch(fetchWallet());
        (async () => setConfig(await fetchPaymentConfig()))();
    }, [visible, dispatch]);

    const packs = wallet?.packs ?? [];
    const selected = packs.find((p) => p.id === selectedId);
    const buyActive = canBuy(config);

    const pay = async () => {
        if (!selected || paying) return;
        setPaying(true);
        try {
            const res = await handleBuyCoins(selected, config);
            if (res?.ok) {
                onClose?.();
                onPaid?.();
            }
        } finally {
            setPaying(false);
        }
    };

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={[styles.sheet, { backgroundColor: colors.sheet }]} onPress={() => {}}>
                    <View style={styles.handle} />
                    <View style={styles.titleRow}>
                        <Text style={[styles.title, { color: colors.txt }]}>{title}</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={10}>
                            <Ionicons name="close" size={22} color={colors.sub} />
                        </TouchableOpacity>
                    </View>
                    {!!message && <Text style={[styles.message, { color: colors.sub }]}>{message}</Text>}

                    <View style={[styles.balanceRow, { backgroundColor: colors.card }]}>
                        <Ionicons name="logo-bitcoin" size={22} color="#f39c12" />
                        <Text style={[styles.balanceText, { color: colors.txt }]}>Balance: {wallet?.balance ?? 0} coins</Text>
                    </View>

                    {walletLoading && !packs.length ? (
                        <ActivityIndicator color={accent} style={{ marginVertical: 24 }} />
                    ) : !packs.length ? (
                        <Text style={[styles.message, { color: colors.sub, textAlign: 'center', marginVertical: 20 }]}>
                            Coin packs abhi available nahi hain.
                        </Text>
                    ) : (
                        <View style={styles.grid}>
                            {packs.map((pack) => {
                                const on = pack.id === selectedId;
                                return (
                                    <TouchableOpacity
                                        key={pack.id}
                                        activeOpacity={0.8}
                                        onPress={() => setSelectedId(pack.id)}
                                        style={[styles.pack, { backgroundColor: colors.card, borderColor: on ? accent : 'transparent' }]}
                                    >
                                        <Ionicons name="logo-bitcoin" size={22} color="#f39c12" />
                                        <Text style={[styles.packCoins, { color: colors.txt }]}>{pack.coins} coins</Text>
                                        <Text style={[styles.packPrice, { color: colors.sub }]}>₹{pack.price}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {!buyActive && !!packs.length && (
                        <Text style={[styles.message, { color: colors.sub }]}>
                            Online payment abhi on nahi hai. Coins ke liye support se contact karo.
                        </Text>
                    )}

                    <TouchableOpacity
                        style={[styles.payBtn, { backgroundColor: accent }, (!selected || !buyActive || paying) && styles.payBtnOff]}
                        disabled={!selected || !buyActive || paying}
                        onPress={pay}
                    >
                        {paying ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.payText}>{selected ? `Pay ₹${selected.price}` : 'Select a pack'}</Text>
                        )}
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28 },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#bbb', marginBottom: 14 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 17, fontWeight: '700' },
    message: { fontSize: 13, marginTop: 6, lineHeight: 18 },
    balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, marginTop: 14 },
    balanceText: { fontSize: 14, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
    pack: { width: '31%', alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 2, gap: 4 },
    packCoins: { fontSize: 14, fontWeight: '700' },
    packPrice: { fontSize: 12 },
    payBtn: { marginTop: 18, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    payBtnOff: { opacity: 0.45 },
    payText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default AddWalletAmt;
