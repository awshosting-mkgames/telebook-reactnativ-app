import React, { useState, useContext } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
// Icons ke liye aap 'react-native-vector-icons' ya koi aur library use kar sakte hain
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ThemeContext } from '../../../components/ThemeContext';

const Signup = ({ navigation, renderSection }) => {
     const { theme, toggleTheme } = useContext(ThemeContext);
    const [formData, setFormData] = useState({
        name: '',
        city: '',
        about: '',
    });

    return (
        <SafeAreaView  style={[styles.container,{ backgroundColor: theme.background}]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.inner}
            >
                {/* Header - Back Button */}
                <TouchableOpacity style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={theme.text} />
                </TouchableOpacity>

                {/* Form Fields */}
                <View style={styles.form}>

                    {/* Name Field */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label,{ color: theme.text}]}>Name</Text>
                        <View style={[styles.inputContainer,{ backgroundColor: theme.inputBackground}]}>
                            <MaterialIcons name="person" size={22} color="#5b5b5b" style={styles.icon} />
                            <TextInput
                                style={[styles.input,{ backgroundColor: theme.inputBackground,color: theme.text}]}
                                placeholder="Enter your name"
                                placeholderTextColor="#999"
                                value={formData.name}
                                onChangeText={(text) => setFormData({ ...formData, name: text })}
                            />
                        </View>
                    </View>

                    {/* City Field */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label,{ color: theme.text}]}>City</Text>
                        <View style={[styles.inputContainer,{ backgroundColor: theme.inputBackground}]}>
                            <MaterialIcons name="business" size={22} color="#666" style={styles.icon} />                            
                            <TextInput
                                style={[styles.input,{ backgroundColor: theme.inputBackground,color: theme.text}]}
                                placeholder="Enter your city"
                                placeholderTextColor="#999"
                                value={formData.city}
                                onChangeText={(text) => setFormData({ ...formData, city: text })}
                            />
                        </View>
                    </View>

                    {/* About Field */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label,{ color: theme.text}]}>About</Text>
                        <View  style={[styles.inputContainer,{ backgroundColor: theme.inputBackground}]} >
                            <Ionicons name="information-circle" size={22} color="#666" style={styles.icon} />
                            <TextInput
                                style={[styles.input,{ backgroundColor: theme.inputBackground,color: theme.text}]}
                                placeholder="Enter your about"
                                placeholderTextColor="#999"
                                value={formData.about}
                                onChangeText={(text) => setFormData({ ...formData, about: text })}
                            />
                        </View>
                    </View>

                </View>

                {/* Footer Button */}
                <View style={styles.footer}>
                    <TouchableOpacity onPress={() => renderSection(6)} style={styles.nextButton}>
                        <Text style={styles.buttonText}>Next</Text>
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    inner: {
        flex: 1,
        paddingHorizontal: 20,
    },
    backButton: {
        marginTop: 20,
        marginBottom: 30,
    },
    form: {
        flex: 1,
        marginTop:50
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 15,
        paddingHorizontal: 15,
        height: 55,
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#000',
    },
    footer: {
        marginBottom: 20,
    },
    nextButton: {
        backgroundColor: '#4A90E2', // Blue color as per screenshot
        borderRadius: 25,
        height: 55,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default Signup;