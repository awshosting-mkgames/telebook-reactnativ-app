import { useCallback, useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar,
    StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import { fetchPlans } from '../../redex/slices/plansSlice';
import apiService from '../../services/apiService';

const MAX_MESSAGE = 500; // backend bhi 500 par slice karta hai
const MIN_COOLDOWN = 1;
const MAX_COOLDOWN = 168;
const DEFAULT_COOLDOWN = 24;

export default function AutoReply({ navigation }) {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const dispatch = useDispatch();
    const plans = useSelector((s) => s.plans?.plans) || [];

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [locked, setLocked] = useState(false); // plan allow nahi karta
    const [featureOff, setFeatureOff] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const [message, setMessage] = useState('');
    const [cooldown, setCooldown] = useState(String(DEFAULT_COOLDOWN));

    const isDark = theme?.mode === 'dark';
    const headerBg = theme?.header || '#1199ff';
    const colors = {
        bg: isDark ? '#121212' : '#f2f4f7',
        card: isDark ? '#1e1e1e' : '#ffffff',
        txt: isDark ? '#f0f0f0' : '#1a1a1a',
        sub: isDark ? '#9a9a9a' : '#8a8f98',
        divider: isDark ? '#2a2a2a' : '#eceef1',
        input: isDark ? '#262626' : '#f5f6f8',
        accent: headerBg,
    };

    // Kaunsa sabse sasta plan Auto Reply deta hai (limits.autoReply truthy)
    const requiredPlan = plans.find((p) => p?.limits?.autoReply)?.name;

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        const res = await apiService({ method: 'GET', endpoint: 'settings/auto-reply' });
        const d = res?.data?.data;
        if (res?.success && d) {
            setFeatureOff(d.featureEnabled === false);
            setLocked(d.allowedOnMyPlan === false);
            setEnabled(!!d.enabled);
            setMessage(d.message || '');
            setCooldown(String(d.cooldownHours ?? DEFAULT_COOLDOWN));
        } else if (res?.error?.code === 'PLAN_LIMIT') {
            setLocked(true);
        } else {
            setLoadError(res?.error?.message || t('ar_load_error'));
        }
        setLoading(false);
    }, [t]);

    useEffect(() => {
        load();
        dispatch(fetchPlans());
    }, [load, dispatch]);

    const save = async () => {
        const hours = Math.min(MAX_COOLDOWN, Math.max(MIN_COOLDOWN, parseInt(cooldown, 10) || DEFAULT_COOLDOWN));
        if (enabled && !message.trim()) {
            Toast.show({ type: 'error', text1: t('ar_message_required') });
            return;
        }
        setSaving(true);
        const res = await apiService({
            method: 'PUT',
            endpoint: 'settings/auto-reply',
            data: { enabled, message: message.trim(), cooldownHours: hours },
        });
        setSaving(false);
        if (res?.success && res.data?.success !== false) {
            setCooldown(String(hours));
            Toast.show({ type: 'success', text1: t('ar_saved') });
            return;
        }
        // 403 PLAN_LIMIT (upgrade:true) -> locked state dikhao
        if (res?.error?.code === 'PLAN_LIMIT' || res?.error?.upgrade) {
            setLocked(true);
            setEnabled(false);
            return;
        }
        Toast.show({ type: 'error', text1: t('ar_save_error'), text2: res?.error?.message });
    };

    const renderLocked = () => (
        <View style={[styles.card, styles.lockedBox, { backgroundColor: colors.card }]}>
            <Ionicons name="lock-closed" size={40} color={colors.sub} />
            <Text style={[styles.lockedTitle, { color: colors.txt }]}>{t('ar_locked_title')}</Text>
            <Text style={[styles.sub, { color: colors.sub, textAlign: 'center' }]}>
                {requiredPlan ? t('ar_locked_plan', { plan: requiredPlan }) : t('ar_locked_generic')}
            </Text>
            <TouchableOpacity style={[styles.cta, { backgroundColor: colors.accent }]} onPress={() => navigation.navigate('Plans')}>
                <Text style={styles.ctaText}>{t('ar_upgrade')}</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar backgroundColor={headerBg} barStyle="light-content" />
            <View style={[styles.header, { backgroundColor: headerBg }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('ar_title')}</Text>
            </View>

            {loading ? (
                <ActivityIndicator color={colors.accent} size="large" style={{ flex: 1 }} />
            ) : loadError ? (
                <View style={styles.center}>
                    <Text style={{ color: colors.sub, textAlign: 'center' }}>{loadError}</Text>
                    <TouchableOpacity onPress={load} style={{ marginTop: 10 }}>
                        <Text style={{ color: colors.accent, fontWeight: '700' }}>{t('ph_retry')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
                        {featureOff ? (
                            <Text style={{ color: colors.sub, textAlign: 'center', marginTop: 30 }}>{t('ar_feature_off')}</Text>
                        ) : locked ? renderLocked() : (
                            <>
                                <View style={[styles.card, { backgroundColor: colors.card }]}>
                                    <View style={styles.rowBetween}>
                                        <Text style={[styles.title, { color: colors.txt }]}>{t('ar_enable')}</Text>
                                        <Switch
                                            value={enabled}
                                            onValueChange={setEnabled}
                                            trackColor={{ false: '#ccc', true: colors.accent }}
                                            thumbColor="#fff"
                                        />
                                    </View>
                                </View>

                                <View style={[styles.card, { backgroundColor: colors.card }]}>
                                    <Text style={[styles.label, { color: colors.sub }]}>{t('ar_message')}</Text>
                                    <TextInput
                                        style={[styles.input, styles.multiline, { backgroundColor: colors.input, color: colors.txt }]}
                                        value={message}
                                        onChangeText={setMessage}
                                        maxLength={MAX_MESSAGE}
                                        multiline
                                        placeholder={t('ar_message_placeholder')}
                                        placeholderTextColor={colors.sub}
                                    />
                                    <Text style={[styles.counter, { color: colors.sub }]}>{message.length}/{MAX_MESSAGE}</Text>

                                    <Text style={[styles.label, { color: colors.sub, marginTop: 12 }]}>{t('ar_cooldown')}</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.input, color: colors.txt }]}
                                        value={cooldown}
                                        onChangeText={(v) => setCooldown(v.replace(/[^0-9]/g, '').slice(0, 3))}
                                        keyboardType="number-pad"
                                        placeholder={String(DEFAULT_COOLDOWN)}
                                        placeholderTextColor={colors.sub}
                                    />
                                    {/* Existing backend rule: har sender ko cooldown mein ek hi baar, jab user offline ho */}
                                    <Text style={[styles.sub, { color: colors.sub, marginTop: 8 }]}>
                                        {t('ar_helper', { hours: Math.min(MAX_COOLDOWN, Math.max(MIN_COOLDOWN, parseInt(cooldown, 10) || DEFAULT_COOLDOWN)) })}
                                    </Text>
                                </View>

                                <TouchableOpacity style={[styles.cta, { backgroundColor: colors.accent, opacity: saving ? 0.7 : 1 }]} onPress={save} disabled={saving}>
                                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{t('ar_save')}</Text>}
                                </TouchableOpacity>
                            </>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            )}
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
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { borderRadius: 16, padding: 16, marginBottom: 14 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 16, fontWeight: '600' },
    label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    sub: { fontSize: 12, lineHeight: 17 },
    input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
    multiline: { minHeight: 100, textAlignVertical: 'top' },
    counter: { fontSize: 11, textAlign: 'right', marginTop: 4 },
    cta: { marginTop: 8, paddingVertical: 13, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center' },
    ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    lockedBox: { alignItems: 'center', paddingVertical: 28, gap: 8 },
    lockedTitle: { fontSize: 17, fontWeight: '700' },
});
