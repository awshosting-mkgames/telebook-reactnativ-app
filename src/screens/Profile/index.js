import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { ThemeContext } from '../../components/ThemeContext';

const ProfileScreen = () => {
    const { theme, toggleTheme } = useContext(ThemeContext);
    return (
        <ScrollView  style={[styles.container,{ backgroundColor: theme.background}]}>
            {/* Profile Header */}
            <View style={styles.headerContainer}>
                <Image
                    source={{ uri: 'https://via.placeholder.com/150' }}
                    style={styles.profileImage}
                />
                <Text style={[styles.name,{color:theme.text}]}>John Doe</Text>
                <Text style={[styles.phone,{color:theme.text}]}>+1 234 567 8900</Text>
            </View>

            {/* Profile Info Section */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle,{color:theme.text}]}>About</Text>
                <Text style={[styles.infoText,{color:theme.text}]}>Available</Text>
            </View>

            {/* Actions Section */}
            <View style={styles.section}>
                <TouchableOpacity style={styles.button}>
                    <Text style={styles.buttonText}>Edit Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button}>
                    <Text style={styles.buttonText}>Settings</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    headerContainer: {
        alignItems: 'center',
        paddingVertical: 30,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    profileImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: 15,
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
    },
    phone: {
        fontSize: 14,
        color: '#666',
        marginTop: 5,
    },
    section: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        marginBottom: 10,
    },
    infoText: {
        fontSize: 14,
        color: '#666',
    },
    button: {
        backgroundColor: '#075e54',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginVertical: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
});

export default ProfileScreen;