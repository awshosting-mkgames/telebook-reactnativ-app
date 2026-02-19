import React, { useState, useContext } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { ThemeContext } from '../../components/ThemeContext';
const WhatsAppBottomUI = () => {
    const [showMenu, setShowMenu] = useState(true); // Toggle for the attachment menu
     const { theme, toggleTheme } = useContext(ThemeContext);

    const AttachmentItem = ({ name, icon, color, lib }) => {
        const IconLib = lib || Ionicons;
        return (
            <View style={styles.attachmentItem}>
                <View style={styles.iconCircle}>
                    <IconLib name={icon} size={22} color={color} />
                </View>
                <Text style={[styles.attachmentText,{color:theme.text}]}>{name}</Text>
            </View>
        );
    };

    return (
        <View   style={[styles.mainContainer,{ backgroundColor: theme.background}]}>

            {/* --- INPUT AREA --- */}
            <View style={[styles.inputContainer,{ backgroundColor: theme.background}]}>
                <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="emoticon-happy-outline" size={26} color="#909090" />
                    <TextInput
                        placeholder="Message"
                        style={[styles.textInput,{ backgroundColor: theme.background,color: theme.text}]}
                        placeholderTextColor="#909090"
                    />
                    <Ionicons name="attach" size={26} color="#909090" style={styles.rotateIcon} />
                    <Ionicons name="camera" size={24} color="#909090" />
                </View>
                <TouchableOpacity style={styles.micButton}>
                    <Ionicons name="mic" size={16} color={theme.background} />
                </TouchableOpacity>
            </View>

            {/* --- ATTACHMENT MENU --- */}
            {showMenu && (
                <View style={[styles.menuContainer,{ backgroundColor: theme.background,}]}>
                    <AttachmentItem name="Document" icon="document-text-outline" color="#7f66ff" />
                    <AttachmentItem name="Camera" icon="camera" color="#ff4d67" />
                    <AttachmentItem name="Gallery" icon="image" color="#2196f3" />
                    <AttachmentItem name="Audio" icon="headset" color="#ff9800" />
                    <AttachmentItem name="Contact" icon="person" color="#00bcd4" />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        backgroundColor: '#e5ddd5', // WhatsApp chat background color
        paddingBottom: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 5,
        justifyContent: 'center',
        backgroundColor: 'white',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#616161',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        borderRadius: 30, 
        borderColor:"#000"
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        paddingHorizontal: 15,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
       
    },
    textInput: {
        flex: 1,
        marginHorizontal: 10,
        fontSize: 17,
        height: 40,
        color: '#000'
    },
    rotateIcon: {
        transform: [{ rotate: '-45deg' }],
        marginRight: 15
    },
    micButton: {
        backgroundColor: '#3498db', // Blue color as per your screenshot
        width: 42,
        height: 42,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        elevation: 3,
    },

    // Attachment Menu Styles
    menuContainer: {
        flexDirection: 'row',
        borderWidth:1,
        marginHorizontal: 10,
        marginTop: 5,
        borderRadius: 25,
        paddingVertical: 20,
        paddingHorizontal: 10,
        justifyContent: 'space-around',
        elevation: 5,
        shadowColor: '#888888',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        borderColor:"#4a4949"
    },
    attachmentItem: {
        alignItems: 'center',
        width: '18%',
    },
    iconCircle: {
        width: 50,
        height: 50,
        borderRadius: 12, // Squared-rounded look as per image
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#7f7f7f',
        marginBottom: 8,
    },
    attachmentText: {
        fontSize: 12,
        color: '#8e8e8e',
    }
});

export default WhatsAppBottomUI;