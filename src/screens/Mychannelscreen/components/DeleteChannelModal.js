// components/DeleteChannelModal.js
import React, { useContext, useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity,
    StyleSheet, ActivityIndicator, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../../services/apiService';
import { ThemeContext } from '../../../components/ThemeContext';

export default function DeleteChannelModal({ visible, onClose, channel, onDeleted }) {
    const { theme } = useContext(ThemeContext);
    const isLight = theme?.mode === 'light';
    const s = getStyles(isLight);

    const [deleting, setDeleting] = useState(false);

    const channelName = channel?.channelName || channel?.name || 'this channel';
    const channelId = channel?._id || channel?.id;

    const handleDelete = async () => {
        if (!channelId || deleting) return;
        setDeleting(true);
        try {
            // DELETE /api/channels/:channelId
            await apiService({
                method: 'DELETE',
                endpoint: `channels/${channelId}`,
            });
            setDeleting(false);
            onClose();
            onDeleted?.(); // ✅ success → navigation back parent handle karega
        } catch (e) {
            console.error('Delete channel error:', e);
            setDeleting(false);
            // Alert nahi — modal ke andar hi error nahi dikha rahe,
            // chaho to yahan error state add kar sakte ho
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !deleting && onClose()}>
            <Pressable style={s.overlay} onPress={() => !deleting && onClose()}>
                <Pressable style={s.box} onPress={() => { }}>

                    {/* Warning Icon */}
                    <View style={s.iconCircle}>
                        <Ionicons name="trash" size={30} color="#e74c3c" />
                    </View>

                    <Text style={s.title}>Delete Channel?</Text>
                    <Text style={s.msg}>
                        Kya aap sach mein <Text style={s.bold}>"{channelName}"</Text> delete
                        karna chahte ho? Saare posts aur subscribers permanently delete ho
                        jayenge. Ye action wapas nahi ho sakta.
                    </Text>

                    {/* Buttons */}
                    <View style={s.btnRow}>
                        <TouchableOpacity
                            style={[s.btn, s.noBtn]}
                            onPress={onClose}
                            disabled={deleting}
                            activeOpacity={0.8}
                        >
                            <Text style={s.noTxt}>No, Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[s.btn, s.yesBtn, deleting && { opacity: 0.7 }]}
                            onPress={handleDelete}
                            disabled={deleting}
                            activeOpacity={0.8}
                        >
                            {deleting
                                ? <ActivityIndicator size="small" color="#fff" />
                                : (
                                    <>
                                        <Ionicons name="trash-outline" size={16} color="#fff" />
                                        <Text style={s.yesTxt}>Yes, Delete</Text>
                                    </>
                                )
                            }
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const getStyles = (isLight) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    box: {
        width: '100%',
        backgroundColor: isLight ? '#fff' : '#1a1d23',
        borderRadius: 22,
        padding: 24,
        alignItems: 'center',
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: isLight ? 0.25 : 0.5,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: isLight ? '#fdecea' : '#3a1f1c',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: isLight ? '#111' : '#f5f5f5',
        marginBottom: 8,
    },
    msg: {
        fontSize: 13.5,
        color: isLight ? '#777' : '#9aa0a6',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 22,
    },
    bold: { fontWeight: '700', color: isLight ? '#333' : '#e5e5e5' },
    btnRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    btn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 13,
        borderRadius: 14,
    },
    noBtn: {
        backgroundColor: isLight ? '#f4f6fb' : '#22252b',
        borderWidth: 1,
        borderColor: isLight ? '#e5e7eb' : '#2a2d33',
    },
    noTxt: { color: isLight ? '#555' : '#c5c8cc', fontWeight: '700', fontSize: 14 },
    yesBtn: {
        backgroundColor: '#e74c3c',
        elevation: 2,
        shadowColor: '#e74c3c',
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    yesTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});