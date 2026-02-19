import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    ScrollView,
    TouchableOpacity,
    SafeAreaView, StatusBar, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';
const STATUS = [
    {
        id: 'me',
        name: 'Add status',
        image: 'https://randomuser.me/api/portraits/men/1.jpg',
        isMe: true,
    },
    {
        id: '1',
        name: 'Daniel LaRusso',
        image: 'https://picsum.photos/300/500?1',
    },
    {
        id: '2',
        name: 'Johnny Lawrence',
        image: 'https://picsum.photos/300/500?2',
    },
];

const CHANNELS = [
    {
        id: '1',
        name: 'FC Barcelona',
        followers: '48.80M followers',
        verified: true,
        logo: 'https://picsum.photos/seed/barcelona/200/200',
    },
    {
        id: '2',
        name: 'Punjab kings',
        followers: '86.45M followers',
        logo: 'https://picsum.photos/seed/punjab/200/200',
    },
];

const SUGGESTED = [
    {
        id: '3',
        name: 'Gujarat Titans',
        followers: '87.90M followers',
        logo: 'https://picsum.photos/seed/gujarat/200/200',
    },
    {
        id: '4',
        name: 'RCB',
        followers: '35.5M followers',
        logo: 'https://picsum.photos/seed/rcb1/200/200',
    },
    {
        id: '5',
        name: 'Gujarat Titans',
        followers: '87.90M followers',
        logo: 'https://picsum.photos/seed/gujarat2/200/200',
    },
    {
        id: '6',
        name: 'RCB',
        followers: '35.5M followers',
        logo: 'https://picsum.photos/seed/rcb2/200/200',
    },
    {
        id: '7',
        name: 'Gujarat Titans',
        followers: '87.90M followers',
        logo: 'https://picsum.photos/seed/gujarat3/200/200',
    },
    {
        id: '8',
        name: 'RCB',
        followers: '35.5M followers',
        logo: 'https://picsum.photos/seed/rcb3/200/200',
    },
];



