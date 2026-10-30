import { useCallback, useContext, useState } from 'react';
import {
    ActivityIndicator, Alert, FlatList, Platform, RefreshControl, SafeAreaView,
    StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import { useDispatch } from 'react-redux';
import { getDeviceId, getDeviceInfo } from '../../services/deviceId';
import { logoutUser } from '../../services/Logoutcall';

const fmtLastActive = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export default function LinkedDevices({ navigation }) {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const dispatch = useDispatch();

    const [devices, setDevices] = useState([]);
    const [meta, setMeta] = useState(null); // { limit, used, enforced }
    const [localId, setLocalId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [busyId, setBusyId] = useState(null);

    const isDark = theme?.mode === 'dark';
    const headerBg = theme?.header || '#1199ff';
    const colors = {
        bg: isDark ? '#121212' : '#f2f4f7',
        card: isDark ? '#1e1e1e' : '#ffffff',
        txt: isDark ? '#f0f0f0' : '#1a1a1a',
        sub: isDark ? '#9a9a9a' : '#8a8f98',
        divider: isDark ? '#2a2a2a' : '#eceef1',
        accent: headerBg,
        danger: '#e74c3c',
    };

    const load = useCallback(async () => {
        setError(null);
        // Is phone ka asli naam server ko bata do (pehle 'Unknown' tha) — fail ho to chalega
        getDeviceId().then((id) => apiService({ method: 'PUT', endpoint: 'devices/current', data: { deviceId: id, ...getDeviceInfo() } })).catch(() => {});
        const [res, id] = await Promise.all([
            apiService({ method: 'GET', endpoint: 'devices' }),
            getDeviceId().catch(() => null),
        ]);
        setLocalId(id);
        const d = res?.data?.data;
        if (res?.success && d) {
            setDevices(d.devices || []);
            setMeta({ limit: d.limit, used: d.used, enforced: d.enforced });
        } else {
            setError(res?.error?.message || t('ld_load_error'));
        }
        setLoading(false);
    }, [t]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const onRefresh = async () => {
        setRefreshing(true);
        try { await load(); } finally { setRefreshing(false); }
    };

    const logoutOne = (dev) => {
        Alert.alert(t('ld_logout_title'), t('ld_logout_msg', { name: dev.deviceName || t('ld_unknown_device') }), [
            { text: t('Cancel'), style: 'cancel' },
            {
                text: t('ld_logout'),
                style: 'destructive',
                onPress: async () => {
                    setBusyId(dev.deviceId);
                    const res = await apiService({ method: 'DELETE', endpoint: `devices/${encodeURIComponent(dev.deviceId)}` });
                    setBusyId(null);
                    if (res?.success) {
                        Toast.show({ type: 'success', text1: t('ld_logged_out') });
                        // Apna hi device logout kiya: turant logout (OTP se dobara login)
                        if (isCurrent(dev)) { logoutUser(null, dispatch); return; }
                        load();
                    } else {
                        Toast.show({ type: 'error', text1: t('ld_action_error'), text2: res?.error?.message });
                    }
                },
            },
        ]);
    };

    const logoutOthers = () => {
        Alert.alert(t('ld_logout_all_title'), t('ld_logout_all_msg'), [
            { text: t('Cancel'), style: 'cancel' },
            {
                text: t('ld_logout_all'),
                style: 'destructive',
                onPress: async () => {
                    setBusyId('__others__');
                    const res = await apiService({ method: 'POST', endpoint: 'devices/revoke-others', data: { deviceId: localId } });
                    setBusyId(null);
                    if (res?.success) {
                        Toast.show({ type: 'success', text1: res.data?.message || t('ld_logged_out') });
                        load();
                    } else {
                        Toast.show({ type: 'error', text1: t('ld_action_error'), text2: res?.error?.message });
                    }
                },
            },
        ]);
    };

    const isCurrent = (dev) => dev.isCurrent || (localId && String(dev.deviceId) === String(localId));
    const hasOthers = devices.some((d) => !isCurrent(d));

    const renderItem = ({ item }) => {
        const current = isCurrent(item);
        return (
            <View style={[styles.row, { backgroundColor: colors.card }]}>
                <View style={[styles.icon, { backgroundColor: `${colors.accent}22` }]}>
                    <Ionicons name={item.deviceType === 'ios' ? 'phone-portrait-outline' : 'phone-portrait'} size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.txt }]} numberOfLines={1}>{item.deviceName || t('ld_unknown_device')}</Text>
                    <Text style={[styles.sub, { color: colors.sub }]} numberOfLines={1}>
                        {[item.deviceType, item.appVersion && `v${item.appVersion}`].filter(Boolean).join(' · ')}
                    </Text>
                    <Text style={[styles.sub, { color: colors.sub }]}>{t('ld_last_active')}: {fmtLastActive(item.lastActiveAt)}</Text>
                    {current && <Text style={[styles.current, { color: colors.accent }]}>{t('ld_this_device')}</Text>}
                </View>
                {busyId === item.deviceId ? (
                    <ActivityIndicator color={colors.danger} />
                ) : (
                    <TouchableOpacity onPress={() => logoutOne(item)} hitSlop={8}>
                        <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 13 }}>{t('ld_logout')}</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar backgroundColor={headerBg} barStyle="light-content" />
            <View style={[styles.header, { backgroundColor: headerBg }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('ld_title')}</Text>
            </View>

            {loading ? (
                <ActivityIndicator color={colors.accent} size="large" style={{ flex: 1 }} />
            ) : (
                <FlatList
                    data={devices}
                    keyExtractor={(item) => String(item.deviceId)}
                    renderItem={renderItem}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                    contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
                    ListHeaderComponent={
                        meta ? (
                            <Text style={[styles.summary, { color: colors.sub }]}>
                                {meta.limit === 'unlimited'
                                    ? t('ld_summary_unlimited', { used: meta.used })
                                    : t('ld_summary', { used: meta.used, limit: meta.limit })}
                            </Text>
                        ) : null
                    }
                    ListEmptyComponent={
                        error ? (
                            <View style={{ alignItems: 'center', marginTop: 20 }}>
                                <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text>
                                <TouchableOpacity onPress={load} style={{ marginTop: 10 }}>
                                    <Text style={{ color: colors.accent, fontWeight: '700' }}>{t('ph_retry')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : <Text style={{ color: colors.sub, textAlign: 'center', marginTop: 20 }}>{t('ld_empty')}</Text>
                    }
                    ListFooterComponent={
                        hasOthers ? (
                            <TouchableOpacity
                                style={[styles.allBtn, { borderColor: colors.danger, opacity: busyId === '__others__' ? 0.6 : 1 }]}
                                onPress={logoutOthers}
                                disabled={busyId === '__others__'}
                            >
                                {busyId === '__others__'
                                    ? <ActivityIndicator color={colors.danger} />
                                    : <Text style={{ color: colors.danger, fontWeight: '700' }}>{t('ld_logout_all')}</Text>}
                            </TouchableOpacity>
                        ) : null
                    }
                />
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
    summary: { fontSize: 13, marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, gap: 12 },
    icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 15, fontWeight: '600' },
    sub: { fontSize: 12, marginTop: 2 },
    current: { fontSize: 12, fontWeight: '700', marginTop: 4 },
    allBtn: { marginTop: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
});
