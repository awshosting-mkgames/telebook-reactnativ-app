import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    SafeAreaView, StatusBar, Platform
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';
const CALLS = [
    { id: '1', name: 'Daniel LaRusso', time: '9 June, 4:52 pm', type: 'out_video', image: 'https://randomuser.me/api/portraits/men/32.jpg' },
    { id: '2', name: 'Johnny Lawrence', time: '9 June, 4:52 pm', type: 'missed_audio', image: 'https://randomuser.me/api/portraits/men/41.jpg' },
    { id: '3', name: 'Miguel Diaz', time: '9 June, 4:52 pm', type: 'out_audio', image: 'https://randomuser.me/api/portraits/men/55.jpg' },
    { id: '4', name: 'Miguel Diaz', time: '9 June, 4:52 pm', type: 'in_audio', image: 'https://randomuser.me/api/portraits/men/55.jpg' },
    { id: '5', name: 'Eli Moskowitz (2)', time: '9 June, 4:52 pm', type: 'missed_audio', image: 'https://randomuser.me/api/portraits/men/12.jpg' },
    { id: '6', name: 'John Kreese', time: '9 June, 4:52 pm', type: 'missed_video', image: 'https://randomuser.me/api/portraits/men/77.jpg' },
    { id: '7', name: 'Ben Stock', time: '9 June, 4:52 pm', type: 'out_video', image: 'https://randomuser.me/api/portraits/men/77.jpg' },
    { id: '1', name: 'Daniel LaRusso', time: '9 June, 4:52 pm', type: 'out_video', image: 'https://randomuser.me/api/portraits/men/32.jpg' },
    { id: '2', name: 'Johnny Lawrence', time: '9 June, 4:52 pm', type: 'missed_audio', image: 'https://randomuser.me/api/portraits/men/41.jpg' },
    { id: '3', name: 'Miguel Diaz', time: '9 June, 4:52 pm', type: 'out_audio', image: 'https://randomuser.me/api/portraits/men/55.jpg' },
    { id: '4', name: 'Miguel Diaz', time: '9 June, 4:52 pm', type: 'in_audio', image: 'https://randomuser.me/api/portraits/men/55.jpg' },
    { id: '5', name: 'Eli Moskowitz (2)', time: '9 June, 4:52 pm', type: 'missed_audio', image: 'https://randomuser.me/api/portraits/men/12.jpg' },
    { id: '6', name: 'John Kreese', time: '9 June, 4:52 pm', type: 'missed_video', image: 'https://randomuser.me/api/portraits/men/77.jpg' },
    { id: '7', name: 'Ben Stock', time: '9 June, 4:52 pm', type: 'out_video', image: 'https://randomuser.me/api/portraits/men/77.jpg' }
];

export default function Call({ navigation }) {
    const { t } = useTranslation();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const renderItem = ({ item }) => {
        const isMissed = item.type.includes('missed');
        const isVideo = item.type.includes('video');

        return (
            <View style={styles.row}>
                <Image
                    source={{ uri: item.image }}
                    style={styles.avatar}
                />

                <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: theme.text }, isMissed && styles.missed]}>
                        {item.name}
                    </Text>

                    <View style={styles.timeRow}>
                        <Ionicons
                            name={
                                item.type.startsWith('out')
                                    ? 'arrow-up'
                                    : 'arrow-down'
                            }
                            size={14}
                            color={isMissed ? '#e53935' : '#2e7d32'}
                        />
                        <Text style={styles.time}> {item.time}</Text>
                    </View>
                </View>

                <View
                    style={[
                        styles.callBtn,
                        { backgroundColor: isMissed ? '#e53935' : '#2ecc71' },
                    ]}
                >
                    <Ionicons
                        name={isVideo ? 'videocam' : 'call'}
                        size={15}
                        color="#fff"
                    />
                </View>
            </View>
        );
    };


    const gotoinviteFriends = () => {
        navigation.navigate('Inviteafriends');
    }
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor="#1199ff" barStyle="light-content" />
            {/* Header */}
            <View style={styles.header}>
                <Ionicons name="filter-sharp" size={24} color="#fff" />
                <Text style={styles.headerTitle}>{t('Chat')}</Text>
            </View>

            <Text style={[styles.section, { color: theme.text }]}>{t('Date')}</Text>

            <FlatList
                data={CALLS}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
            />

            {/* Floating Button */}
            <TouchableOpacity onPress={() => gotoinviteFriends()} style={styles.fab}>
                <Ionicons name="call" size={20} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },

    header: {
        height: 70,
        backgroundColor: '#1296f3',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },

    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
        marginLeft: 16,
    },

    section: {
        fontSize: 18,
        fontWeight: '600',
        margin: 16,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,

    },

    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
        backgroundColor: '#ddd',
    },

    name: {
        fontSize: 14,
        fontWeight: '500',
        color: '#000',
    },

    missed: {
        color: '#e53935',
    },

    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },

    time: {
        fontSize: 11,
        color: '#666',
    },

    callBtn: {
        width: 35,
        height: 35,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },

    fab: {
        position: 'absolute',
        bottom: 24,
        right: 14,
        backgroundColor: '#1296f3',
        width: 50,
        height: 50,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
    },
});