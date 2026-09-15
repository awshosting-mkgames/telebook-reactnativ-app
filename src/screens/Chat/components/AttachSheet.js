import React, { useContext } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ThemeContext } from '../../../components/ThemeContext';

const AttachSheet = ({ visible, onClose, openCamera, openGallery, openDocument, openVideoGallery }) => {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const isDark = theme?.text === '#FFFFFF';

    const sheetBg = isDark ? '#1f2c34' : '#ffffff';
    const handleBg = isDark ? '#3a4a52' : '#dddddd';
    const titleColor = isDark ? '#e9edef' : '#222222';
    const labelColor = isDark ? '#d0d8dc' : '#333333';

    const OPTIONS = [
        { icon: 'camera', color: '#e91e8c', label: t('Camera'), fn: openCamera },
        { icon: 'images', color: '#5b5fc7', label: t('Gallery'), fn: openGallery },
        { icon: 'document', color: '#00897b', label: t('Document(PDF)'), fn: openDocument },
        { icon: 'videocam', color: '#d32f2f', label: 'Video', fn: openVideoGallery },
    ];

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <View style={[styles.sheet, { backgroundColor: sheetBg }]}>
                    <View style={[styles.handle, { backgroundColor: handleBg }]} />
                    <Text style={[styles.title, { color: titleColor }]}>{t('Add')}</Text>
                    <View style={styles.grid}>
                        {OPTIONS.map(opt => (
                            <TouchableOpacity key={opt.label} style={styles.option} onPress={opt.fn}>
                                <View style={[styles.iconCircle, { backgroundColor: opt.color }]}>
                                    <Ionicons name={opt.icon} size={28} color="#fff" />
                                </View>
                                <Text style={[styles.label, { color: labelColor }]}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 66, paddingTop: 12 },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
    title: { fontSize: 16, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
    grid: { flexDirection: 'row', justifyContent: 'space-around' },
    option: { alignItems: 'center', gap: 8 },
    iconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 13, fontWeight: '500' },
});

export default AttachSheet;
