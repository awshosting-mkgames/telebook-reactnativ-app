import { Ionicons } from '@expo/vector-icons';
import { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import { useNameResolver } from '../../services/nameResolver';
import { FALLBACK_AVATAR, fmtClock, fmtDay, imgUrl } from './statusUtils';

/**
 * Status ke viewers (sirf owner dekh sakta hai — server bhi isi ko allow karta hai).
 * Latest view upar. Row: photo, naam, din + samay, (reaction). Chat icon = seedha chat, person icon = profile.
 */
export default function StatusViewersSheet({ visible, statusId, navigation, onClose, onNavigate }) {
    const { theme } = useContext(ThemeContext);
    const resolveName = useNameResolver();
    const myId = useSelector((s) => s.totalappData?.userId ?? null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const dark = theme?.mode === 'dark';
    const c = { sheet: dark ? '#1f2c34' : '#fff', text: theme.text, sub: dark ? '#9aa0a6' : '#666', line: dark ? '#2d3a42' : '#eee' };

    const load = useCallback(async () => {
        if (!statusId) return;
        setLoading(true); setError(null);
        const res = await apiService({ method: 'GET', endpoint: `status/${statusId}/viewers` });
        setLoading(false);
        if (res?.success && res.data?.data) setData(res.data.data);
        else setError(res?.status === 404 ? 'This status is no longer available' : 'Could not load viewers');
    }, [statusId]);

    useEffect(() => { if (visible) { setData(null); load(); } }, [visible, statusId, load]);

    const openChatWith = async (user, screen) => {
        const res = await apiService({ method: 'POST', endpoint: 'chats', data: { userId: user._id } });
        const chat = res?.data?.chat;
        if (!res?.success || !chat?._id) { Alert.alert('Error', 'Could not open the chat. Please try again.'); return; }
        onClose();
        onNavigate && onNavigate();   // status viewer band
        const other = (chat.users || []).find((u) => u?._id !== myId) || user;
        if (screen === 'profile') navigation?.navigate?.('ChatUserDetailScreen', { chatId: chat._id });
        else navigation?.navigate?.('Chat', { chatId: chat._id, chatName: resolveName(user).title, chatImage: other?.profilePicture, isGroup: false, otherUserId: user._id });
    };

    const count = data?.count;
    return (
        <Modal visible={visible} transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} />
            <View style={[styles.sheet, { backgroundColor: c.sheet }]}>
                <View style={[styles.grab, { backgroundColor: c.line }]} />
                <Text style={[styles.title, { color: c.text }]}>My Status</Text>
                <Text style={[styles.sub, { color: c.sub }]}>
                    {data?.receiptsOff ? 'Turn on read receipts to see who viewed' : `Views: ${count ?? '—'}`}
                </Text>

                {loading ? <ActivityIndicator color={theme.main} style={{ marginVertical: 30 }} />
                    : error ? (
                        <View style={styles.center}>
                            <Text style={{ color: c.sub }}>{error}</Text>
                            <TouchableOpacity onPress={load} style={[styles.retry, { borderColor: theme.main }]}><Text style={{ color: theme.main }}>Retry</Text></TouchableOpacity>
                        </View>
                    ) : (
                        <FlatList
                            data={data?.viewers || []}
                            keyExtractor={(v) => String(v.user?._id)}
                            style={{ maxHeight: 420 }}
                            ListEmptyComponent={<Text style={[styles.empty, { color: c.sub }]}>{data?.receiptsOff ? '' : 'No views yet'}</Text>}
                            renderItem={({ item }) => {
                                const n = resolveName(item.user);
                                return (
                                    <View style={[styles.row, { borderBottomColor: c.line }]}>
                                        <Image source={{ uri: imgUrl(item.user.profilePicture) || FALLBACK_AVATAR }} style={styles.avatar} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{n.title}</Text>
                                            {!!item.user.mobile && !n.isSaved && <Text style={[styles.meta, { color: c.sub }]}>{item.user.mobile}</Text>}
                                            <Text style={[styles.meta, { color: c.sub }]}>{fmtDay(item.viewedAt)}, {fmtClock(item.viewedAt)}</Text>
                                        </View>
                                        {!!item.reaction && <Text style={styles.reaction}>{item.reaction}</Text>}
                                        <TouchableOpacity hitSlop={8} style={styles.iconBtn} onPress={() => openChatWith(item.user, 'chat')}>
                                            <Ionicons name="chatbubble-ellipses-outline" size={21} color={theme.main} />
                                        </TouchableOpacity>
                                        <TouchableOpacity hitSlop={8} style={styles.iconBtn} onPress={() => openChatWith(item.user, 'profile')}>
                                            <Ionicons name="person-circle-outline" size={23} color={c.sub} />
                                        </TouchableOpacity>
                                    </View>
                                );
                            }}
                        />
                    )}
                <TouchableOpacity style={[styles.close, { borderColor: c.line }]} onPress={onClose}>
                    <Text style={{ color: c.text, fontWeight: '600' }}>Close</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18, maxHeight: '75%' },
    grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
    title: { fontSize: 17, fontWeight: '700' },
    sub: { fontSize: 13, marginTop: 2, marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
    avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ddd' },
    name: { fontSize: 15, fontWeight: '600' },
    meta: { fontSize: 12, marginTop: 1 },
    reaction: { fontSize: 20 },
    iconBtn: { padding: 4 },
    center: { alignItems: 'center', paddingVertical: 24, gap: 10 },
    retry: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
    empty: { textAlign: 'center', paddingVertical: 24 },
    close: { marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});
