import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../services/Logoutcall';
import socketService from '../services/socketService';
import {
    clearSuspension, getSuspension, refreshSuspension, requestReview, subscribeSuspension,
} from '../services/suspensionStore';

// Account suspend hone par poori app ke upar full-screen. Chats device par rehti hain (logout/wipe nahi hota),
// bas koi action nahi hota (server har likhne wali request par 403 ACCOUNT_SUSPENDED deta hai).
export const SUSPENSION_TEXT = 'This account can no longer use Telebook. Chats are still on this device. Request a review.';

export default function SuspensionGate() {
    const dispatch = useDispatch();
    const token = useSelector((s) => s.totalappData?.apiToken ?? null);
    const userId = useSelector((s) => s.totalappData?.userId ?? null);
    const wasSuspended = useRef(false);
    const [st, setSt] = useState(getSuspension());
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => subscribeSuspension(setSt), []);

    // App open / foreground: status poochho. Suspended ho to har 15s dobara (admin ka faisla jaldi dikhe)
    useEffect(() => {
        if (!token) { clearSuspension(); return undefined; }
        refreshSuspension();
        const sub = AppState.addEventListener('change', (n) => { if (n === 'active') refreshSuspension(); });
        return () => sub.remove();
    }, [token]);

    useEffect(() => {
        if (!token || !st.suspended) return undefined;
        const timer = setInterval(refreshSuspension, 15000);
        const onDecision = () => refreshSuspension();
        socketService.on?.('account:review-decision', onDecision);
        return () => { clearInterval(timer); socketService.off?.('account:review-decision', onDecision); };
    }, [token, st.suspended]);

    // Review accept hua: socket "suspended mode" me tha (online/chat events band) — naya connect karo
    useEffect(() => {
        if (wasSuspended.current && !st.suspended && token && userId) {
            socketService.disconnect();
            socketService.connect(token, userId);
        }
        wasSuspended.current = st.suspended;
    }, [st.suspended, token, userId]);

    if (!token || !st.suspended) return null;

    const rr = st.reviewRequest;
    const pending = rr?.status === 'pending';
    const rejected = rr?.status === 'rejected';

    const ask = async () => {
        setBusy(true); setErr('');
        const r = await requestReview();
        setBusy(false);
        if (!r.ok) setErr(r.message);
    };

    return (
        <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
            <StatusBar backgroundColor="#101418" barStyle="light-content" />
            <View style={styles.root}>
                <View style={styles.iconWrap}><Ionicons name="ban" size={46} color="#fff" /></View>
                <Text style={styles.title}>Account suspended</Text>
                <Text style={styles.msg}>{SUSPENSION_TEXT}</Text>
                {!!st.reason && <Text style={styles.reason}>Reason: {st.reason}</Text>}

                {pending && (
                    <View style={styles.note}>
                        <Ionicons name="time-outline" size={18} color="#f5c542" />
                        <Text style={styles.noteText}>Your review request has been sent. We will notify you once it is reviewed.</Text>
                    </View>
                )}
                {rejected && (
                    <View style={[styles.note, { borderColor: '#e57373' }]}>
                        <Ionicons name="close-circle-outline" size={18} color="#e57373" />
                        <Text style={styles.noteText}>Your last request was declined{rr?.adminNote ? `: ${rr.adminNote}` : '.'}</Text>
                    </View>
                )}
                {!!err && <Text style={styles.err}>{err}</Text>}

                <TouchableOpacity
                    style={[styles.btn, (pending || busy) && { opacity: 0.55 }]}
                    onPress={ask}
                    disabled={pending || busy}
                    activeOpacity={0.85}
                >
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{pending ? 'Review requested' : 'Request a review'}</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={refreshSuspension} style={styles.link}>
                    <Text style={styles.linkText}>Check status</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => logoutUser(null, dispatch)} style={styles.link}>
                    <Text style={[styles.linkText, { color: '#e57373' }]}>Log out</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#101418', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
    iconWrap: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#c0392b', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 10 },
    msg: { color: '#d5dbe0', fontSize: 15, lineHeight: 22, textAlign: 'center' },
    reason: { color: '#9aa4ad', fontSize: 13, marginTop: 10, textAlign: 'center' },
    note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1, borderColor: '#f5c542', borderRadius: 10, padding: 10, marginTop: 18 },
    noteText: { color: '#e8edf1', fontSize: 13, flex: 1 },
    err: { color: '#e57373', marginTop: 12, fontSize: 13, textAlign: 'center' },
    btn: { marginTop: 24, backgroundColor: '#1296f3', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 34, minWidth: 220, alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    link: { paddingVertical: 12 },
    linkText: { color: '#8ab4ff', fontSize: 14, fontWeight: '600' },
});
