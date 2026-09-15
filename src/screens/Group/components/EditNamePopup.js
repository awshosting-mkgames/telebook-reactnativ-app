import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert, Pressable,
} from 'react-native';

const EditNamePopup = ({ visible, currentName, onClose, onSave }) => {
    const [name,   setName]   = useState(currentName || '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible) setName(currentName || '');
    }, [visible, currentName]);

    const handleSave = async () => {
        if (!name.trim()) return Alert.alert('Error', 'Name empty nahi ho sakta');
        setSaving(true);
        await onSave(name.trim());
        setSaving(false);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.box} onPress={() => {}}>
                    <Text style={styles.title}>Group Name Edit Karo</Text>

                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Group ka naam..."
                        placeholderTextColor="#aaa"
                        maxLength={60}
                        autoFocus
                    />
                    <Text style={styles.counter}>{name.length}/60</Text>

                    <View style={styles.btnRow}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelTxt}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                            {saving
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={styles.saveTxt}>Save</Text>}
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
    box:       { width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 22, elevation: 12 },
    title:     { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: 16 },
    input:     { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111', backgroundColor: '#fafafa' },
    counter:   { fontSize: 11, color: '#aaa', alignSelf: 'flex-end', marginTop: 4 },
    btnRow:    { flexDirection: 'row', gap: 10, marginTop: 18 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
    cancelTxt: { color: '#555', fontWeight: '600', fontSize: 15 },
    saveBtn:   { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#3498db', alignItems: 'center' },
    saveTxt:   { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default EditNamePopup;
