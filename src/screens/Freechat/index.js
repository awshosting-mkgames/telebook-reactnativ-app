import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,Platform
} from 'react-native';
import { Ionicons,MaterialIcons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';

const filters = ['All', 'Groups', 'Unread 2', 'Calls'];

const chats = [
    {
        id: '1',
        name: 'Tory Nichols',
        msg: 'I am busy bro.....',
        time: '12:45 Pm',
        avatar: 'https://i.pravatar.cc/150?img=1',
    },
    {
        id: '2',
        name: 'Kenny Payne',
        msg: 'I am busy bro.....',
        time: '11:30 am',
        avatar: 'https://i.pravatar.cc/150?img=2',
    },
    {
        id: '3',
        name: 'Anthony LaRusso',
        msg: 'I am busy bro.....',
        time: '10:33 am',
        avatar: 'https://i.pravatar.cc/150?img=3',
    },
    {
        id: '4',
        name: 'Eli Moskowitz',
        msg: 'I am busy bro.....',
        time: '10:30 am',
        avatar: 'https://i.pravatar.cc/150?img=4',
    },
    {
        id: '1',
        name: 'Tory Nichols',
        msg: 'I am busy bro.....',
        time: '12:45 Pm',
        avatar: 'https://i.pravatar.cc/150?img=1',
    },
    {
        id: '2',
        name: 'Kenny Payne',
        msg: 'I am busy bro.....',
        time: '11:30 am',
        avatar: 'https://i.pravatar.cc/150?img=2',
    },
    {
        id: '3',
        name: 'Anthony LaRusso',
        msg: 'I am busy bro.....',
        time: '10:33 am',
        avatar: 'https://i.pravatar.cc/150?img=3',
    },
    {
        id: '4',
        name: 'Eli Moskowitz',
        msg: 'I am busy bro.....',
        time: '10:30 am',
        avatar: 'https://i.pravatar.cc/150?img=4',
    }
];


const Freechat = ({navigation}) => {
    const { theme, toggleTheme } = useContext(ThemeContext);

    const gotoChatpage = () => {
        navigation.navigate('Chat');
    }


    return (
        <SafeAreaView  style={[styles.container,{ backgroundColor: theme.background}]}>
            {/* Header */}
            <StatusBar backgroundColor="#1199ff" barStyle="light-content" />
            <View style={styles.header}>
                <Ionicons name="filter-sharp" size={24} color="#ffffff" />
                <Text style={styles.headerTitle}>Free Chat</Text>
                <Ionicons name="search" size={24} color="#ffffff" />
            </View>

            {/* Ad Banner */}
            <View style={[styles.adBox,{backgroundColor: theme.freeChatmess}]}>
                {/* Left Icon */}
                <View style={styles.adIcon}>
                    <MaterialIcons name="campaign" size={22} color="#1d9bf0" />
                </View>

                {/* Text Content */}
                <View style={styles.adContent}>
                    <Text style={[styles.adTitle,{ color: theme.text}]}>
                        Create ads from ₹86.025/day
                    </Text>

                    <Text style={[styles.adText,{ color: theme.text}]}>
                        Reach potential new customer with an ad that lets people start FreeApp chats with you.
                        <Text style={styles.adLink}> Get started</Text>
                    </Text>
                </View>

                {/* Close Icon */}
                <TouchableOpacity style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
            </View>
            {/* Filters */}
            <View style={styles.filterRow}>
                {filters.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.filterBtn,{ borderColor: theme.text},
                            item === 'All' && styles.activeFilter,
                        ]}
                    >
                        <Text
                            style={[
                                styles.filterText,{ borderColor: theme.text},
                                item === 'All' && styles.activeFilterText,
                            ]}
                        >
                            {item}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={chats}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity onPress={()=>gotoChatpage()} style={styles.chatItem}>
                        <Image source={{ uri: item.avatar }} style={styles.avatar} />
                        <View style={styles.chatContent}>
                            <Text style={[styles.name,{ color: theme.text}]}>{item.name}</Text>
                            <Text style={styles.message}>{item.msg}</Text>
                        </View>
                        <Text style={[styles.time,{ color: theme.text}]}>{item.time}</Text>
                    </TouchableOpacity>
                )}
            />
            <TouchableOpacity onPress={()=>  navigation.navigate('Contact')} style={styles.fab}>
                <Text style={styles.fabIcon}>✎</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>  navigation.navigate('Group')}  style={styles.fab2}>
                <Ionicons name="camera-outline" size={24} color="#ffffff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default Freechat;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },

    header: {
        height: 90,
        backgroundColor: '#1199ff',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    menu: { color: '#fff', fontSize: 24 },
    search: { color: '#fff', fontSize: 22 },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
    },

    adBox: {
    flexDirection: 'row',
    backgroundColor: '#eef8ff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    alignItems: 'flex-start',
  },

  adIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e1f2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  adContent: {
    flex: 1,
  },

  adTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },

  adText: {
    fontSize: 15,
    color: '#4a4a4a',
    lineHeight: 18,
  },

  adLink: {
    color: '#1d9bf0',
    fontWeight: '600',
  },

  closeBtn: {
    marginLeft: 6,
    padding: 4,
  },

    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        marginTop: 10,
    },
    filterBtn: {
        borderWidth: 1,
        borderColor: '#ccc',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
    },
    activeFilter: {
        borderColor: '#1199ff',
    },
    filterText: {
        color: '#555',
        fontSize: 14,
    },
    activeFilterText: {
        color: '#1199ff',
        fontWeight: '600',
    },

    chatItem: {
        flexDirection: 'row',
        padding: 14,
        borderBottomWidth: 0.5,
        borderColor: '#eee',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 23,
    },
    chatContent: {
        flex: 1,
        marginLeft: 12,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
    },
    message: {
        color: '#777',
        marginTop: 2,
    },
    time: {
        color: '#999',
        fontSize: 14,
    },

    fab: {
        position: 'absolute',
        right: 20,
        bottom: 30,
        backgroundColor: '#1199ff',
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
    },
    fabIcon: {
        color: '#fff',
        fontSize: 22,
    },
    fab2: {
        position: 'absolute',
        right: 22,
        bottom: 100,
        backgroundColor: '#999898',
        width: 52,
        height: 52,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
    },
    fabIcon2: {
        color: '#fff',
        fontSize: 22,
    },
});