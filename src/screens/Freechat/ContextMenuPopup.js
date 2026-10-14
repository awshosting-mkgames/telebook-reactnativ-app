// components/ContextMenuPopup.js
import React, { useRef, useEffect } from 'react';
import {
    View, Text, Image, TouchableOpacity, StyleSheet,
    Modal, Animated, Alert,
} from 'react-native';
import { TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const lastMsgPreview = (lastMsg) => {
    if (!lastMsg) return 'No messages yet';
    if (lastMsg.isDeleted) return '🚫 Message deleted';
    if (lastMsg.messageType === 'image') return '📷 Photo';
    if (lastMsg.messageType === 'video') return '🎥 Video';
    if (lastMsg.messageType === 'audio') return '🎤 Voice';
    if (lastMsg.messageType === 'document') return '📄 Document';
    return lastMsg.content || 'No messages yet';
};

export default function ContextMenuPopup({ visible, item, onClose, onPin, onDelete, onBlock, isPinned, isBlocked }) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 18 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!item) return null;

    const isGroup = item?.isGroupChat;

    const handlePin = () => {
        onClose();
        setTimeout(() => onPin(item), 150); // slight delay so modal closes first smoothly
    };

    const handleDelete = () => {
        onClose();
        Alert.alert(
            'Delete Chat',
            `"${item.displayName}" ka chat delete karna chahte ho?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(item) },
            ]
        );
    };

    const handleBlock = () => {
        onClose();
        if (isBlocked) {
            Alert.alert('Unblock Contact', `Unblock ${item.displayName}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Unblock', onPress: () => onBlock(item) },
            ]);
            return;
        }
        Alert.alert(
            'Block Contact',
            `Block ${item.displayName}? They won't be able to send you messages.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Block', style: 'destructive', onPress: () => onBlock(item) },
            ]
        );
    };

    const menuItems = [
        {
            icon: isPinned ? 'pin' : 'pin-outline',
            label: isPinned ? 'Unpin Chat' : 'Pin Chat',
            iconBg: '#e8f4ff',
            iconColor: '#1199ff',
            textColor: '#1a1a1a',
            onPress: handlePin,
            show: true,
        },
        {
            icon: isBlocked ? 'checkmark-circle-outline' : 'ban-outline',
            label: isBlocked ? 'Unblock Contact' : 'Block Contact',
            iconBg: '#fff3e0',
            iconColor: '#FF9500',
            textColor: '#1a1a1a',
            onPress: handleBlock,
            show: !isGroup,
        },
        {
            icon: 'trash-outline',
            label: 'Delete Chat',
            iconBg: '#ffebea',
            iconColor: '#FF3B30',
            textColor: '#FF3B30',
            onPress: handleDelete,
            show: true,
        },
    ].filter(m => m.show);

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <Animated.View style={[styles.popup, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>

                            {/* Header */}
                            <View style={styles.header}>
                                <Image
                                    source={{ uri: item.displayAvatar || DEFAULT_AVATAR }}
                                    style={styles.headerAvatar}
                                    defaultSource={{ uri: DEFAULT_AVATAR }}
                                />
                                <View style={styles.headerInfo}>
                                    <Text style={styles.headerName} numberOfLines={1}>{item.displayName}</Text>
                                    <Text style={styles.headerMsg} numberOfLines={1}>
                                        {lastMsgPreview(item?.latestMessage)}
                                    </Text>
                                </View>
                                {!isGroup && item?.displayUser?.isOnline && (
                                    <View style={styles.onlineBadge}>
                                        <View style={styles.onlineDot} />
                                        <Text style={styles.onlineBadgeText}>Online</Text>
                                    </View>
                                )}
                            </View>

                            {/* Menu Items */}
                            <View style={styles.menuBody}>
                                {menuItems.map((m, i) => (
                                    <React.Fragment key={m.label}>
                                        <TouchableOpacity style={styles.menuItem} onPress={m.onPress} activeOpacity={0.7}>
                                            <View style={[styles.menuIconWrap, { backgroundColor: m.iconBg }]}>
                                                <Ionicons name={m.icon} size={20} color={m.iconColor} />
                                            </View>
                                            <Text style={[styles.menuLabel, { color: m.textColor }]}>{m.label}</Text>
                                            <Ionicons name="chevron-forward" size={16} color="#ddd" />
                                        </TouchableOpacity>
                                        {i < menuItems.length - 1 && <View style={styles.itemDivider} />}
                                    </React.Fragment>
                                ))}
                            </View>

                            <View style={styles.divider} />

                            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    popup: { width: '100%', backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1199ff', paddingHorizontal: 18, paddingVertical: 16, gap: 12 },
    headerAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: '#cce5ff' },
    headerInfo: { flex: 1 },
    headerName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 3 },
    headerMsg: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
    onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(37,211,102,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#25D366' },
    onlineBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    menuBody: { paddingVertical: 6 },
    divider: { height: 0.5, backgroundColor: '#f0f0f0' },
    itemDivider: { height: 0.5, backgroundColor: '#f5f5f5', marginLeft: 68 },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 15, gap: 14 },
    menuIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    menuLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
    cancelBtn: { alignItems: 'center', paddingVertical: 16 },
    cancelText: { color: '#1199ff', fontSize: 15, fontWeight: '700' },
});