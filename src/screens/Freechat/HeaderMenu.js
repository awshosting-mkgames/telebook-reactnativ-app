// components/HeaderMenu.js
import React, { useRef, useEffect, useContext } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Modal, Animated, Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import { TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';

export default function HeaderMenu({ visible, onClose, onProfile, onSyncData, syncing }) {
    const { theme } = useContext(ThemeContext);
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    const isDark = theme.text === '#FFFFFF';

    // Dark mode = black popup, white text
    // Light mode = white popup, black text
    const popupBg = isDark ? '#111111' : '#ffffff';
    const labelColor = isDark ? '#ffffff' : '#1a1a1a';
    const sublabelColor = isDark ? '#888888' : '#aaaaaa';
    const dividerColor = isDark ? '#2a2a2a' : '#f0f0f0';
    const borderColor = isDark ? '#2a2a2a' : '#e8e8e8';

    const iconBgs = {
        sync: isDark ? '#0d1e2e' : '#e8f4ff',
        profile: isDark ? '#0d1e18' : '#e8faf0',
    };

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 6, speed: 20 }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!visible) return null;

    // Contact sync yahan se hata diya gaya hai — wo ab sirf OTP success par
    // aur Settings → Contact Sync se chalta hai.
    // Ye Sync Data chaaron chat tabs ka manual full refresh hai.
    const ITEMS = [
        {
            icon: 'refresh-outline',
            label: syncing ? 'Syncing...' : 'Sync Data',
            sublabel: 'Refresh all chat tabs',
            color: '#1199ff',
            bg: iconBgs.sync,
            onPress: onSyncData,
            disabled: syncing,
        },
        {
            icon: 'person-outline',
            label: 'My Profile',
            sublabel: 'View & edit your profile',
            color: '#25D366',
            bg: iconBgs.profile,
            onPress: onProfile,
            disabled: false,
        },
    ];

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <Animated.View style={[
                            styles.popup,
                            {
                                backgroundColor: popupBg,
                                borderColor: borderColor,
                                opacity: opacityAnim,
                                transform: [{ scale: scaleAnim }],
                            }
                        ]}>
                            {ITEMS.map((item, i) => (
                                <React.Fragment key={item.label}>
                                    <TouchableOpacity
                                        style={[styles.item, item.disabled && styles.itemDisabled]}
                                        onPress={() => { onClose(); item.onPress(); }}
                                        activeOpacity={0.7}
                                        disabled={item.disabled}
                                    >
                                        <View style={[styles.iconWrap, { backgroundColor: item.bg }]}>
                                            {item.disabled ? (
                                                <ActivityIndicator size="small" color={item.color} />
                                            ) : (
                                                <Ionicons name={item.icon} size={18} color={item.color} />
                                            )}
                                        </View>
                                        <View style={styles.itemText}>
                                            <Text style={[
                                                styles.label,
                                                { color: labelColor },
                                                item.disabled && { color: sublabelColor },
                                            ]}>
                                                {item.label}
                                            </Text>
                                            <Text style={[styles.sublabel, { color: sublabelColor }]}>
                                                {item.sublabel}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                    {i < ITEMS.length - 1 && (
                                        <View style={[styles.divider, { backgroundColor: dividerColor }]} />
                                    )}
                                </React.Fragment>
                            ))}
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'transparent' },
    popup: {
        position: 'absolute',
        top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 54 : 54,
        right: 12,
        borderRadius: 16,
        borderWidth: 0.5,
        overflow: 'hidden',
        minWidth: 220,
        elevation: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
    },
    item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    itemDisabled: { opacity: 0.5 },
    iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    itemText: { flex: 1 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 1 },
    sublabel: { fontSize: 11 },
    divider: { height: 0.5, marginLeft: 66 },
});