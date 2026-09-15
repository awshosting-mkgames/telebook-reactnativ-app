import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const QUICK_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🙏'];

const MessagePopup = ({
    visible, message, isMine, onClose,
    onReply, onDelete, onDeleteForAll,
    onForward, onStar, onReact, onBlock, theme,
}) => {
    if (!message) return null;
    const isDark = theme?.text === '#FFFFFF';

    const boxBg = isDark ? '#1f2c34' : '#ffffff';
    const labelC = isDark ? '#e9edef' : '#222222';
    const hrC = isDark ? '#2a3942' : '#f0f0f0';

    const actions = [
        { icon: 'return-down-back-outline', label: 'Reply', color: '#1296f3', fn: onReply },
        { icon: 'share-outline', label: 'Forward', color: '#5b5fc7', fn: onForward },
        { icon: 'star-outline', label: 'Star', color: '#f0a500', fn: onStar },
        { icon: 'trash-outline', label: 'Delete for Me', color: '#e67e22', fn: onDelete },
        ...(isMine ? [{ icon: 'trash', label: 'Delete for Everyone', color: '#e74c3c', fn: onDeleteForAll }] : []),
        ...(!isMine && onBlock ? [{ icon: 'ban-outline', label: 'Block User', color: '#888', fn: onBlock }] : []),
    ];

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={[styles.box, { backgroundColor: boxBg }]} onPress={() => { }}>
                    <View style={styles.emojiRow}>
                        {QUICK_EMOJIS.map(e => (
                            <TouchableOpacity key={e} onPress={() => onReact(e)} style={styles.eBtn}>
                                <Text style={styles.emoji}>{e}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={[styles.hr, { backgroundColor: hrC }]} />
                    {actions.map((a, i) => (
                        <TouchableOpacity key={i} style={styles.row} onPress={a.fn} activeOpacity={0.7}>
                            <View style={[styles.iconWrap, { backgroundColor: a.color + '18' }]}>
                                <Ionicons name={a.icon} size={20} color={a.color} />
                            </View>
                            <Text style={[styles.label, { color: labelC }]}>{a.label}</Text>
                            <Ionicons name="chevron-forward" size={16} color={isDark ? '#3a4a52' : '#ccc'} />
                        </TouchableOpacity>
                    ))}
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    box: { width: '100%', borderRadius: 20, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16 },
    emojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, paddingHorizontal: 8 },
    eBtn: { padding: 4 },
    emoji: { fontSize: 30 },
    hr: { height: 0.5 },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
    iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    label: { flex: 1, fontSize: 15, fontWeight: '500' },
});

export default MessagePopup;
