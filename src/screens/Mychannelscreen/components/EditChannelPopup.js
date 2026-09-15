// components/EditChannelPopup.js
import React, { useState, useEffect, useContext } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
    Image, ScrollView, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import apiService from '../../../services/apiService';
import { ThemeContext } from '../../../components/ThemeContext';
import Config from '../../../services/config';
import { appendFile } from '../../../utils/uploadFile';
const BASE_URL = Config.Main_url;

const getImg = (path) => {
    if (!path) return null;
    if (typeof path === 'string' && path.startsWith('http')) return path;
    return `${BASE_URL?.MEDIA_URL}/${path}`;
};

export default function EditChannelPopup({ visible, onClose, channel, onUpdated }) {
    const { theme } = useContext(ThemeContext);
    const isLight = theme?.mode === 'light';
    const styles = getStyles(isLight);

    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [newIcon, setNewIcon] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (channel && visible) {
            setName(channel?.channelName || channel?.name || '');
            setDesc(channel?.channelDescription || channel?.description || '');
            setNewIcon(null);
        }
    }, [channel, visible]);

    const pickImage = async () => {
        const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!granted) { Alert.alert('Permission chahiye'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.85,
        });
        if (!res.canceled) setNewIcon(res.assets[0].uri);
    };

    const handleSave = async () => {
        if (!name.trim()) { Alert.alert('Required', 'Channel name khali nahi ho sakta'); return; }
        setSaving(true);
        try {
            const form = new FormData();
            form.append('channelName', name.trim());
            form.append('channelDescription', desc.trim());
            if (newIcon) {
                await appendFile(form, 'channelIcon', { uri: newIcon, type: 'image/jpeg', name: `icon_${Date.now()}.jpg` });
            }
            const res = await apiService({
                method: 'PUT',
                endpoint: `channels/${channel?._id || channel?.id}/update`,
                data: form, isMultipart: true,
            });
            onUpdated(res?.data?.channel ?? res?.channel ?? res?.data ?? null);
            onClose();
        } catch {
            Alert.alert('Error', 'Update nahi hua');
        } finally {
            setSaving(false);
        }
    };

    const displayIcon = newIcon || getImg(channel?.channelIcon || channel?.avatar);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
            <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => !saving && onClose()} />
                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => !saving && onClose()}>
                            <Text style={styles.cancelTxt}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>Channel Edit Karo</Text>
                        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveTxt}>Save</Text>}
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.iconSection}>
                            <TouchableOpacity style={styles.iconWrap} onPress={pickImage} disabled={saving}>
                                {displayIcon
                                    ? <Image source={{ uri: displayIcon }} style={styles.iconImg} />
                                    : <View style={[styles.iconImg, styles.iconFb]}>
                                        <Ionicons name="megaphone" size={32} color="#1296f3" />
                                    </View>
                                }
                                <View style={styles.camBadge}>
                                    <Ionicons name="camera" size={13} color="#fff" />
                                </View>
                            </TouchableOpacity>
                            <Text style={styles.iconHint}>{newIcon ? '✅ Photo ready' : 'Photo change karo'}</Text>
                        </View>

                        <Text style={styles.label}>Channel Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Channel ka naam"
                            placeholderTextColor={isLight ? '#ccc' : '#666'}
                            maxLength={60}
                            editable={!saving}
                        />

                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
                            value={desc}
                            onChangeText={setDesc}
                            placeholder="Channel ke baare mein likho..."
                            placeholderTextColor={isLight ? '#ccc' : '#666'}
                            multiline
                            maxLength={300}
                            editable={!saving}
                        />
                        <View style={{ height: 20 }} />
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const getStyles = (isLight) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: isLight ? '#fff' : '#1a1d23', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, maxHeight: '85%' },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: isLight ? '#ddd' : '#3a3d44', alignSelf: 'center', marginBottom: 18 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
    cancelTxt: { fontSize: 15, color: isLight ? '#999' : '#8a8f96' },
    title: { fontSize: 16, fontWeight: '800', color: isLight ? '#111' : '#f5f5f5' },
    saveBtn: { backgroundColor: '#1296f3', paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20 },
    saveTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
    iconSection: { alignItems: 'center', marginBottom: 20 },
    iconWrap: { position: 'relative', marginBottom: 8 },
    iconImg: { width: 88, height: 88, borderRadius: 44, backgroundColor: isLight ? '#e8f4fd' : '#16324a', borderWidth: 3, borderColor: '#1296f3' },
    iconFb: { alignItems: 'center', justifyContent: 'center' },
    camBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: '#1296f3', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: isLight ? '#fff' : '#1a1d23' },
    iconHint: { fontSize: 13, color: isLight ? '#aaa' : '#8a8f96' },
    label: { fontSize: 13, fontWeight: '700', color: isLight ? '#555' : '#c5c8cc', marginBottom: 8, marginTop: 16 },
    input: { borderWidth: 1.5, borderColor: isLight ? '#eee' : '#2a2d33', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: isLight ? '#111' : '#f5f5f5', backgroundColor: isLight ? '#fafafa' : '#22252b' },
});