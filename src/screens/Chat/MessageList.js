import React, { useState, useContext } from 'react';
import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';

const CHAT_DATA = [
    { id: '1', type: 'text', text: "Hey! What's up?", time: '10:00 am', sender: 'other' },
    { id: '2', type: 'reply', text: "Yes bro today I am free", replyTo: "Johnny Lawrence", replyText: "Sure! brother...", time: '10:11 am', sender: 'me' },
    { id: '3', type: 'deleted_by_me', text: "You deleted this message", time: '10:12 am', sender: 'me' },
    { id: '4', type: 'deleted_by_other', text: "This message was deleted", time: '10:13 am', sender: 'other' },
    { id: '5', type: 'image', uri: 'https://via.placeholder.com/200', time: '10:15 am', sender: 'other' },
    { id: '6', type: 'call_log', callType: 'Voice Call', duration: '12 min', time: '7:12 pm', sender: 'other' },
    { id: '7', type: 'doc', fileName: 'resume.pdf', fileSize: '1.2 MB', time: '7:15 pm', sender: 'me' },
];

const MessageList = () => {
    const { theme, toggleTheme } = useContext(ThemeContext);

    const renderItem = ({ item }) => {
        const isMe = item.sender === 'me';

        return (
            <View style={[styles.messageContainer, isMe ? styles.myMessage :{...styles.otherMessage,backgroundColor:theme.background} ]}>

                {/* --- REPLY BLOCK --- */}
                {item.type === 'reply' && (
                    <View style={styles.replyBubble}>
                        <View style={styles.replyBar} />
                        <View style={styles.replyContent}>
                            <Text style={styles.replyUser}>{item.replyTo}</Text>
                            <Text style={styles.replyText} numberOfLines={1}>{item.replyText}</Text>
                        </View>
                    </View>
                )}

                {/* --- DELETED MESSAGE --- */}
                {(item.type === 'deleted_by_me' || item.type === 'deleted_by_other') ? (
                    <View style={styles.deletedContainer}>
                        <Ionicons name="ban" size={16} color="#999" style={{ marginRight: 5 }} />
                        <Text style={styles.deletedText}>{item.text}</Text>
                    </View>
                ) : item.type === 'image' ? (
                    <Image source={{ uri: item.uri }} style={styles.chatImage} />
                ) : item.type === 'call_log' ? (
                    <View style={styles.callLogContainer}>
                        <Ionicons name="call" size={20} color="#075E54" />
                        <View style={{ marginLeft: 10 }}>
                            <Text style={{ fontWeight: '600',color:theme.text }}>{item.callType}</Text>
                            <Text style={{ fontSize: 12, color: 'gray' }}>{item.duration}</Text>
                        </View>
                    </View>
                ) : item.type === 'doc' ? (
                    <View style={[styles.docContainer,{backgroundColor:'#ffffff'}]}>
                        <MaterialCommunityIcons name="file-pdf-box" size={30} color="#e74c3c" />
                        <View style={{ marginLeft: 10 }}>
                            <Text style={{ fontWeight: '500',color:'#000000' }}>{item.fileName}</Text>
                            <Text style={{ fontSize: 11, color: 'gray' }}>{item.fileSize}</Text>
                        </View>
                    </View>
                ) : (
                    <Text style={[styles.messageText,{color:theme.text}]}>{item.text}</Text>
                )}

                {/* --- TIME & TICK --- */}
                <View style={styles.timeRow}>
                    <Text style={styles.timeText}>{item.time}</Text>
                    {isMe && <Ionicons name="checkmark-done" size={16} color="#34B7F1" style={{ marginLeft: 3 }} />}
                </View>
            </View>
        );
    };

    return (
        <FlatList
            data={CHAT_DATA}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
        />
    );
};

const styles = StyleSheet.create({
    listContent: { padding: 10, paddingBottom: 20 },
    messageContainer: {
        maxWidth: '85%',
        padding: 6,
        borderRadius: 10,
        marginBottom: 8,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
    },
    myMessage: { alignSelf: 'flex-end', backgroundColor: '#DCF8C6' }, // WhatsApp Greenish
    otherMessage: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF' },
    messageText: { fontSize: 15, color: '#000' },

    // Reply Styles
    replyBubble: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 5,
        marginBottom: 5,
        overflow: 'hidden',
    },
    replyBar: { width: 4, backgroundColor: '#075E54' },
    replyContent: { padding: 5 },
    replyUser: { fontWeight: 'bold', fontSize: 12, color: '#075E54' },
    replyText: { fontSize: 12, color: '#555' },

    // Call & Doc Styles
    callLogContainer: { flexDirection: 'row', alignItems: 'center', padding: 5 },
    docContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 8, borderRadius: 5 },

    // Image & Deleted
    chatImage: { width: 220, height: 150, borderRadius: 8, marginBottom: 5 },
    deletedContainer: { flexDirection: 'row', alignItems: 'center' },
    deletedText: { fontStyle: 'italic', color: '#999', fontSize: 14 },

    timeRow: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', marginTop: 2 },
    timeText: { fontSize: 10, color: '#888' },
});

export default MessageList;