import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Config from '../../../services/config';
import apiService from '../../../services/apiService';
import { APP_BUILD_HEADERS } from '../../../services/appBuild';
import { navigate } from '../../../navigation/RootNavigation';
import { useMediaUri } from '../../../utils/mediaCache';

// Sticker panel — admin ke banaye packs, USER KE PLAN ke hisaab se.
//   GET /api/settings/stickers → { allowedPremiumPacks, planCode, packs:[{ _id, name, coverKey, isPremium, unlocked, stickerCount, stickers:[{key,emoji}] }] }
//   * free pack / plan me khule premium pack → stickers dikhte hain aur bheje ja sakte hain
//   * plan se bahar ka premium pack → lock icon, stickers nahi (server bhejta hi nahi) + "Upgrade" button → Plans
//   * purane (static) free stickers `users/stickers` agar hain to "Basic" tab me
// Server bhi lock lagata hai: locked pack ka sticker message POST karne par 403 STICKER_LOCKED.
const CACHE_KEY = 'STICKER_PACKS_V1';
const BASIC_ID = '__basic__';

const mediaUrl = (key) => (!key ? null : /^https?:/i.test(key) ? key : `${Config.MEDIA_URL}${key}`);
const legacyUrl = (url) => (!url ? null : /^https?:/i.test(url) ? url : `${Config.Main_url}${url}`);

// Disk-cached sticker image (offline me bhi wahi file)
const StickerImage = ({ uri, style }) => {
    const local = useMediaUri(uri);
    return <Image source={{ uri: local || uri }} style={style} resizeMode="contain" />;
};

