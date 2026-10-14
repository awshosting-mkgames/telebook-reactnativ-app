import React, { useState, useCallback, useContext } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    SafeAreaView, StatusBar, Platform, ActivityIndicator, Alert,
    Modal, TextInput, Pressable, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import { useSelector } from 'react-redux';
import Config from '../../services/config';
import { appendFile } from '../../utils/uploadFile';
const BASE_URL = Config.MEDIA_URL;


const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

export default function MyBroadcastList({ navigation }) {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const insets = useSafeAreaInsets();
    const maniAllData = useSelector((s) => s.totalappData);
    const MY_USER_ID = maniAllData?.userData?._id ?? '';

    const [broadcasts, setBroadcasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);


    const [bcName, setBcName] = useState('');
    const [bcDesc, setBcDesc] = useState('');
    const [bcIcon, setBcIcon] = useState(null);
    const [creating, setCreating] = useState(false);


    const fetchBroadcasts = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiService({ method: 'GET', endpoint: 'broadcasts' });

            setBroadcasts(res?.data?.broadcasts ?? []);
        } catch (e) {
            console.error('fetchBroadcasts:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Screen par wapas aate hi list dobara lao — warna details screen se
    // delete/add karne ke baad purani list dikhti rehti thi.
    useFocusEffect(
        useCallback(() => { fetchBroadcasts(); }, [fetchBroadcasts])
    );


    const pickIcon = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return Alert.alert('Permission required');
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!res.canceled) setBcIcon(res.assets[0]);
    };


    const createBroadcast = async () => {
        if (!bcName.trim()) return Alert.alert('Error', 'Broadcast name required');
        setCreating(true);
        try {
            const fd = new FormData();
            fd.append('broadcastName', bcName.trim());
            fd.append('description', bcDesc.trim());
            fd.append('recipients', JSON.stringify([])); // contacts select next screen
            if (bcIcon) {
                await appendFile(fd, 'broadcastIcon', {
                    ...bcIcon,
                    type: 'image/jpeg',
                    name: `bc_${Date.now()}.jpg`,
                });
            }
            const res = await apiService({
                method: 'POST',
                endpoint: 'broadcasts',
                data: fd,
                isMultipart: true,
            });
            if (res?.success) {
                setShowCreate(false);
                setBcName(''); setBcDesc(''); setBcIcon(null);
                fetchBroadcasts();
            }
        } catch (e) {
            Alert.alert('Error', 'Could not create broadcast');
        } finally {
            setCreating(false);
        }
    };


    const deleteBroadcast = (bcId) => {
        Alert.alert(
            'Delete Broadcast?',
            'This broadcast list and all its messages will be deleted',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        await apiService({ method: 'DELETE', endpoint: `broadcasts/${bcId}` });
                        setBroadcasts(prev => prev.filter(b => b._id !== bcId));
                    },
                },
            ]
        );
    };

    const fmtTime = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('BroadcastDetails', { broadcastId: item._id, broadcastName: item.broadcastName })}
            onLongPress={() => deleteBroadcast(item._id)}
        >
            <View style={styles.iconWrap}>
                {item.broadcastIcon ? (
                    <Image source={{ uri: item.broadcastIcon ? BASE_URL + item.broadcastIcon : DEFAULT_AVATAR }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.defaultIcon]}>
                        <Ionicons name="megaphone" size={24} color="#fff" />
                    </View>
                )}
            </View>
            <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                    <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                        {item.broadcastName}
                    </Text>
                    {item.lastMessage && (
                        <Text style={styles.time}>{fmtTime(item.lastMessage?.createdAt)}</Text>
                    )}
                </View>
                <View style={styles.rowBottom}>
                    <Text style={styles.sub} numberOfLines={1}>
                        {item.lastMessage?.content ?? item.description ?? 'No messages yet'}
                    </Text>
                    <View style={styles.badge}>
                        <Ionicons name="people" size={12} color="#1296f3" />
                        <Text style={styles.badgeText}>{item.recipients?.length ?? 0}</Text>
                    </View>
                </View>
                <Text style={styles.statLine}>
                    📤 {item.totalMessagesSent ?? 0} messages sent
                </Text>
            </View>
        </TouchableOpacity>
    );
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor="#1296f3" barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('MyBroadcastList')}</Text>
            </View>
            {loading ? (
                <ActivityIndicator color="#1296f3" size="large" style={{ flex: 1 }} />
            ) : (
                <FlatList
                    data={broadcasts}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    refreshing={loading}
                    onRefresh={fetchBroadcasts}
                    contentContainerStyle={{ paddingBottom: 100 + insets.bottom, flexGrow: 1 }}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Ionicons name="megaphone-outline" size={64} color="#ccc" />
                            <Text style={styles.emptyTitle}>No broadcast lists yet</Text>
                            <Text style={styles.emptySub}>Create a new broadcast list</Text>
                            <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
                                <Text style={styles.createBtnText}>+ Create Broadcast</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
            <TouchableOpacity
                style={[styles.fab, { bottom: 24 + insets.bottom }]}
                onPress={() => navigation.navigate('FindContact', { createType: 'broadcast' })}
                activeOpacity={0.85}
            >
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
                {/* Keyboard sheet ko dhak leta tha — isliye sheet keyboard ke upar uthti hai */}
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <Pressable style={styles.overlay} onPress={() => setShowCreate(false)}>
                        <Pressable
                            style={[
                                styles.sheet,
                                {
                                    backgroundColor: theme.background === '#000' ? '#1a1a1a' : '#fff',
                                    paddingBottom: 20 + insets.bottom,
                                },
                            ]}
                            onStartShouldSetResponder={() => true}
                        >
                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 8 }}
                            >
                                <View style={styles.sheetHandle} />
                                <Text style={[styles.sheetTitle, { color: theme.text }]}>New Broadcast List</Text>
                                <TouchableOpacity style={styles.iconPicker} onPress={pickIcon}>
                                    {bcIcon ? (
                                        <Image source={{ uri: bcIcon.uri }} style={styles.pickedIcon} />
                                    ) : (
                                        <View style={styles.iconPlaceholder}>
                                            <Ionicons name="camera" size={28} color="#888" />
                                            <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>Add Icon</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                                <View style={[styles.inputWrap, { backgroundColor: theme.background === '#000' ? '#2a2a2a' : '#f5f5f5' }]}>
                                    <Ionicons name="megaphone-outline" size={18} color="#888" />
                                    <TextInput
                                        style={[styles.modalInput, { color: theme.text }]}
                                        placeholder="Broadcast List Name *"
                                        placeholderTextColor="#999"
                                        value={bcName}
                                        onChangeText={setBcName}
                                    />
                                </View>
                                <View style={[styles.inputWrap, { backgroundColor: theme.background === '#000' ? '#2a2a2a' : '#f5f5f5' }]}>
                                    <Ionicons name="information-circle-outline" size={18} color="#888" />
                                    <TextInput
                                        style={[styles.modalInput, { color: theme.text }]}
                                        placeholder="Description (optional)"
                                        placeholderTextColor="#999"
                                        value={bcDesc}
                                        onChangeText={setBcDesc}
                                    />
                                </View>
                                <TouchableOpacity
                                    style={[styles.submitBtn, creating && { opacity: 0.7 }]}
                                    onPress={createBroadcast}
                                    disabled={creating} >
                                    {creating
                                        ? <ActivityIndicator color="#fff" />
                                        : <Text style={styles.submitText}>{t('CreateBroadcast')}</Text>
                                    }
                                </TouchableOpacity>
                            </ScrollView>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        height: 90, backgroundColor: '#1296f3', flexDirection: 'row',
        alignItems: 'center', paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, gap: 12,
    },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1 },

    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#6463635d" },
    iconWrap: { marginRight: 14 },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    defaultIcon: { backgroundColor: '#1296f3', alignItems: 'center', justifyContent: 'center' },

    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    name: { fontSize: 16, fontWeight: '600', flex: 1 },
    sub: { fontSize: 13, color: '#888', flex: 1 },
    time: { fontSize: 11, color: '#999' },
    statLine: { fontSize: 11, color: '#1296f3', marginTop: 3 },

    badge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e8f4ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    badgeText: { fontSize: 11, color: '#1296f3', fontWeight: '600' },

    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#ccc', marginTop: 16 },
    emptySub: { fontSize: 13, color: '#bbb', marginTop: 6 },
    createBtn: { marginTop: 20, backgroundColor: '#1296f3', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
    createBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

    fab: {
        position: 'absolute', bottom: 28, right: 24,
        backgroundColor: '#1296f3', width: 56, height: 56,
        borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 5,
    },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 24, paddingTop: 14, maxHeight: '90%' },
    sheetHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
    sheetTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 20 },

    iconPicker: { alignSelf: 'center', marginBottom: 20 },
    pickedIcon: { width: 80, height: 80, borderRadius: 40 },
    iconPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },

    inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, gap: 10 },
    modalInput: { flex: 1, fontSize: 15 },

    submitBtn: { backgroundColor: '#1296f3', padding: 15, borderRadius: 14, alignItems: 'center', marginTop: 6 },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
