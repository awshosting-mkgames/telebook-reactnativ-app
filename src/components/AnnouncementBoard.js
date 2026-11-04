import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from './ThemeContext';
import apiService from '../services/apiService';
import socketService from '../services/socketService';

// Admin Panel ki announcements ka chhota notice board (Home/Freechat me, contact search bar ke neeche).
// Push notification alag se aati rehti hai; yahan wahi soochna baad me bhi dekhi ja sakti hai.
// Offline: pichhli list AsyncStorage se dikhti hai.
const CACHE_KEY = 'ANNOUNCEMENTS_CACHE_V1';
const KIND_COLOR = { info: '#1296f3', success: '#27ae60', warning: '#f39c12', critical: '#e74c3c' };

const sortList = (l) => [...l].sort((a, b) => (b.priority || 0) - (a.priority || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

export default function AnnouncementBoard() {
    const { theme } = useContext(ThemeContext);
    const isDark = theme?.mode === 'dark';
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const seenRef = useRef(new Set());

    const save = (list) => AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list)).catch(() => {});

    useEffect(() => {
        AsyncStorage.getItem(CACHE_KEY).then((raw) => {
            if (!raw) return;
            try { setItems((cur) => (cur.length ? cur : sortList(JSON.parse(raw)))); } catch (e) { /* kharab cache */ }
        }).catch(() => {});
    }, []);

    const load = useCallback(async () => {
        const res = await apiService({ method: 'GET', endpoint: 'announcements' });
        if (!res?.success) return; // offline / error: cache hi dikhta rahe
        const list = sortList(res.data?.data?.announcements ?? res.data?.announcements ?? []);
        setItems(list);
        save(list);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    // App background se wapas aaye to dobara pooch lo (admin ne is beech delete kiya ho sakta hai)
    useEffect(() => {
        const sub = AppState.addEventListener('change', (st) => { if (st === 'active') load(); });
        return () => sub?.remove?.();
    }, [load]);

    // Socket reconnect par bhi server list le lo — disconnected rehte waqt 'removed' event miss ho sakta hai
    useEffect(() => {
        const onConnect = () => load();
        socketService.on?.('connect', onConnect);
        socketService.on?.('announcements-updated', onConnect);
        return () => { socketService.off?.('connect', onConnect); socketService.off?.('announcements-updated', onConnect); };
    }, [load]);

    // Admin ne naya publish/remove kiya to turant (socket)
    useEffect(() => {
        const onNew = (a) => {
            if (!a?._id) return;
            setItems((cur) => { const next = sortList([a, ...cur.filter((x) => x._id !== a._id)]); save(next); return next; });
        };
        const onRemoved = ({ _id } = {}) => setItems((cur) => { const next = cur.filter((x) => x._id !== _id); save(next); return next; });
        socketService.on?.('announcement:new', onNew);
        socketService.on?.('announcement:removed', onRemoved);
        return () => { socketService.off?.('announcement:new', onNew); socketService.off?.('announcement:removed', onRemoved); };
    }, []);

    // "Dekh li" ginti (har id ek baar)
    useEffect(() => {
        items.forEach((a) => {
            if (seenRef.current.has(a._id)) return;
            seenRef.current.add(a._id);
            apiService({ method: 'POST', endpoint: `announcements/${a._id}/seen` }).catch(() => {});
        });
    }, [items]);

    const dismiss = async (a) => {
        setItems((cur) => { const next = cur.filter((x) => x._id !== a._id); save(next); return next; });
        apiService({ method: 'POST', endpoint: `announcements/${a._id}/dismiss` }).catch(() => {});
    };

    if (!items.length) return null;

    const first = items[0];
    const color = KIND_COLOR[first.kind] || KIND_COLOR.info;
    const shown = open ? items : [first];
    const bg = isDark ? '#1b1f23' : '#f5faff';
    const txt = isDark ? '#f0f0f0' : '#1a1a1a';
    const sub = isDark ? '#aab1b8' : '#555';

    return (
        <View style={[styles.board, { borderColor: color, backgroundColor: bg }]}>
            <View style={styles.head}>
                <Ionicons name="megaphone" size={18} color={color} />
                <Text style={[styles.headText, { color }]}>Announcements{items.length > 1 ? ` (${items.length})` : ''}</Text>
                {items.length > 1 && (
                    <TouchableOpacity onPress={() => setOpen((o) => !o)} hitSlop={8} style={styles.toggle}>
                        <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{open ? 'Show less' : 'Show all'}</Text>
                        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={color} />
                    </TouchableOpacity>
                )}
            </View>
            <ScrollView style={open ? styles.openList : null} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {shown.map((a) => {
                const c = KIND_COLOR[a.kind] || KIND_COLOR.info;
                return (
                    <View key={a._id} style={[styles.item, { borderTopColor: isDark ? '#2a2f34' : '#e3eef7' }]}>
                        <View style={[styles.dot, { backgroundColor: c }]} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.title, { color: txt }]} numberOfLines={open ? undefined : 1}>{a.title}</Text>
                            <Text style={[styles.body, { color: sub }]} numberOfLines={open ? undefined : 2}>{a.body}</Text>
                            {!!a.actionUrl && (
                                <TouchableOpacity onPress={() => Linking.openURL(a.actionUrl).catch(() => {})} style={{ marginTop: 6 }}>
                                    <Text style={{ color: c, fontWeight: '700', fontSize: 13 }}>{a.actionLabel || 'Open'}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        {a.dismissible !== false && (
                            <TouchableOpacity onPress={() => dismiss(a)} hitSlop={10}>
                                <Ionicons name="close" size={18} color={sub} />
                            </TouchableOpacity>
                        )}
                    </View>
                );
            })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    openList: { maxHeight: 220 },
    board: { marginHorizontal: 12, marginTop: 6, marginBottom: 4, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 6 },
    headText: { fontSize: 13, fontWeight: '700', flex: 1 },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
    dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
    title: { fontSize: 14, fontWeight: '700' },
    body: { fontSize: 13, marginTop: 2 },
});
