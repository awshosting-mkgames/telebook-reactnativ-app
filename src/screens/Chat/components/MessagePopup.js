import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const QUICK_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🙏', '❌', '❓', '✅'];

const MessagePopup = ({
    visible, message, isMine, onClose,
    onReply, onDelete, onDeleteForAll, onEdit,
    onForward, onStar, onReact, onBlock, onCopy, onSelect,
    isStarred, isSenderBlocked, theme, canEdit = true, canDeleteForAll = true, canModerate = false,
    anchor = null,   // pressed bubble ki window position {x,y,w,h} (na ho to screen ke beech me)
}) => {
    const insets = useSafeAreaInsets();
    const [boxH, setBoxH] = useState(0);
    if (!message) return null;
    const isDark = theme?.mode ? theme.mode === 'dark' : theme?.text === '#FFFFFF';

    const boxBg = isDark ? '#1f2c34' : '#ffffff';
    const labelC = isDark ? '#e9edef' : '#222222';
    const hrC = isDark ? '#2a3942' : '#f0f0f0';

    const hasText = !!message.content && message.messageType !== 'document';
    const actions = [
        { icon: 'return-down-back-outline', label: 'Reply', color: theme?.main ?? '#1296f3', fn: onReply },
        ...(hasText && onCopy ? [{ icon: 'copy-outline', label: 'Copy', color: '#16a085', fn: onCopy }] : []),
        ...(isMine && canEdit && onEdit && message.messageType === 'text' && hasText ? [{ icon: 'create-outline', label: 'Edit', color: '#8e44ad', fn: onEdit }] : []),
        { icon: 'share-outline', label: 'Forward', color: '#5b5fc7', fn: onForward },
        ...(onSelect ? [{ icon: 'checkmark-circle-outline', label: 'Select', color: theme?.main ?? '#1296f3', fn: onSelect }] : []),
        { icon: 'trash-outline', label: 'Delete for Me', color: '#e67e22', fn: onDelete },
        ...((isMine || canModerate) && canDeleteForAll ? [{ icon: 'trash', label: 'Delete for Everyone', color: '#e74c3c', fn: onDeleteForAll }] : []),
        ...(!isMine && onBlock ? [{ icon: isSenderBlocked ? 'checkmark-circle-outline' : 'ban-outline', label: isSenderBlocked ? 'Unblock User' : 'Block User', color: '#888', fn: onBlock }] : []),
    ];

    // Box ko pressed message ke theek neeche (jagah na ho to upar) rakho, header ke neeche / keyboard-screen ke andar clamp.
    // Height pata chalne tak (pehla layout) transparent rakhte hain taaki beech me kood na dikhe.
    const winH = Dimensions.get('window').height;
    const minTop = insets.top + 12;
    const maxTop = Math.max(minTop, winH - boxH - insets.bottom - 16);
    let top = Math.max(minTop, Math.min(maxTop, (winH - boxH) / 2));
    if (anchor && Number.isFinite(anchor.y)) {
        const below = anchor.y + anchor.h + 10;
        const above = anchor.y - boxH - 10;
        const pick = below <= maxTop ? below : (above >= minTop ? above : below);
        top = Math.max(minTop, Math.min(maxTop, pick));
    }

    return (
        <Modal statusBarTranslucent visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable
                    onLayout={(e) => setBoxH(e.nativeEvent.layout.height)}
                    style={[styles.box, { backgroundColor: boxBg, position: 'absolute', top, left: 24, right: 24, opacity: boxH ? 1 : 0 }]}
                    onPress={() => { }}
                >
                    {/* 9 emoji ek row me nahi aate — horizontally scroll */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow}>
                        {QUICK_EMOJIS.map(e => (
                            <TouchableOpacity key={e} onPress={() => onReact(e)} style={styles.eBtn}>
                                <Text style={styles.emoji}>{e}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <View style={[styles.hr, { backgroundColor: hrC }]} />
                    {/* Chhoti screen par saare actions scroll ho jayein */}
                    <ScrollView style={{ maxHeight: winH * 0.55 }} bounces={false}>
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
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    box: { borderRadius: 20, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16 },
    emojiRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, gap: 6 },
    eBtn: { padding: 4 },
    emoji: { fontSize: 30 },
    hr: { height: 0.5 },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 9, gap: 14 },
    iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    label: { flex: 1, fontSize: 15, fontWeight: '500' },
});

export default MessagePopup;
