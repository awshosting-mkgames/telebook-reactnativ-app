import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../../../components/ThemeContext';
import apiService from '../../../services/apiService';
import { useNameResolver } from '../../../services/nameResolver';

// Is chat ke starred messages (GET /messages/starred sab chats ke deta hai — chatId se filter).
export default function StarredMessagesModal({ visible, chatId, myUserId, onClose, onUnstar }) {
    const insets = useSafeAreaInsets();
    const { theme } = useContext(ThemeContext);
    const resolveName = useNameResolver();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const isDark = theme?.mode === 'dark';
    const bg = isDark ? '#121212' : '#f2f4f7';
    const card = isDark ? '#1e1e1e' : '#fff';
    const txt = isDark ? '#f0f0f0' : '#1a1a1a';
    const sub = isDark ? '#9a9a9a' : '#8a8f98';

    useEffect(() => {
        if (!visible) return undefined;
        let alive = true;
        setLoading(true); setError(null);
        apiService({ method: 'GET', endpoint: 'messages/starred' }).then((res) => {
            if (!alive) return;
            if (!res?.success) { setError('Starred messages load nahi hue'); setLoading(false); return; }
            const list = res.data?.messages ?? [];
            setItems(list.filter((m) => String(m.chat?._id ?? m.chat) === String(chatId)));
            setLoading(false);
        });
        return () => { alive = false; };
    }, [visible, chatId]);

    const preview = (m) => (m.messageType && m.messageType !== 'text' ? `📎 ${m.messageType}${m.content ? ` · ${m.content}` : ''}` : m.content);

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={[styles.root, { backgroundColor: bg }]}>
                <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: theme?.header ?? '#1296f3' }]}>
                    <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
                    <Text style={styles.title}>Starred messages</Text>
                </View>
                {loading ? <ActivityIndicator style={{ marginTop: 40 }} color="#1296f3" />
                    : error ? <Text style={[styles.empty, { color: sub }]}>{error}</Text>
                    : (
                        <FlatList
                            data={items}
                            keyExtractor={(m) => m._id}
                            contentContainerStyle={{ padding: 12, flexGrow: 1 }}
                            ListEmptyComponent={<Text style={[styles.empty, { color: sub }]}>Is chat me koi starred message nahi hai</Text>}
                            renderItem={({ item }) => {
                                const mine = String(item.sender?._id ?? item.sender) === String(myUserId);
                                return (
                                    <View style={[styles.row, { backgroundColor: card }]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.name, { color: '#1296f3' }]} numberOfLines={1}>{mine ? 'You' : resolveName(item.sender).title}</Text>
                                            <Text style={{ color: txt, marginTop: 2 }} numberOfLines={4}>{preview(item)}</Text>
                                            <Text style={[styles.time, { color: sub }]}>{moment(item.createdAt).format('DD MMM, hh:mm A')}</Text>
                                        </View>
                                        <Ionicons name="star" size={18} color="#f0a500" />
                                    </View>
                                );
                            }}
                        />
                    )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 14 },
    title: { color: '#fff', fontSize: 18, fontWeight: '600' },
    empty: { textAlign: 'center', marginTop: 60, fontSize: 14, paddingHorizontal: 24 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12, marginBottom: 8 },
    name: { fontSize: 13, fontWeight: '700' },
    time: { fontSize: 11, marginTop: 4 },
});
