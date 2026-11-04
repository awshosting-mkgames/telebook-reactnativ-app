import { useCallback, useContext, useState } from 'react';
import {
    ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import Toast from 'react-native-toast-message';
import { ThemeContext } from '../../components/ThemeContext';
import GradientFill from '../../components/GradientFill';
import { useHeaderMetrics } from '../../utils/headerMetrics';
import apiService from '../../services/apiService';
import { updateUserData } from '../../redex/slices/totalappDataSlice';
import { handlePlanLimit } from '../../services/planLimit';
import { PREMIUM_THEMES, PREMIUM_THEME_LIST, readableOn, resolvePremiumTheme } from '../../utils/premiumThemes';

// Chhota phone-style preview: header gradient, filter chips, bubbles, FAB, bottom nav
const Preview = ({ p }) => (
    <View style={[styles.preview, { backgroundColor: p.background }]}>
        <View style={styles.pvHeader}>
            <GradientFill colors={p.gradient} />
            <View style={styles.pvAvatar} />
            <View style={styles.pvTitle} />
        </View>
        <View style={styles.pvChips}>
            <View style={[styles.pvChip, { backgroundColor: p.main }]} />
            <View style={styles.pvChipOff} />
            <View style={styles.pvChipOff} />
        </View>
        <View style={[styles.pvBubble, { backgroundColor: '#fff', alignSelf: 'flex-start' }]} />
        <View style={[styles.pvBubble, { backgroundColor: p.bubble, alignSelf: 'flex-end' }]} />
        <View style={[styles.pvFab, { backgroundColor: p.main }]}>
            <Ionicons name="add" size={12} color={readableOn(p.main)} />
        </View>
        <View style={styles.pvNav}>
            <View style={[styles.pvDot, { backgroundColor: p.main }]} />
            <View style={styles.pvDotOff} /><View style={styles.pvDotOff} /><View style={styles.pvDotOff} />
        </View>
    </View>
);

export default function ThemeSelect({ navigation }) {
    const { theme, premiumKey, setPremiumTheme, registerRemoteThemes, toggleTheme } = useContext(ThemeContext);
    const dispatch = useDispatch();
    const { top, height } = useHeaderMetrics(); // standard header: status bar + 60
    const isDark = theme?.mode === 'dark';

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [info, setInfo] = useState(null);   // { allowedCount, planCode, themes }
    const [busyKey, setBusyKey] = useState(null);

    const colors = {
        bg: isDark ? '#121212' : '#f2f4f7',
        card: isDark ? '#1e1e1e' : '#ffffff',
        txt: isDark ? '#f0f0f0' : '#1a1a1a',
        sub: isDark ? '#9a9a9a' : '#6b7280',
    };

    const load = useCallback(async () => {
        setError(null);
        const res = await apiService({ method: 'GET', endpoint: 'settings/themes' });
        if (res.success && res.data?.data) {
            setInfo(res.data.data);
            registerRemoteThemes(res.data.data.themes);
        } else {
            setError(res.error?.message || (typeof res.error === 'string' ? res.error : 'Could not load themes'));
        }
        setLoading(false);
    }, [registerRemoteThemes]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const save = async (key, themeId) => {
        const prev = premiumKey;
        setBusyKey(key || 'default');
        setPremiumTheme(key);                       // turant lagao, restart nahi
        const res = await apiService({ method: 'PUT', endpoint: 'settings/theme', data: { themeId } });
        setBusyKey(null);
        if (res.success) {
            dispatch(updateUserData({ theme: themeId }));
            Toast.show({ type: 'success', text1: key ? 'Theme applied' : 'Default theme restored' });
        } else {
            setPremiumTheme(prev);                  // revert
            if (!handlePlanLimit(res, navigation)) {
                Toast.show({ type: 'error', text1: 'Could not save theme', text2: res.error?.message });
            }
        }
    };

    const onPick = (t) => {
        if (busyKey) return;
        if (!t.unlocked) {
            Alert.alert(
                'Premium theme',
                `${t.name} is available on a higher plan. Upgrade to unlock it.`,
                [{ text: 'View plans', onPress: () => navigation.navigate('Plans') }, { text: 'Cancel', style: 'cancel' }]
            );
            return;
        }
        if (premiumKey !== t.id) save(t.id, t.id);
    };

    // Sirf wahi themes jinka gradient app ko aata hai, backend ke sortOrder me
    const remote = (info?.themes || []).filter((t) => PREMIUM_THEMES[t.id]);

    return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            <View style={[styles.header, { height, paddingTop: top, paddingBottom: 0, backgroundColor: theme.header }]}>
                <GradientFill />
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Themes</Text>
            </View>

            <ScrollView contentContainerStyle={styles.body}>
                <Text style={[styles.section, { color: colors.sub }]}>MODE</Text>
                <View style={styles.modeRow}>
                    {[false, true].map((dark) => {
                        const active = dark === isDark;
                        return (
                            <TouchableOpacity
                                key={String(dark)}
                                onPress={() => { if (!active) toggleTheme(); }}
                                style={[styles.modeBtn, { backgroundColor: colors.card, borderColor: active ? theme.main : 'transparent' }]}
                                activeOpacity={0.8}
                            >
                                <Ionicons name={dark ? 'moon' : 'sunny'} size={18} color={active ? theme.main : colors.sub} />
                                <Text style={{ color: colors.txt, fontWeight: '600' }}>{dark ? 'Dark' : 'Light'}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.titleRow}>
                    <Text style={[styles.section, { color: colors.sub, marginTop: 0 }]}>PREMIUM GRADIENT THEMES</Text>
                    {info && (
                        <Text style={{ color: colors.sub, fontSize: 12 }}>
                            {info.allowedCount === 'unlimited' ? 'All unlocked' : `${info.allowedCount} included in your plan`}
                        </Text>
                    )}
                </View>

                {loading ? (
                    <ActivityIndicator color={theme.main} size="large" style={{ marginTop: 40 }} />
                ) : error ? (
                    <View style={{ alignItems: 'center', marginTop: 30 }}>
                        <Text style={{ color: colors.sub, marginBottom: 12 }}>{error}</Text>
                        <TouchableOpacity onPress={() => { setLoading(true); load(); }} style={[styles.btn, { borderColor: theme.main }]}>
                            <Text style={{ color: theme.main, fontWeight: '700' }}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {premiumKey && (
                            <TouchableOpacity onPress={() => save(null, 'light')} style={[styles.resetRow, { backgroundColor: colors.card }]} activeOpacity={0.8}>
                                <Ionicons name="color-palette-outline" size={18} color={colors.sub} />
                                <Text style={{ color: colors.txt, flex: 1, fontWeight: '600' }}>Use default theme</Text>
                                {busyKey === 'default' && <ActivityIndicator size="small" color={theme.main} />}
                            </TouchableOpacity>
                        )}
                        {remote.length === 0 && (
                            <Text style={{ color: colors.sub, textAlign: 'center', marginTop: 24 }}>No premium themes available right now.</Text>
                        )}
                        {remote.map((t) => {
                            const p = resolvePremiumTheme(t.id, t);
                            const active = premiumKey === t.id;
                            return (
                                <TouchableOpacity
                                    key={t.id}
                                    onPress={() => onPick(t)}
                                    activeOpacity={0.85}
                                    style={[styles.card, { backgroundColor: colors.card, borderColor: active ? p.main : 'transparent' }]}
                                >
                                    <Preview p={p} />
                                    <View style={styles.cardInfo}>
                                        <Text style={[styles.cardTitle, { color: colors.txt }]}>{p.emoji}  {p.name}</Text>
                                        <View style={styles.swatches}>
                                            <View style={[styles.swatch, { backgroundColor: p.gradient[0] }]} />
                                            <View style={[styles.swatch, { backgroundColor: p.gradient[1] }]} />
                                            <View style={[styles.swatch, { backgroundColor: p.accent }]} />
                                        </View>
                                        {active ? (
                                            <View style={[styles.pill, { backgroundColor: p.main }]}>
                                                <Ionicons name="checkmark" size={13} color={readableOn(p.main)} />
                                                <Text style={[styles.pillText, { color: readableOn(p.main) }]}>Applied</Text>
                                            </View>
                                        ) : t.unlocked ? (
                                            <View style={[styles.pill, { borderColor: p.main, borderWidth: 1 }]}>
                                                {busyKey === t.id
                                                    ? <ActivityIndicator size="small" color={p.main} />
                                                    : <Text style={[styles.pillText, { color: p.main }]}>Apply</Text>}
                                            </View>
                                        ) : (
                                            <View style={[styles.pill, { backgroundColor: isDark ? '#333' : '#eee' }]}>
                                                <Ionicons name="lock-closed" size={12} color={colors.sub} />
                                                <Text style={[styles.pillText, { color: colors.sub }]}>Upgrade</Text>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, overflow: 'hidden' },
    headerTitle: { color: '#fff', fontSize: 19, fontWeight: '700' },
    body: { padding: 16, paddingBottom: 40 },
    section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 4, marginBottom: 8 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 8 },
    modeRow: { flexDirection: 'row', gap: 12 },
    modeBtn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 2 },
    btn: { borderWidth: 1, paddingHorizontal: 22, paddingVertical: 8, borderRadius: 20 },
    resetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, marginBottom: 12 },
    card: { flexDirection: 'row', borderRadius: 16, padding: 12, marginBottom: 14, borderWidth: 2, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    cardInfo: { flex: 1, paddingLeft: 14, justifyContent: 'center', gap: 10 },
    cardTitle: { fontSize: 16, fontWeight: '700' },
    swatches: { flexDirection: 'row', gap: 6 },
    swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: '#0003' },
    pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, minWidth: 80, justifyContent: 'center' },
    pillText: { fontSize: 13, fontWeight: '700' },
    preview: { width: 104, height: 150, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#0002' },
    pvHeader: { height: 32, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 5, backgroundColor: '#444', overflow: 'hidden' },
    pvAvatar: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' },
    pvTitle: { width: 30, height: 5, borderRadius: 3, backgroundColor: '#ffffffcc' },
    pvChips: { flexDirection: 'row', gap: 4, padding: 6 },
    pvChip: { width: 20, height: 9, borderRadius: 5 },
    pvChipOff: { width: 20, height: 9, borderRadius: 5, backgroundColor: '#0001' },
    pvBubble: { width: 56, height: 16, borderRadius: 7, marginHorizontal: 6, marginTop: 5 },
    pvFab: { position: 'absolute', right: 7, bottom: 26, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    pvNav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 20, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#fff' },
    pvDot: { width: 10, height: 10, borderRadius: 5 },
    pvDotOff: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0002' },
});
