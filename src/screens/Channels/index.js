import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    SafeAreaView, StatusBar, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgUri } from 'react-native-svg';
import { ThemeContext } from '../../components/ThemeContext';
const DATA = [
  {
    id: '1',
    name: 'FC Barcelona',
    followers: '48.80M followers',
    image: 'https://picsum.photos/seed/barcelona/200/200',
    verified: true,
  },
  {
    id: '2',
    name: 'Punjab kings',
    followers: '86.45M followers',
    image: 'https://picsum.photos/seed/punjab/200/200',
    verified: false,
  },
  {
    id: '3',
    name: 'Gujarat Titans',
    followers: '87.90M followers',
    image: 'https://picsum.photos/seed/gujarat/200/200',
    verified: false,
  },
  {
    id: '4',
    name: 'RCB',
    followers: '35.5M followers',
    image: 'https://picsum.photos/seed/rcb/200/200',
    verified: true,
  },
];



const Channels = () => {
     const { theme, toggleTheme } = useContext(ThemeContext);
    const renderItem = ({ item }) => (
        <View style={styles.row}>
            <View style={styles.left}>
                <Image source={{ uri: item.image }} style={styles.avatar} />
                <View>
                    <View style={styles.nameRow}>
                        <Text style={[styles.name,{ color: theme.text}]}>{item.name}</Text>
                        {item.verified && (
                            <Ionicons name="checkmark-circle" size={18} color="#1d9bf0" />
                        )}
                    </View>
                    <Text style={styles.followers}>{item.followers}</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.followBtn}>
                <Text style={styles.followText}>Follow</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView  style={[styles.container,{ backgroundColor: theme.background}]}>
            {/* Header */}
            <View style={styles.header}>
                <Ionicons name="arrow-back" size={20} color="#fff" />
                <Text style={styles.headerTitle}>Channels</Text>
                <View style={styles.headerRight}>
                    <Ionicons name="search" size={22} color="#fff" />
                    <Ionicons name="options-outline" size={22} color="#fff" style={{ marginLeft: 16 }} />
                </View>
            </View>

            {/* List */}
            <FlatList
                data={[...DATA, ...DATA, ...DATA]}
                keyExtractor={(item, index) => index.toString()}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
};


export default Channels;


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },

    header: {
        height: 90,
        backgroundColor: '#1296f3',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },

    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '500',
        marginLeft: 16,
        flex: 1,
    },

    headerRight: {
        flexDirection: 'row',
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        justifyContent: 'space-between',
    },

    left: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    avatar: {
        width: 42,
        height: 42,
        borderRadius: 24,
        marginRight: 12,
    },

    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },

    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },

    followers: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },

    followBtn: {
        backgroundColor: '#1296f3',
        paddingHorizontal: 18,
        paddingVertical: 7,
        borderRadius: 20,
    },

    followText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
});