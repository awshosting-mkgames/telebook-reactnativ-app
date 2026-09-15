import React, { useState, useContext, useCallback } from 'react';
import {
    View, Text, StyleSheet, Image, FlatList, ScrollView,
    TouchableOpacity, SafeAreaView, StatusBar, Platform,
    Modal, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';
import CreateChannelPopup from '../../components/CreateChannelPopup';

// ✅ StatusSection — complete status functionality
import StatusSection from './StatusSection';
import Config from '../../services/config';
const BASE_URL = Config.MEDIA_URL;


// ─── Helpers ──────────────────────────────────────────────────────────────────
const toArray = (val) => (Array.isArray(val) ? val : []);

const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${BASE_URL}/${path}`;
};

const formatCount = (n) => {
    if (!n && n !== 0) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ icon = 'alert-circle-outline', message = 'No data found' }) => (
    <View style={emptyStyles.wrap}>
        <Ionicons name={icon} size={36} color="#ccc" />
        <Text style={emptyStyles.text}>{message}</Text>
    </View>
);
const emptyStyles = StyleSheet.create({
    wrap: { alignItems: 'center', paddingVertical: 24, gap: 8 },
    text: { color: '#aaa', fontSize: 14 },
});

// ─────────────────────────────────────────────────────────────────────────────
export default function Updates({ navigation }) {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);

    // ✅ Redux se MY_USER_ID — StatusSection ko pass karna hai
    const maniAllData = useSelector((state) => state.totalappData);
    const MY_USER_ID = maniAllData?.userId ?? '';

    const [myChannels, setMyChannels] = useState([]);
    const [subscribedChannels, setSubscribedChannels] = useState([]);
    const [loadingMyChannels, setLoadingMyChannels] = useState(true);
    const [loadingSubscribed, setLoadingSubscribed] = useState(true);
    const [createChannelPopup, setCreateChannelPopup] = useState(false);

    // ── Fetchers ──────────────────────────────────────────────────────────────
    const fetchMyChannels = useCallback(async () => {
        try {
            setLoadingMyChannels(true);
            const res = await apiService({ method: 'GET', endpoint: 'channels/my/owned' });
            const list = toArray(res?.data?.channels ?? res?.data ?? res?.channels ?? res);
            setMyChannels(list);
        } catch (e) {
            console.error('My channels error:', e);
        } finally {
            setLoadingMyChannels(false);
        }
    }, []);

    const fetchSubscribedChannels = useCallback(async () => {
        try {
            setLoadingSubscribed(true);
            const res = await apiService({ method: 'GET', endpoint: 'channels/my/subscribed' });
            const list = toArray(res?.data?.channels ?? res?.data ?? res?.channels ?? res);
            setSubscribedChannels(list);
        } catch (e) {
            console.error('Subscribed channels error:', e);
        } finally {
            setLoadingSubscribed(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchMyChannels();
            fetchSubscribedChannels();
        }, [fetchMyChannels, fetchSubscribedChannels])
    );

    // ── Channel row ───────────────────────────────────────────────────────────
    const channalDetils = (id, type) => {
        if (type === 'otherChannal') {
            navigation.navigate('Channeldetailscreen', { channelId: id });
        } else {
            navigation.navigate('Mychannelscreen', { channelId: id });
        }
    };

    const renderChannelRow = ({ item, type = 'otherChannal' }) => {
        const id = item?._id || item?.id;
        const name = item?.channelName || item?.name || item?.title || 'Channel';
        const imageUri = item.channelIcon ? `${BASE_URL}${item.channelIcon}` : null;
        const subCount = item?.subscribers?.length ?? item?.subscriberCount ?? item?.followersCount ?? 0;
        const desc = item?.channelDescription || item?.description || item?.bio || '';
        const verified = item?.verified || item?.isVerified;
        const updatedAt = item?.updatedAt || item?.createdAt;

        return (
            <TouchableOpacity style={styles.row} onPress={() => channalDetils(id, type)} activeOpacity={0.75}>
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                        <Ionicons name="megaphone-outline" size={22} color="#1296f3" />
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>{name}</Text>
                        {verified && <Ionicons name="checkmark-circle" size={15} color="#1296f3" />}
                    </View>
                    {!!desc && <Text style={styles.sub} numberOfLines={1}>{desc}</Text>}
                    <Text style={styles.subCount}>
                        {formatCount(subCount)} {subCount === 1 ? 'subscriber' : 'subscribers'}
                    </Text>
                </View>
                <Text style={styles.time}>{timeAgo(updatedAt)}</Text>
            </TouchableOpacity>
        );
    };

    // ── UI ────────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#1296f3" barStyle="light-content" />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('Updates')}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

                {/* ✅ StatusSection — puri status functionality yahan */}
                <StatusSection
                    navigation={navigation}
                    myUserId={MY_USER_ID}
                />

                {/* ── My Channels ── */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>My Channels</Text>
                    <TouchableOpacity style={styles.createBtn} onPress={() => setCreateChannelPopup(true)}>
                        <Ionicons name="add" size={16} color="#1296f3" />
                        <Text style={styles.createBtnText}>Create</Text>
                    </TouchableOpacity>
                </View>
                {loadingMyChannels ? (
                    <ActivityIndicator color="#1296f3" style={{ marginVertical: 16 }} />
                ) : myChannels.length === 0 ? (
                    <EmptyState icon="megaphone-outline" message="Aapne koi channel nahi banaya" />
                ) : (
                    <FlatList
                        data={myChannels}
                        renderItem={({ item }) => renderChannelRow({ item, type: 'mychannel' })}
                        keyExtractor={(item, i) => (item?._id || i).toString()}
                        scrollEnabled={false}
                    />
                )}

                {/* ── Subscribed Channels ── */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Subscribed Channels</Text>
                    <TouchableOpacity style={styles.exploreBtn} onPress={() => navigation.navigate('Community')}>
                        <Text style={styles.exploreBtnText}>Explore</Text>
                    </TouchableOpacity>
                </View>
                {loadingSubscribed ? (
                    <ActivityIndicator color="#1296f3" style={{ marginVertical: 16 }} />
                ) : subscribedChannels.length === 0 ? (
                    <EmptyState icon="people-outline" message="Koi subscribed channel nahi hai" />
                ) : (
                    <FlatList
                        data={subscribedChannels}
                        renderItem={({ item }) => renderChannelRow({ item, type: 'otherChannal' })}
                        keyExtractor={(item, i) => (item?._id || i).toString()}
                        scrollEnabled={false}
                    />
                )}

            </ScrollView>

            {/* ── Create Channel Popup ── */}
            {createChannelPopup && (
                <CreateChannelPopup
                    visible={createChannelPopup}
                    onClose={() => { setCreateChannelPopup(false); fetchMyChannels(); }}
                />
            )}
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        height: 90, backgroundColor: '#1296f3',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    headerTitle: { color: '#fff', fontSize: 19, fontWeight: '600' },

    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
    },
    sectionTitle: {
        fontSize: 16, fontWeight: '600', color: '#222',
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
    },
    createBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#e8f4fd', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    },
    createBtnText: { color: '#1296f3', fontSize: 13, fontWeight: '600' },
    exploreBtn: { backgroundColor: '#f2f2f2', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
    exploreBtnText: { color: '#888', fontSize: 13 },

    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#f1f1f1',
    },
    avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
    avatarFallback: { backgroundColor: '#e8f4fd', alignItems: 'center', justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
    name: { fontSize: 15, fontWeight: '600', color: '#111', flex: 1 },
    sub: { fontSize: 13, color: '#888', marginTop: 1 },
    subCount: { fontSize: 12, color: '#aaa', marginTop: 2 },
    time: { fontSize: 11, color: '#1296f3', marginLeft: 8 },
});