export default function Updates({ navigation }) {
    const { theme, toggleTheme } = useContext(ThemeContext);
    const gotoCommunity = () => {
        navigation.navigate('Community');
    };
    return (
        <SafeAreaView  style={[styles.container,{ backgroundColor: theme.background}]}>
            {/* Header */}
            <View style={styles.header}>
                <Ionicons name="menu" size={24} color="#fff" />
                <Text style={styles.headerTitle}>Updates</Text>
                <Ionicons name="search" size={22} color="#fff" />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.section}>Status</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16 }}
                >
                    {STATUS.map((item) => (
                        <View key={item.id} style={styles.statusCard}>
                            <Image source={{ uri: item.image }} style={styles.statusBg} />
                            {item.isMe ? (
                                <>
                                    <View style={styles.addAvatar}>
                                        <Image source={{ uri: item.image }} style={styles.avatar} />
                                        <View style={styles.addPlus}>
                                            <Ionicons name="add" size={14} color="#fff" />
                                        </View>
                                    </View>
                                    <Text style={styles.addText}>Add status</Text>
                                </>
                            ) : (
                                <>
                                    <View style={styles.userAvatarWrap}>
                                        <Image source={{ uri: item.image }} style={styles.userAvatar} />
                                    </View>
                                    <Text style={styles.userName}>{item.name}</Text>
                                </>
                            )}
                        </View>
                    ))}
                </ScrollView>

                {/* Channels */}
                <View style={styles.channelHeader}>
                    <Text style={styles.section}>Channels</Text>
                    <TouchableOpacity onPress={gotoCommunity} style={styles.exploreBtn}>
                        <Text style={styles.exploreText}>Explore</Text>
                    </TouchableOpacity>
                </View>

                {CHANNELS.map((item) => (
                    <View key={item.id} style={styles.row}>
                        <Image source={{ uri: item.logo }} style={styles.avatar} />
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.name,{ color: theme.text}]}>{item.name}</Text>
                                {item.verified && (
                                    <Ionicons name="checkmark-circle" size={16} color="#1da1f2" style={{ marginLeft: 6 }} />
                                )}
                            </View>
                            <Text style={styles.sub}>{item.followers}</Text>
                        </View>
                        <Text style={[styles.time,{ color: theme.text}]}>11:00 am</Text>
                    </View>
                ))}

                <Text style={styles.section}>Find Channel to follow</Text>

                {SUGGESTED.map((item) => (
                    <View key={item.id} style={styles.row}>
                        <Image source={{ uri: item.logo }} style={styles.avatar} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.name}>{item.name}</Text>
                            <Text style={styles.sub}>{item.followers}</Text>
                        </View>
                        <TouchableOpacity style={styles.followBtn}>
                            <Text style={styles.followText}>Follow</Text>
                        </TouchableOpacity>
                    </View>
                ))}

                <TouchableOpacity onPress={() => navigation.navigate('Contact')} style={styles.exploreMore}>
                    <Text style={{ color: '#666', fontSize: 14 }}>Explore more</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Contact')} style={styles.createChannel}>
                    <Text style={{ color: '#666', fontSize: 15 }}>＋ Create Channel</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Floating Camera */}
            <TouchableOpacity onPress={() => navigation.navigate('Community')} style={styles.fab}>
                <Text style={styles.fabIcon}>✎</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Group')} style={styles.fab2}>
                <Ionicons name="camera" size={24} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },

    header: {
        height: 90,
        backgroundColor: '#1296f3',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },

    headerTitle: { color: '#fff', fontSize: 19, fontWeight: '600' }, // 16 → 19


    statusCard: {
        width: 110,
        height: 180,
        borderRadius: 14,
        marginRight: 12,
        overflow: 'hidden',
        backgroundColor: '#f2f2f2',
        justifyContent: 'flex-end',
    },

    statusBg: {
        ...StyleSheet.absoluteFillObject,
    },

    /* ADD STATUS */
    addAvatar: {
        alignSelf: 'center',
        marginBottom: 20,
    },

    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
    },

    addPlus: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#1296f3',
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },

    addText: {
        textAlign: 'center',
        marginBottom: 14,
        color: '#444',
        fontWeight: '500',
        fontSize: 16, // 13 → 16
    },

    /* OTHER STATUS */
    userAvatarWrap: {
        position: 'absolute',
        top: 8,
        left: 8,
        borderWidth: 2,
        borderColor: '#1296f3',
        borderRadius: 18,
    },

    userAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },

    userName: {
        color: '#fff',
        fontSize: 13, // 10 → 13
        fontWeight: '600',
        padding: 8,
    },

    addIcon: {
        position: 'absolute',
        bottom: 22,
        right: 10,
        backgroundColor: '#1296f3',
        borderRadius: 10,
        padding: 2,
    },

    statusName: {
        fontSize: 13, // 10 → 13
        marginTop: 6,
        textAlign: 'center'
    },

    channelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8,
    },

    section: {
        fontSize: 16, // 13 → 16
        fontWeight: '400',
        color: '#676767',
        padding: 10,
        paddingLeft: 16,
    },

    exploreBtn: {
        backgroundColor: '#f2f2f2',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },

    exploreText: {
        color: '#898989',
        fontSize: 14, // 11 → 14
        fontWeight: '400',
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f1f1',
    },

    name: {
        fontSize: 16, // 13 → 16
        fontWeight: '600'
    },

    sub: {
        fontSize: 13, // 10 → 13
        color: '#666',
        marginTop: 2
    },

    time: {
        fontSize: 13, // 10 → 13
        color: '#1296f3'
    },

    followBtn: {
        backgroundColor: '#1296f3',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
    },

    followText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14 // 11 → 14
    },

    exploreMore: {
        margin: 16,
        padding: 14,
        borderRadius: 20,
        backgroundColor: '#f1f1f1',
        alignItems: 'center',
    },

    createChannel: {
        marginHorizontal: 16,
        padding: 14,
        borderRadius: 20,
        backgroundColor: '#f1f1f1',
        alignItems: 'center',
        marginBottom: 80,
    },


    fab: {
        position: 'absolute',
        bottom: 100,
        right: 24,
        backgroundColor: '#b3b3b3',
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
    },
    fab2: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        backgroundColor: '#1296f3',
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
    },
    fabIcon: {
        color: '#fff',
        fontSize: 22,
    },
});