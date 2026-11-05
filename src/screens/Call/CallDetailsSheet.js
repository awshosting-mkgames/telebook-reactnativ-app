import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import Config from '../../services/config';
import { startCall } from '../../services/callHelpers';
import { useNameResolver } from '../../services/nameResolver';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const toImageUrl = (v) => (!v ? DEFAULT_AVATAR : /^(https?:|file:|data:)/.test(v) ? v : `${Config.MEDIA_URL}${v}`);

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const fmtTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const h = d.getHours();
    return `${pad(h % 12 || 12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${h >= 12 ? 'PM' : 'AM'}`;
};
const fmtDuration = (sec) => {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
};

// Server status → user ko dikhne wala label
export const statusLabel = (c) => {
    if (!c) return '';
    if (c.status === 'missed') return c.direction === 'outgoing' ? 'Not answered' : 'Missed';
    if (c.status === 'ended') return c.acceptedAt ? 'Answered' : 'Ended';
    if (c.status === 'ongoing') return 'Ongoing';
    if (c.status === 'ringing') return 'Ringing';
    return c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : '';
};

// endReason sirf tab dikhao jab call me kuch gadbad hui (hangup/rejected/cancelled normal baatein hain)
const FAILURE_TEXT = {
    network: 'Network problem',
    failed: 'Call failed',
    timeout: 'Call timed out',
    insufficient_coins: 'Not enough coins',
    stale: 'Call ended unexpectedly',
    no_answer: 'No answer',
};
export const failureReason = (c) => (c?.endReason ? FAILURE_TEXT[c.endReason] || null : null);

const Row = ({ label, value, colors }) => (
    <View style={styles.row}>
        <Text style={[styles.label, { color: colors.sub }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.text }]} selectable>{value}</Text>
    </View>
);

/**
 * Call history ki entry dabane par khulne wala bottom sheet.
 * `call` = GET /calls item; khulte hi GET /calls/:id se taza detail leta hai.
 */
export default function CallDetailsSheet({ call, onClose, navigation }) {
    const { theme } = useContext(ThemeContext);
    const resolveName = useNameResolver();
    const myId = useSelector((s) => s.totalappData?.userId ?? null);
    const [full, setFull] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setFull(null);
        if (!call?._id) return undefined;
        let live = true;
        apiService({ method: 'GET', endpoint: `calls/${call._id}` }).then((res) => {
            const c = res?.data?.data?.call;
            if (live && res?.success && c) setFull(c);
        });
        return () => { live = false; };
    }, [call?._id]);

    if (!call) return null;
    const c = { ...call, ...(full || {}) };
    const dark = theme?.mode === 'dark';
    const colors = { text: theme.text, sub: dark ? '#9aa0a6' : '#666', sheet: dark ? '#1f2c34' : '#fff', line: dark ? '#2d3a42' : '#eee' };
    const name = resolveName(c.user);
    const outgoing = c.direction === 'outgoing';
    const missed = !!c.missed;
    const fail = failureReason(c);
    const phone = c.user?.mobile || '—';

    const ring = (type) => {
        if (!c.user?._id) return;
        onClose();
        startCall({
            navigation, calleeId: c.user._id, type,
            remoteUser: { _id: c.user._id, name: name.title, mobile: c.user.mobile, profilePicture: c.user.profilePicture },
        });
    };

    // Is user ke saath 1-to-1 chat (nahi hai to server banata hai)
    const withChat = async (go) => {
        if (!c.user?._id || busy) return;
        setBusy(true);
        const res = await apiService({ method: 'POST', endpoint: 'chats', data: { userId: c.user._id } });
        setBusy(false);
        const chat = res?.data?.chat;
        if (!res?.success || !chat?._id) { Alert.alert('Error', 'Could not open the chat. Please try again.'); return; }
        onClose();
        const other = (chat.users || []).find((u) => u?._id !== myId) || c.user;
        go(chat, other);
    };
    const openChat = () => withChat((chat, other) => navigation.navigate('Chat', {
        chatId: chat._id, chatName: name.title, chatImage: other?.profilePicture, isGroup: false, otherUserId: c.user._id,
    }));
    const viewProfile = () => withChat((chat) => navigation.navigate('ChatUserDetailScreen', { chatId: chat._id }));

    const Action = ({ icon, label, onPress, tint }) => (
        <TouchableOpacity style={styles.action} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.actionIcon, { backgroundColor: (tint || theme.main) + '22' }]}>
                <Ionicons name={icon} size={22} color={tint || theme.main} />
            </View>
            <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={1}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <Modal visible transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} />
            <View style={[styles.sheet, { backgroundColor: colors.sheet }]}>
                <View style={[styles.grab, { backgroundColor: colors.line }]} />
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
                    <View style={styles.head}>
                        <Image source={{ uri: toImageUrl(c.user?.profilePicture) }} style={styles.avatar} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name.title}</Text>
                            <View style={styles.chipRow}>
                                <MaterialIcons name={missed ? 'call-missed' : outgoing ? 'call-made' : 'call-received'} size={16}
                                    color={missed || outgoing ? '#e53935' : '#2e7d32'} />
                                <Text style={[styles.chip, { color: missed || outgoing ? '#e53935' : '#2e7d32' }]}>
                                    {' '}{outgoing ? 'Outgoing' : 'Incoming'} {c.type === 'video' ? 'video' : 'audio'} call
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.card, { borderColor: colors.line }]}>
                        <Row colors={colors} label="Phone number" value={phone} />
                        <Row colors={colors} label="Call type" value={c.type === 'video' ? 'Video call' : 'Audio call'} />
                        <Row colors={colors} label="Direction" value={outgoing ? 'Outgoing' : 'Incoming'} />
                        <Row colors={colors} label="Status" value={statusLabel(c)} />
                        {!!fail && <Row colors={colors} label="Reason" value={fail} />}
                        <Row colors={colors} label="Date" value={fmtDate(c.startedAt)} />
                        <Row colors={colors} label="Start time" value={fmtTime(c.acceptedAt || c.startedAt)} />
                        <Row colors={colors} label="End time" value={fmtTime(c.endedAt)} />
                        <Row colors={colors} label="Duration" value={c.acceptedAt || c.durationSeconds ? fmtDuration(c.durationSeconds) : '00:00'} />
                        <Row colors={colors} label="Call ID" value={c._id} />
                    </View>

                    <View style={styles.actions}>
                        <Action icon="call" label="Audio Call" onPress={() => ring('audio')} tint="#2ecc71" />
                        <Action icon="videocam" label="Video Call" onPress={() => ring('video')} tint="#2ecc71" />
                        <Action icon="chatbubble-ellipses" label="Open Chat" onPress={openChat} />
                        <Action icon="person-circle" label="View Profile" onPress={viewProfile} />
                    </View>
                    {busy && <ActivityIndicator color={theme.main} style={{ marginTop: 8 }} />}
                    <TouchableOpacity style={[styles.close, { borderColor: colors.line }]} onPress={onClose} activeOpacity={0.7}>
                        <Text style={[styles.closeText, { color: colors.text }]}>Close</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8, maxHeight: '88%' },
    grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#ddd' },
    name: { fontSize: 18, fontWeight: '700' },
    chipRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    chip: { fontSize: 13, fontWeight: '500' },
    card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, gap: 12 },
    label: { fontSize: 13 },
    value: { fontSize: 13, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
    actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
    action: { flex: 1, alignItems: 'center', gap: 6 },
    actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    actionText: { fontSize: 12, fontWeight: '500' },
    close: { marginTop: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    closeText: { fontSize: 15, fontWeight: '600' },
});
