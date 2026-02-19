import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,Platform
} from 'react-native';
import Images from '../../../utils/images';
import { ThemeContext } from '../../../components/ThemeContext';

const LoginScreen = ({ setPageSection, renderSection }) => {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const { theme, toggleTheme } = useContext(ThemeContext);

    const handleLogin = () => {
        console.log('Login pressed1₹', { phone, password });
        renderSection(4); // Navigate to the welcome screen after login

    };

    return (
        <SafeAreaView  style={[styles.container,{ backgroundColor: theme.background}]}>
            <StatusBar backgroundColor="#1199ff" barStyle="light-content" />
            <TouchableOpacity style={styles.backBtn} onPress={() => renderSection(2)}>
                <Text style={[styles.backText,{ color: theme.text}]}>←</Text>
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Image
                    source={Images.MobileLoginCuat}
                    style={styles.image}
                    resizeMode="contain"
                />
                <Text style={[styles.label,{ color: theme.text}]}>Mobile number</Text>
                <View style={[styles.mobileRow,{ backgroundColor: theme.inputBackground}]}>
                    <View style={[styles.countryCode,{ backgroundColor: theme.background}]}>
                        <Text style={[styles.codeText,{ color: theme.text}]}>91 +</Text>
                    </View>
                    <TextInput
                        placeholder="Enter mobile number"
                        keyboardType="phone-pad"
                        style={[styles.input,{ backgroundColor: theme.background,color: theme.text}]}
                    />
                </View>
               
            </ScrollView>

            {/* Button */}
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    backBtn: {
        padding: 16,
        
    },
    backText: {
        fontSize: 22,
    },
    content: {
        paddingHorizontal: 24,
        paddingBottom: 120,
        paddingTop: 20,
    },
    image: {
        width: '100%',
        height: 260,
        marginBottom: 24,
    },
    label: {
        fontSize: 17,
        color: '#333',
        marginBottom: 6,
        marginTop: 12,
    },
    mobileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F4F4F4',
        borderRadius: 12,
        marginBottom: 20,
        padding: 6,
    },
    countryCode: {
        height: 52,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        marginRight: 10,
    },
    codeText: {
        fontSize: 16,
    },
    input: {
        flex: 1,
        height: 52,
        borderRadius: 12,
        backgroundColor: '#F4F4F4',
        paddingHorizontal: 16,
        fontSize: 16,
    },
    inputFull: {
        height: 52,
        borderRadius: 12,
        backgroundColor: '#F4F4F4',
        paddingHorizontal: 16,
        fontSize: 14,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    half: {
        width: '48%',
    },
    activeInput: {
        borderWidth: 2,
        borderColor: '#1294F2',
        backgroundColor: '#fff',
    },
    button: {
        position: 'absolute',
        bottom: 24,
        left: 24,
        right: 24,
        height: 54,
        backgroundColor: '#1294F2',
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LoginScreen;