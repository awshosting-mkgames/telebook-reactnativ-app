// screens/Mychannelscreen/components/PostActions.js
// Channel post par long-press ka action sheet (Copy / Forward). Admin aur subscriber
// dono screens yahi use karte hain. Forward destination ke liye chat ka existing
// ForwardContactModal (read-only import) reuse hota hai.
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ForwardContactModal from '../../Chat/components/ForwardContactModal';
import { copyText, forwardChannelPost, showToast } from '../../../services/channelActions';

export default function PostActions({ post, channelId, onClose, colors = {} }) {
    const bg = colors.bg || '#ffffff';
    const text = colors.text || '#111111';
    const border = colors.border || '#e5e5e5';
    const accent = colors.accent || '#1199ff';

    const [forwardOpen, setForwardOpen] = useState(false);
    // In-flight guard: double-tap / retry se same post do baar forward na ho
    const sendingRef = useRef(false);

    const hasText = !!post?.content && String(post.content).trim().length > 0;
    const hasAny = hasText || (post?.attachments?.length ?? 0) > 0;

    const handleCopy = () => {
        copyText(post?.content);
        onClose();
    };

    const handleForwardSend = async (chatIds) => {
        if (sendingRef.current || !post?._id || !chatIds?.length) return;
        sendingRef.current = true;
        const postId = post._id;
        // Picker turant band — button dobara dabana possible hi nahi
        setForwardOpen(false);
        onClose();
        try {
            const res = await forwardChannelPost(channelId, postId, chatIds);
            if (res?.success) {
                showToast(chatIds.length > 1 ? `Forwarded to ${chatIds.length} chats` : 'Forwarded');
            } else {
                showToast('Forward failed', 'error', res?.error?.message || 'Please try again');
            }
        } catch {
            showToast('Forward failed', 'error', 'Please try again');
        } finally {
            sendingRef.current = false;
        }
    };

    return (
        <>
            <Modal
                visible={!!post && !forwardOpen}
                transparent
                animationType="fade"
                onRequestClose={onClose}
            >
                <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
                    <View style={[s.sheet, { backgroundColor: bg }]}>
                        <View style={[s.handle, { backgroundColor: border }]} />
                        {hasText && (
                            <TouchableOpacity style={s.row} onPress={handleCopy} activeOpacity={0.7}>
                                <Ionicons name="copy-outline" size={20} color={accent} />
                                <Text style={[s.rowText, { color: text }]}>Copy</Text>
                            </TouchableOpacity>
                        )}
                        {hasAny && (
                            <TouchableOpacity style={s.row} onPress={() => setForwardOpen(true)} activeOpacity={0.7}>
                                <Ionicons name="arrow-redo-outline" size={20} color={accent} />
                                <Text style={[s.rowText, { color: text }]}>Forward</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            <ForwardContactModal
                visible={!!post && forwardOpen}
                onClose={() => { setForwardOpen(false); onClose(); }}
                onForward={handleForwardSend}
            />
        </>
    );
}

const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 28, paddingTop: 10 },
    handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
    rowText: { fontSize: 16, fontWeight: '500' },
});
