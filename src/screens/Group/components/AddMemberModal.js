import React, { useState } from 'react';
import {
    Modal, View, Text, TextInput, FlatList, Image,
    TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { handlePlanLimit } from '../../../services/planLimit';
import { useNavigation } from '@react-navigation/native';
import apiService from '../../../services/apiService';

const AddMemberModal = ({ visible, onClose, chatId, existingMemberIds, onAdded }) => {
    const navigation = useNavigation();
    const allContacts = useSelector((state) => state.contacts?.contacts ?? []);

    const [searchText,       setSearchText]       = useState('');
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [adding,           setAdding]           = useState(false);

    // Contacts jo pehle se member nahi hain
    const eligible = allContacts.filter(c =>
        c.isRegistered && !existingMemberIds?.includes(c.appUser?._id)
    );

    const filtered = searchText.trim()
        ? eligible.filter(c =>
            c.name?.toLowerCase().includes(searchText.toLowerCase()) ||
            c.phone?.includes(searchText)
          )
        : eligible;

    const toggle = (c) => setSelectedContacts(prev => {
        const exists = prev.find(x => x.id === c.id);
        return exists ? prev.filter(x => x.id !== c.id) : [...prev, c];
    });

    const isSelected = (id) => selectedContacts.some(c => c.id === id);

    const handleAdd = async () => {
        if (!selectedContacts.length) return;
        setAdding(true);
        try {
            const userIds = selectedContacts.map(c => c.appUser?._id).filter(Boolean);
            const res = await apiService({
                method:   'PUT',
                endpoint: 'chats/group/add',
                data:     { chatId, userIds },
            });
            if (res?.success) {
                Alert.alert('Success', `${selectedContacts.length} member(s) add ho gaye`);
                setSelectedContacts([]);
                setSearchText('');
                onAdded?.();
                onClose();
            } else if (handlePlanLimit(res, navigation)) {
                // Upgrade alert dikha diya
            } else {
                Alert.alert('Error', res?.error?.message || res?.message || 'Member add nahi hua');
            }
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setAdding(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={styles.container}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={styles.title}>Add Members</Text>
                        {selectedContacts.length > 0 && (
                            <Text style={styles.sub}>{selectedContacts.length} selected</Text>
                        )}
                    </View>
                    {selectedContacts.length > 0 && (
                        <TouchableOpacity style={styles.checkBtn} onPress={handleAdd} disabled={adding}>
                            {adding
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Ionicons name="checkmark" size={22} color="#fff" />}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Selected chips */}
                {selectedContacts.length > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.chips}
                        contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}
                    >
                        {selectedContacts.map(c => (
                            <TouchableOpacity key={c.id} onPress={() => toggle(c)} style={styles.chip}>
                                <Image
                                    source={{ uri: c.appUser?.avatar || `https://avatar.iran.liara.run/public/boy?username=${c.name}` }}
                                    style={styles.chipAvatar}
                                />
                                <Text style={styles.chipName} numberOfLines={1}>{(c.name || c.phone || 'User').split(' ')[0]}</Text>
                                <View style={styles.chipClose}>
                                    <Ionicons name="close" size={12} color="#3498db" />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* Search */}
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={18} color="#999" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search contacts..."
                        placeholderTextColor="#bbb"
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <Ionicons name="close" size={18} color="#999" />
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={styles.count}>{filtered.length} contacts</Text>

                {/* List */}
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    renderItem={({ item }) => {
                        const sel = isSelected(item.id);
                        return (
                            <TouchableOpacity
                                style={[styles.row, sel && styles.rowSel]}
                                onPress={() => toggle(item)}
                                activeOpacity={0.7}
                            >
                                <Image
                                    source={{ uri: item.appUser?.avatar || `https://avatar.iran.liara.run/public/boy?username=${item.name}` }}
                                    style={styles.avatar}
                                />
                                <View style={{ flex: 1, marginLeft: 13 }}>
                                    <Text style={styles.name}>{item.name || item.phone || 'User'}</Text>
                                    <Text style={styles.phone}>{item.phone}</Text>
                                </View>
                                <View style={[styles.checkbox, sel && styles.checkboxSel]}>
                                    {sel && <Ionicons name="checkmark" size={14} color="#fff" />}
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="people-outline" size={52} color="#ddd" />
                            <Text style={styles.emptyText}>
                                {searchText ? 'Koi nahi mila' : 'Sab already member hain'}
                            </Text>
                        </View>
                    }
                />

                {/* FAB */}
                {selectedContacts.length > 0 && (
                    <TouchableOpacity style={styles.fab} onPress={handleAdd} disabled={adding} activeOpacity={0.85}>
                        <Ionicons name="person-add" size={20} color="#fff" />
                        <Text style={styles.fabText}>
                            Add {selectedContacts.length} Member{selectedContacts.length > 1 ? 's' : ''}
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container:   { flex: 1, backgroundColor: '#fff' },
    header:      { backgroundColor: '#3498db', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 14 },
    title:       { color: '#fff', fontSize: 18, fontWeight: '700' },
    sub:         { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
    checkBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
    chips:       { borderBottomWidth: 1, borderBottomColor: '#f0f0f0', backgroundColor: '#fafafa', maxHeight: 90 },
    chip:        { alignItems: 'center', gap: 4, paddingTop: 4 },
    chipAvatar:  { width: 46, height: 46, borderRadius: 23 },
    chipName:    { fontSize: 11, color: '#3498db', maxWidth: 50 },
    chipClose:   { position: 'absolute', top: 0, right: -2, backgroundColor: '#fff', borderRadius: 10, padding: 2, borderWidth: 1, borderColor: '#ddd' },
    searchBar:   { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: '#f5f5f5', borderRadius: 25, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
    searchInput: { flex: 1, fontSize: 15, color: '#222' },
    count:       { paddingHorizontal: 16, paddingBottom: 6, fontSize: 12, color: '#aaa' },
    row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
    rowSel:      { backgroundColor: '#f0f6ff' },
    avatar:      { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eee' },
    name:        { fontSize: 16, fontWeight: '600', color: '#111' },
    phone:       { fontSize: 12, color: '#888', marginTop: 2 },
    checkbox:    { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    checkboxSel: { backgroundColor: '#3498db', borderColor: '#3498db' },
    empty:       { alignItems: 'center', marginTop: 60, gap: 10 },
    emptyText:   { color: '#bbb', fontSize: 14 },
    fab:         { position: 'absolute', bottom: 24, left: 24, right: 24, backgroundColor: '#3498db', borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 10, elevation: 6 },
    fabText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default AddMemberModal;
