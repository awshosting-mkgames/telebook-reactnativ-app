import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Channel Boost / Sponsor popup. Sab rang aur size sirf TOKENS me hain — reference design aane par
// yahin badlo (component ka structure wahi rahega).
export const BOOST_TOKENS = {
    accent: '#1296f3',
    accentDark: '#0b6fd0',
    gold: '#f5a623',
    light: { sheet: '#ffffff', card: '#f5f9ff', cardBorder: '#dbe9fb', text: '#14202b', sub: '#6b7a86', featuredBg: '#eaf4ff' },
    dark: { sheet: '#10161d', card: '#17212b', cardBorder: '#243445', text: '#ffffff', sub: '#9fb2c4', featuredBg: '#12263a' },
    radius: 18,
};

const fmtDuration = (hours) => {
    const h = Number(hours) || 0;
    if (h >= 24 && h % 24 === 0) { const d = h / 24; return `${d} ${d === 1 ? 'day' : 'days'}`; }
    return `${h} ${h === 1 ? 'hour' : 'hours'}`;
};

/**
 * visible, isDark, channelName, balance, options[{id,hours,coins,affordable}],
 * purchasingId, onPick(optionId), onClose, onBuyCoins()
 */
export default function BoostSheet({ visible, isDark, channelName, balance = 0, options = [], purchasingId, onPick, onClose, onBuyCoins }) {
    const C = isDark ? BOOST_TOKENS.dark : BOOST_TOKENS.light;
    const best = options.length ? options.reduce((a, b) => (a.coins / (a.hours || 1) <= b.coins / (b.hours || 1) ? a : b)) : null;
    const anyLocked = options.some((o) => !o.affordable);

    return (
        <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={[styles.sheet, { backgroundColor: C.sheet }]} onStartShouldSetResponder={() => true}>
                    <View style={[styles.handle, { backgroundColor: C.cardBorder }]} />

                    <View style={styles.hero}>
                        <View style={styles.heroIcon}><Ionicons name="rocket" size={26} color="#fff" /></View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.title, { color: C.text }]} numberOfLines={1}>Boost {channelName}</Text>
                            <Text style={[styles.sub, { color: C.sub }]}>Sponsored channels appear first in Discover and Updates</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color={C.sub} /></TouchableOpacity>
                    </View>

                    <View style={[styles.balance, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                        <Ionicons name="wallet-outline" size={20} color={BOOST_TOKENS.gold} />
                        <Text style={[styles.balanceText, { color: C.sub }]}>Your balance</Text>
                        <Text style={[styles.balanceVal, { color: C.text }]}>{Number(balance).toLocaleString()} coins</Text>
                        {!!onBuyCoins && (
                            <TouchableOpacity onPress={onBuyCoins} style={styles.buyBtn} activeOpacity={0.8}>
                                <Ionicons name="add" size={14} color="#fff" />
                                <Text style={styles.buyText}>Add coins</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={[styles.section, { color: C.sub }]}>CHOOSE DURATION</Text>
                    <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                        {options.length === 0 ? (
                            <Text style={[styles.empty, { color: C.sub }]}>No boost options available right now</Text>
                        ) : options.map((opt) => {
                            const locked = !opt.affordable;
                            const featured = best && opt.id === best.id && !locked;
                            const busy = purchasingId === opt.id;
                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    activeOpacity={0.85}
                                    disabled={!!purchasingId || locked}
                                    onPress={() => onPick?.(opt.id)}
                                    style={[
                                        styles.card,
                                        { backgroundColor: featured ? C.featuredBg : C.card, borderColor: featured ? BOOST_TOKENS.accent : C.cardBorder },
                                        featured && styles.cardFeatured,
                                        locked && { opacity: 0.55 },
                                    ]}
                                >
                                    {featured && <View style={styles.ribbon}><Text style={styles.ribbonText}>BEST VALUE</Text></View>}
                                    <View style={[styles.clock, { backgroundColor: featured ? BOOST_TOKENS.accent : C.cardBorder }]}>
                                        <Ionicons name="time-outline" size={20} color={featured ? '#fff' : C.sub} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.duration, { color: C.text }]}>{fmtDuration(opt.hours)}</Text>
                                        <Text style={[styles.perHour, { color: C.sub }]}>
                                            {locked ? 'Not enough coins' : `${(opt.coins / (opt.hours || 1)).toFixed(opt.coins / (opt.hours || 1) < 10 ? 1 : 0)} coins / hour`}
                                        </Text>
                                    </View>
                                    <View style={styles.priceCol}>
                                        {busy ? <ActivityIndicator color={BOOST_TOKENS.accent} /> : (
                                            <>
                                                <Text style={styles.price}>{Number(opt.coins).toLocaleString()}</Text>
                                                <Text style={[styles.priceUnit, { color: C.sub }]}>coins</Text>
                                            </>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {anyLocked && !!onBuyCoins && (
                        <Text style={[styles.hint, { color: C.sub }]}>Some plans are locked — add coins to unlock them.</Text>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingBottom: 26, paddingTop: 10 },
    handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, marginBottom: 14 },
    hero: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: BOOST_TOKENS.accent, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '800' },
    sub: { fontSize: 12, marginTop: 2 },
    balance: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 },
    balanceText: { fontSize: 13 },
    balanceVal: { fontSize: 14, fontWeight: '800', flex: 1 },
    buyBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: BOOST_TOKENS.accent, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
    buyText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: BOOST_TOKENS.radius, padding: 14, marginBottom: 10, overflow: 'hidden' },
    cardFeatured: { borderWidth: 2 },
    ribbon: { position: 'absolute', top: 0, right: 0, backgroundColor: BOOST_TOKENS.gold, paddingHorizontal: 10, paddingVertical: 3, borderBottomLeftRadius: 12 },
    ribbonText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
    clock: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    duration: { fontSize: 16, fontWeight: '800' },
    perHour: { fontSize: 12, marginTop: 2 },
    priceCol: { alignItems: 'flex-end', minWidth: 70 },
    price: { fontSize: 20, fontWeight: '900', color: BOOST_TOKENS.accent },
    priceUnit: { fontSize: 11 },
    empty: { textAlign: 'center', paddingVertical: 24 },
    hint: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
