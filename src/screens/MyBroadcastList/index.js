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
            <StatusBar backgroundColor={theme.header ?? '#1296f3'} barStyle="light-content" />
            <View style={[styles.header, { backgroundColor: theme.header ?? '#1296f3' }]}>
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
                            <Text style={styles.emptySub}>Create a new broadcast from Contacts → New broadcast</Text>
                        </View>
                    }
                />
            )}
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
