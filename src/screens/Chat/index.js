import React, { useState, useContext } from 'react';
import {
    StyleSheet, Text, View, ImageBackground,
    FlatList, TextInput, TouchableOpacity, Image,StatusBar,Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import MessageList from './MessageList';
import WhatsAppBottomUI from './WhatsAppBottomUI';
import { ThemeContext } from '../../components/ThemeContext';


const Chat = ({ navigation }) => {
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <SafeAreaView style={[styles.container,{ backgroundColor: theme.background}]}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('Community')}>
                        <Image source={{ uri: 'https://i.pravatar.cc/150?img=1' }} style={styles.avatar} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('Community')}>
                        <Text style={styles.headerName}>Johnny Lawrence</Text>
                        <Text style={styles.headerStatus}>last seen today at 10:53 am</Text>
                    </TouchableOpacity >
                </View>
                <View style={styles.headerIcons}>
                    <Ionicons name="call" size={20} color="white" style={styles.iconGap} />
                    <Ionicons name="filter" size={20} color="white" style={styles.iconGap}/>
                    <Ionicons name="videocam" size={22} color="white" style={styles.iconGap} />
                </View>
            </View>
            <ImageBackground  source={theme.ChatBackimage}  style={styles.chatBackground} >
                <MessageList />
            </ImageBackground>
            <WhatsAppBottomUI />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#075E54' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10,paddingVertical:15, backgroundColor: "#3498db",
            paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 10 },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 35, height: 35, borderRadius: 20, marginHorizontal: 8 },
    headerName: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    headerStatus: { color: 'white', fontSize: 11, opacity: 0.8 },
    headerIcons: { flexDirection: 'row', alignItems: 'center',justifyContent: 'space-between'},
    iconGap: { marginRight: 8 },
    chatBackground: { flex: 1 },
    messageWrapper: {
        maxWidth: '80%',
        padding: 8,
        borderRadius: 8,
        marginBottom: 10,
        elevation: 1,
    },
    myMessage: { alignSelf: 'flex-end', backgroundColor: '#DCF8C6' },
    otherMessage: { alignSelf: 'flex-start', backgroundColor: 'white' },
    messageText: { fontSize: 15, color: '#000' },
    deletedRow: { flexDirection: 'row', alignItems: 'center' },
    deletedText: { fontStyle: 'italic', color: 'gray' },
    timeText: { fontSize: 10, color: 'gray', alignSelf: 'flex-end', marginTop: 4 },
    messageImage: { width: 200, height: 200, borderRadius: 8 },
    
});

export default Chat;