export default function StickerPanel({ onSendSticker, isDark, accent = '#1296f3' }) {
    const [packs, setPacks] = useState([]);
    const [info, setInfo] = useState({ planCode: null, allowed: null });
    const [basic, setBasic] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const panelBg = isDark ? '#1f2c34' : '#ffffff';
    const sub = isDark ? '#8696a0' : '#666666';
    const line = isDark ? '#2a3942' : '#e8e8e8';
    const txt = isDark ? '#e9edef' : '#111111';

    const apply = useCallback((data) => {
        setPacks(Array.isArray(data?.packs) ? data.packs : []);
        setInfo({ planCode: data?.planCode ?? null, allowed: data?.allowedPremiumPacks ?? null });
    }, []);

    const load = useCallback(async () => {
        setError(null);
        // 1) cache turant (offline me bhi)
        let hadCache = false;
        try {
            const raw = await AsyncStorage.getItem(CACHE_KEY);
            if (raw) { apply(JSON.parse(raw)); hadCache = true; setLoading(false); }
        } catch (e) { /* cache nahi */ }
        // 2) server se taaza (plan badla ho to lock/unlock turant sahi)
        const res = await apiService({ method: 'GET', endpoint: 'settings/stickers' });
        if (res?.success && res.data?.data) {
            apply(res.data.data);
            AsyncStorage.setItem(CACHE_KEY, JSON.stringify(res.data.data)).catch(() => {});
        } else if (!hadCache) {
            setError('Could not load stickers');
        }
        // 3) purane free stickers (agar server par folder ho)
        try {
            const r = await fetch(`${Config.BASE_URL}users/stickers`, { headers: { 'Content-Type': 'application/json', ...APP_BUILD_HEADERS } });
            const j = await r.json();
            setBasic(j?.success && Array.isArray(j.data) ? j.data : []);
        } catch (e) { /* ignore */ }
        setLoading(false);
    }, [apply]);

    useEffect(() => { load(); }, [load]);

    const tabs = useMemo(() => [
        ...(basic.length ? [{ _id: BASIC_ID, name: 'Basic', isPremium: false, unlocked: true, legacy: true }] : []),
        ...packs,
    ], [packs, basic]);

    // Active tab: pehla khula pack
    useEffect(() => {
        if (!tabs.length) return;
        if (!activeId || !tabs.some((t) => t._id === activeId)) setActiveId((tabs.find((t) => t.unlocked) || tabs[0])._id);
    }, [tabs, activeId]);

    const active = tabs.find((t) => t._id === activeId);

    if (loading && !tabs.length) {
        return <View style={[styles.center, { backgroundColor: panelBg }]}><ActivityIndicator color={accent} /></View>;
    }
    if (!tabs.length) {
        return (
            <View style={[styles.center, { backgroundColor: panelBg }]}>
                <Text style={{ color: sub }}>{error || 'No sticker packs yet'}</Text>
                <TouchableOpacity onPress={load} style={[styles.retry, { backgroundColor: accent }]}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
            </View>
        );
    }

    const items = !active ? [] : active.legacy
        ? basic.map((s) => ({ key: s.url, url: legacyUrl(s.url), send: { url: s.url, filename: s.filename, fileType: s.fileType, fileSize: s.fileSize } }))
        : (active.stickers || []).map((s) => {
            const ext = (s.key.split('.').pop() || 'png').toLowerCase();
            return { key: s.key, url: mediaUrl(s.key), send: { url: s.key, filename: s.key.split('/').pop(), fileType: ext, fileSize: 0, name: active.name } };
        });

    return (
        <View style={[styles.container, { backgroundColor: panelBg }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabBar, { borderBottomColor: line }]} contentContainerStyle={{ paddingHorizontal: 8, alignItems: 'center' }}>
                {tabs.map((t) => {
                    const on = t._id === activeId;
                    const cover = t.legacy ? null : mediaUrl(t.coverKey || t.stickers?.[0]?.key);
                    return (
                        <TouchableOpacity key={t._id} onPress={() => setActiveId(t._id)} style={[styles.tab, on && { backgroundColor: accent + '22', borderColor: accent }]} activeOpacity={0.8}>
                            {cover ? <StickerImage uri={cover} style={[styles.tabImg, !t.unlocked && { opacity: 0.45 }]} />
                                : <Ionicons name="happy-outline" size={22} color={on ? accent : sub} />}
                            {!t.unlocked && <View style={styles.lockDot}><Ionicons name="lock-closed" size={10} color="#fff" /></View>}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {active && !active.unlocked ? (
                <View style={styles.locked}>
                    <Ionicons name="lock-closed" size={30} color={sub} />
                    <Text style={[styles.lockedTitle, { color: txt }]}>{active.name}</Text>
                    <Text style={[styles.lockedSub, { color: sub }]}>
                        Premium pack · {active.stickerCount || 0} stickers{'\n'}
                        {info.allowed === null || info.allowed === undefined ? '' : `Your plan includes ${info.allowed} premium pack${Number(info.allowed) === 1 ? '' : 's'}. `}Upgrade to unlock.
                    </Text>
                    <TouchableOpacity onPress={() => navigate('Plans')} style={[styles.upgrade, { backgroundColor: accent }]}>
                        <Text style={styles.upgradeText}>View plans</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(i) => i.key}
                    numColumns={4}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ padding: 8 }}
                    ListEmptyComponent={<Text style={{ color: sub, textAlign: 'center', marginTop: 30 }}>No stickers in this pack</Text>}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.cell} onPress={() => onSendSticker(item.send)} activeOpacity={0.7}>
                            <StickerImage uri={item.url} style={styles.img} />
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { height: 260 },
    center: { height: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
    retry: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    tabBar: { maxHeight: 52, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
    tab: { width: 42, height: 42, borderRadius: 10, marginHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
    tabImg: { width: 32, height: 32 },
    lockDot: { position: 'absolute', right: 1, bottom: 1, width: 15, height: 15, borderRadius: 8, backgroundColor: '#8e8e93', alignItems: 'center', justifyContent: 'center' },
    cell: { width: '25%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
    img: { width: '100%', height: '100%' },
    locked: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 6 },
    lockedTitle: { fontSize: 16, fontWeight: '700', marginTop: 4 },
    lockedSub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
    upgrade: { marginTop: 10, paddingHorizontal: 22, paddingVertical: 9, borderRadius: 20 },
    upgradeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
