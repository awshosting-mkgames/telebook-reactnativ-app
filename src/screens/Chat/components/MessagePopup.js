import { Ionicons } from '@expo/vector-icons';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const QUICK_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🙏'];

const MessagePopup = ({
    visible, message, isMine, onClose,
    onReply, onDelete, onDeleteForAll, onEdit,
    onForward, onStar, onReact, onBlock, onCopy, onSelect,
    isStarred, isSenderBlocked, theme,
}) => {
    if (!message) return null;
    const isDark = theme?.text === '#FFFFFF';

    const boxBg = isDark ? '#1f2c34' : '#ffffff';
    const labelC = isDark ? '#e9edef' : '#222222';
    const hrC = isDark ? '#2a3942' : '#f0f0f0';

    const hasText = !!message.content && message.messageType !== 'document';
    const actions = [
        { icon: 'return-down-back-outline', label: 'Reply', color: '#1296f3', fn: onReply },
        ...(hasText && onCopy ? [{ icon: 'copy-outline', label: 'Copy', color: '#16a085', fn: onCopy }] : []),
        ...(isMine && onEdit && message.messageType === 'text' && hasText ? [{ icon: 'create-outline', label: 'Edit', color: '#8e44ad', fn: onEdit }] : []),
        { icon: 'share-outline', label: 'Forward', color: '#5b5fc7', fn: onForward },
        { icon: isStarred ? 'star' : 'star-outline', label: isStarred ? 'Unstar' : 'Star', color: '#f0a500', fn: onStar },
        ...(onSelect ? [{ icon: 'checkmark-circle-outline', label: 'Select', color: '#1296f3', fn: onSelect }] : []),
        { icon: 'trash-outline', label: 'Delete for Me', color: '#e67e22', fn: onDelete },
        ...(isMine ? [{ icon: 'trash', label: 'Delete for Everyone', color: '#e74c3c', fn: onDeleteForAll }] : []),
        ...(!isMine && onBlock ? [{ icon: isSenderBlocked ? 'checkmark-circle-outline' : 'ban-outline', label: isSenderBlocked ? 'Unblock User' : 'Block User', color: '#888', fn: onBlock }] : []),
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
                    {/* Chhoti screen par saare actions scroll ho jayein */}
                    <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.6 }} bounces={false}>
                    {actions.map((a, i) => (
                        <TouchableOpacity key={i} style={styles.row} onPress={a.fn} activeOpacity={0.7}>
                            <View style={[styles.iconWrap, { backgroundColor: a.color + '18' }]}>
                                <Ionicons name={a.icon} size={20} color={a.color} />
                            </View>
                            <Text style={[styles.label, { color: labelC }]}>{a.label}</Text>
                            <Ionicons name="chevron-forward" size={16} color={isDark ? '#3a4a52' : '#ccc'} />
                        </TouchableOpacity>
                    ))}
                    </ScrollView>
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
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 11, gap: 14 },
    iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    label: { flex: 1, fontSize: 15, fontWeight: '500' },
});

export default MessagePopup;
