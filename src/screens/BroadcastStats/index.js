import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    SafeAreaView, StatusBar, Platform, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';
import apiService from '../../services/apiService';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, iconColor, label, value, pct, bg }) => (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={32} color={iconColor} />
        <Text style={[styles.statValue, { color: iconColor }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statPct, { color: iconColor }]}>{pct}</Text>
    </View>
);

export default function BroadcastStats({ route, navigation }) {
    const { messageId, content } = route.params;
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);

    const [stats,   setStats]   = useState(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'read' | 'delivered' | 'pending'

    // ── Fetch Stats ───────────────────────────────────────────────────────────
    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiService({
                method:   'GET',
                endpoint: `broadcasts/messages/${messageId}/stats`,
            });
            console.log("res______________",res)
            setStats(res?.data?.stats ?? null);
        } catch (e) {
            console.error('fetchStats:', e);
            Alert.alert('Error', 'Stats load nahi hue');
        } finally {
            setLoading(false);
        }
    }, [messageId]);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    // ── Delete Broadcast Message ──────────────────────────────────────────────
    const deleteMessage = () => {
        Alert.alert(
            'Delete Message?',
            'Yeh message sab recipients ke chats se bhi delete ho jayega.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            await apiService({
                                method:   'DELETE',
                                endpoint: `broadcasts/messages/${messageId}`,
                            });
                            navigation.goBack();
                        } catch (e) {
                            Alert.alert('Error', 'Delete nahi hua');
                        } finally {
                            setDeleting(false);
                        }
                    },
                },
            ]
        );
    };

    const fmtTime = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        const date = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
        const time = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        return `${date}, ${time}`;
    };

    // ── Filter delivery status ────────────────────────────────────────────────
    const filteredStatus = (stats?.deliveryStatus ?? []).filter(item => {
        if (activeFilter === 'read')      return item.read;
        if (activeFilter === 'delivered') return item.delivered && !item.read;
        if (activeFilter === 'pending')   return !item.delivered;
        return true;
    });

    // ── Render Recipient Row ──────────────────────────────────────────────────
    const renderRecipient = ({ item }) => {
        const statusColor = item.read ? '#34c759' : item.delivered ? '#1296f3' : '#ff9500';
        const statusIcon  = item.read ? 'checkmark-done' : item.delivered ? 'checkmark-done' : 'time';
        const statusText  = item.read
            ? `Read · ${fmtTime(item.readAt)}`
            : item.delivered
                ? `Delivered · ${fmtTime(item.deliveredAt)}`
                : 'Pending';

        return (
            <View style={[
                styles.recipientRow,
                { borderBottomColor: theme.background === '#000' ? '#2a2a2a' : '#f0f0f0' }
            ]}>
                {/* Avatar */}
                {item.user?.profilePicture ? (
                    <Image source={{ uri: item.user.profilePicture }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarLetter}>{item.user?.name?.[0]?.toUpperCase() ?? '?'}</Text>
                    </View>
                )}

                {/* Name + Status */}
                <View style={{ flex: 1 }}>
                    <Text style={[styles.recipientName, { color: theme.text }]}>
                        {item.user?.name ?? 'Unknown'}
                    </Text>
                    <View style={styles.statusRow}>
                        <Ionicons name={statusIcon} size={13} color={statusColor} />
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                    </View>
                </View>

                {/* Status badge */}
                <View style={[styles.badge, { backgroundColor: `${statusColor}18` }]}>
                    <Text style={[styles.badgeText, { color: statusColor }]}>
                        {item.read ? 'Read' : item.delivered ? 'Delivered' : 'Pending'}
                    </Text>
                </View>
            </View>
        );
    };

    if (loading) return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Message Stats</Text>
                <View style={{ width: 22 }} />
            </View>
            <ActivityIndicator color="#1296f3" size="large" style={{ flex: 1 }} />
        </SafeAreaView>
    );

    const msg = stats?.message;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor="#1296f3" barStyle="light-content" />

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Message Stats</Text>
                <TouchableOpacity onPress={deleteMessage} disabled={deleting}>
                    {deleting
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name="trash-outline" size={22} color="#fff" />
                    }
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredStatus}
                keyExtractor={(item, i) => item.user?._id ?? i.toString()}
                renderItem={renderRecipient}
                ListHeaderComponent={() => (
                    <>
                        {/* Message preview */}
                        <View style={[styles.msgPreview, { backgroundColor: theme.background === '#000' ? '#1a1a1a' : '#f9f9f9' }]}>
                            <Text style={[styles.msgContent, { color: theme.text }]} numberOfLines={3}>
                                {msg?.content ?? content ?? '📎 Attachment'}
                            </Text>
                            <Text style={styles.msgTime}>
                                Sent on {fmtTime(msg?.createdAt)}
                            </Text>
                        </View>

                        {/* Overall Stats */}
                        <View style={styles.statsGrid}>
                            <StatCard
                                icon="people"
                                iconColor="#8b5cf6"
                                label="Total"
                                value={msg?.totalRecipients ?? 0}
                                pct="100%"
                                bg={theme.background === '#000' ? '#1a1a2e' : '#f3f0ff'}
                            />
                            <StatCard
                                icon="checkmark-done"
                                iconColor="#1296f3"
                                label="Delivered"
                                value={msg?.totalDelivered ?? 0}
                                pct={msg?.deliveryRate ?? '0%'}
                                bg={theme.background === '#000' ? '#0a1628' : '#e8f4ff'}
                            />
                            <StatCard
                                icon="eye"
                                iconColor="#34c759"
                                label="Read"
                                value={msg?.totalRead ?? 0}
                                pct={msg?.readRate ?? '0%'}
                                bg={theme.background === '#000' ? '#0a2010' : '#e8fff0'}
                            />
                            <StatCard
                                icon="time"
                                iconColor="#ff9500"
                                label="Pending"
                                value={(msg?.totalRecipients ?? 0) - (msg?.totalDelivered ?? 0)}
                                pct={
                                    msg?.totalRecipients
                                        ? `${(((msg.totalRecipients - msg.totalDelivered) / msg.totalRecipients) * 100).toFixed(0)}%`
                                        : '0%'
                                }
                                bg={theme.background === '#000' ? '#1a1000' : '#fff8e8'}
                            />
                        </View>

                        {/* Progress bar */}
                        <View style={[styles.progressSection, { backgroundColor: theme.background === '#000' ? '#1a1a1a' : '#fff' }]}>
                            <Text style={[styles.progressTitle, { color: theme.text }]}>Delivery Progress</Text>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, {
                                    width: `${msg?.totalRecipients ? (msg.totalDelivered / msg.totalRecipients) * 100 : 0}%`,
                                    backgroundColor: '#1296f3',
                                }]} />
                            </View>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, {
                                    width: `${msg?.totalRecipients ? (msg.totalRead / msg.totalRecipients) * 100 : 0}%`,
                                    backgroundColor: '#34c759',
                                }]} />
                            </View>
                            <View style={styles.legendRow}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: '#1296f3' }]} />
                                    <Text style={styles.legendText}>Delivered {msg?.deliveryRate}</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: '#34c759' }]} />
                                    <Text style={styles.legendText}>Read {msg?.readRate}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Filter tabs */}
                        <View style={[styles.filterBar, { backgroundColor: theme.background === '#000' ? '#111' : '#f5f5f5' }]}>
                            {[
                                { key: 'all',       label: `All (${stats?.deliveryStatus?.length ?? 0})` },
                                { key: 'read',      label: `Read (${msg?.totalRead ?? 0})` },
                                { key: 'delivered', label: `Delivered (${(msg?.totalDelivered ?? 0) - (msg?.totalRead ?? 0)})` },
                                { key: 'pending',   label: `Pending (${(msg?.totalRecipients ?? 0) - (msg?.totalDelivered ?? 0)})` },
                            ].map(f => (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
                                    onPress={() => setActiveFilter(f.key)}
                                >
                                    <Text style={[styles.filterTabText, activeFilter === f.key && styles.filterTabTextActive]}>
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.listHeader, { color: theme.text }]}>Recipient Details</Text>
                    </>
                )}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>Is filter mein koi nahi</Text>
                }
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        height: 90, backgroundColor: '#1296f3', flexDirection: 'row',
        alignItems: 'center', paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
        justifyContent: 'space-between',
    },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },

    // Message preview
    msgPreview: { margin: 14, borderRadius: 14, padding: 14 },
    msgContent: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
    msgTime:    { fontSize: 12, color: '#888' },

    // Stats grid
    statsGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        paddingHorizontal: 10, marginBottom: 4, gap: 8,
    },
    statCard: {
        flex: 1, minWidth: (SCREEN_W - 56) / 2 - 4,
        borderRadius: 14, padding: 14,
        alignItems: 'center', gap: 4,
    },
    statValue: { fontSize: 28, fontWeight: '700' },
    statLabel: { fontSize: 12, color: '#888' },
    statPct:   { fontSize: 13, fontWeight: '600' },

    // Progress
    progressSection: { margin: 14, borderRadius: 14, padding: 14 },
    progressTitle:   { fontSize: 14, fontWeight: '600', marginBottom: 10 },
    progressBarBg:   { height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 4 },
    legendRow:       { flexDirection: 'row', gap: 16, marginTop: 4 },
    legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot:       { width: 10, height: 10, borderRadius: 5 },
    legendText:      { fontSize: 12, color: '#666' },

    // Filter
    filterBar: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
    filterTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'transparent' },
    filterTabActive:     { backgroundColor: '#1296f3' },
    filterTabText:       { fontSize: 12, color: '#888' },
    filterTabTextActive: { color: '#fff', fontWeight: '600' },

    listHeader: { fontSize: 14, fontWeight: '600', paddingHorizontal: 16, paddingVertical: 10 },

    // Recipient row
    recipientRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
    avatar:        { width: 44, height: 44, borderRadius: 22 },
    avatarFallback:{ backgroundColor: '#1296f3', alignItems: 'center', justifyContent: 'center' },
    avatarLetter:  { color: '#fff', fontSize: 18, fontWeight: '700' },

    recipientName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
    statusRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statusText:    { fontSize: 12, fontWeight: '500' },

    badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    badgeText: { fontSize: 11, fontWeight: '600' },

    emptyText: { textAlign: 'center', color: '#999', marginTop: 30, fontSize: 14 },
});
