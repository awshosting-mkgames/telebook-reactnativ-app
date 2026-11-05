import { Ionicons } from '@expo/vector-icons';
import { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import GradientFill from '../../components/GradientFill';
import apiService from '../../services/apiService';
import { useHeaderMetrics } from '../../utils/headerMetrics';
import { FALLBACK_AVATAR, imgUrl } from '../Updates/statusUtils';

const MODES = [
    { key: 'contacts', title: 'My contacts', sub: 'All your contacts can see your status' },
    { key: 'except', title: 'My contacts except…', sub: 'Hide your status from selected contacts' },
    { key: 'only', title: 'Only share with…', sub: 'Only selected contacts can see your status' },
];

/**
 * Status privacy. Server har status read par isi setting ko lagu karta hai, isliye badalte hi
 * maujooda active statuses par bhi asar hota hai (naya + purana dono) — app me kuch alag karna nahi.
 */
export default function StatusPrivacy({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const { top, height } = useHeaderMetrics();
    const contacts = useSelector((s) => s.contacts?.contacts ?? []);
    const dark = theme?.mode === 'dark';
    const c = { text: theme.text, sub: dark ? '#9aa0a6' : '#666', line: dark ? '#2d3a42' : '#eee', card: dark ? '#1f2c34' : '#fff' };

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [mode, setMode] = useState('contacts');
    const [picked, setPicked] = useState(() => new Set());
    const [extra, setExtra] = useState([]);       // pehle se chune hue, par contacts me nahi
    const [query, setQuery] = useState('');

    useEffect(() => {
        (async () => {
            const res = await apiService({ method: 'GET', endpoint: 'status/privacy' });
            const d = res?.data?.data;
            if (res?.success && d) {
                setMode(d.mode === 'only' ? 'only' : d.mode === 'except' ? 'except' : 'contacts');
                const list = d.mode === 'only' ? d.only : d.mode === 'except' ? d.except : [];
                setPicked(new Set((list || []).map((u) => String(u._id ?? u))));
                setExtra((list || []).filter((u) => u && u._id));
            } else {
                Toast.show({ type: 'error', text1: 'Could not load status privacy' });
            }
            setLoading(false);
        })();
    }, []);

    const people = useMemo(() => {
        const map = new Map();
        contacts.filter((x) => x?.isRegistered && x?.appUser?._id).forEach((x) => {
            map.set(String(x.appUser._id), { id: String(x.appUser._id), name: x.name || x.displayName || x.phone || 'User', avatar: x.avatar || x.appUser.profilePicture, sub: x.phone });
        });
        extra.forEach((u) => { if (!map.has(String(u._id))) map.set(String(u._id), { id: String(u._id), name: u.name || u.mobile || 'User', avatar: u.profilePicture, sub: u.mobile }); });
        const q = query.trim().toLowerCase();
        return [...map.values()]
            .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sub || '').includes(q))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [contacts, extra, query]);

    const toggle = (id) => setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const save = async () => {
        if (saving) return;
        if (mode === 'only' && picked.size === 0) { Toast.show({ type: 'error', text1: 'Choose at least one contact' }); return; }
        setSaving(true);
        const res = await apiService({ method: 'POST', endpoint: 'status/privacy', data: { mode, userIds: mode === 'contacts' ? [] : [...picked] } });
        setSaving(false);
        if (res?.success) { Toast.show({ type: 'success', text1: 'Status privacy saved' }); navigation.goBack(); }
        else Toast.show({ type: 'error', text1: res?.error?.message || 'Could not save. Please try again.' });
    };

    const showList = mode !== 'contacts';
    return (
        <View style={[styles.root, { backgroundColor: theme.background }]}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            <View style={[styles.header, { height, paddingTop: top, backgroundColor: theme?.header || '#1199ff' }]}>
                <GradientFill />
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={{ padding: 6 }}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>Status privacy</Text>
                <TouchableOpacity onPress={save} disabled={saving || loading} hitSlop={10} style={{ padding: 6 }}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.save}>Save</Text>}
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator color={theme.main} style={{ marginTop: 40 }} /> : (
                <>
                    <Text style={[styles.note, { color: c.sub }]}>Who can see my status updates. Applies to all active statuses.</Text>
                    {MODES.map((m) => (
                        <TouchableOpacity key={m.key} style={[styles.mode, { borderBottomColor: c.line }]} onPress={() => setMode(m.key)} activeOpacity={0.7}>
                            <Ionicons name={mode === m.key ? 'radio-button-on' : 'radio-button-off'} size={22} color={theme.main} style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.modeTitle, { color: c.text }]}>{m.title}</Text>
                                <Text style={[styles.modeSub, { color: c.sub }]}>{m.sub}</Text>
                            </View>
                            {m.key !== 'contacts' && mode === m.key && <Text style={{ color: theme.main, fontWeight: '600' }}>{picked.size}</Text>}
                        </TouchableOpacity>
                    ))}

                    {showList && (
                        <>
                            <View style={[styles.search, { backgroundColor: c.card, borderColor: c.line }]}>
                                <Ionicons name="search" size={18} color={c.sub} />
                                <TextInput style={[styles.searchInput, { color: c.text }]} value={query} onChangeText={setQuery} placeholder="Search contacts" placeholderTextColor={c.sub} />
                            </View>
                            <FlatList
                                data={people}
                                keyExtractor={(p) => p.id}
                                keyboardShouldPersistTaps="handled"
                                ListEmptyComponent={<Text style={[styles.empty, { color: c.sub }]}>No contacts on Telebook found</Text>}
                                renderItem={({ item }) => {
                                    const on = picked.has(item.id);
                                    return (
                                        <TouchableOpacity style={styles.person} onPress={() => toggle(item.id)} activeOpacity={0.7}>
                                            <Image source={{ uri: imgUrl(item.avatar) || FALLBACK_AVATAR }} style={styles.avatar} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.pName, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
                                                {!!item.sub && <Text style={[styles.pSub, { color: c.sub }]}>{item.sub}</Text>}
                                            </View>
                                            <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? theme.main : c.sub} />
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </>
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, overflow: 'hidden' },
    title: { flex: 1, color: '#fff', fontSize: 19, fontWeight: '700', marginLeft: 8 },
    save: { color: '#fff', fontSize: 16, fontWeight: '700' },
    note: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 12 },
    mode: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
    modeTitle: { fontSize: 15, fontWeight: '600' },
    modeSub: { fontSize: 12, marginTop: 2 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
    searchInput: { flex: 1, paddingVertical: 9, fontSize: 14 },
    person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
    avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ddd' },
    pName: { fontSize: 15, fontWeight: '500' },
    pSub: { fontSize: 12 },
    empty: { textAlign: 'center', paddingVertical: 30 },
});
