import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Toast from "react-native-toast-message";
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../../components/ThemeContext';
import apiService from '../../../services/apiService';
import Images from '../../../utils/images';
import { saveData } from '../../../services/staticStorage';

const LoginScreen = ({ setPageSection, renderSection, setlogindataPage }) => {
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const lang = 'en';
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);

    useEffect(() => {
        saveData('userData', null);
        saveData('token', null);
        saveData('userId', null);
        saveData('IsLogin', null);
    }, []);

    const validatePhone = () => {
        const phoneRegex = /^[0-9]{10}$/;
        return phoneRegex.test(phone);
    };

    const handleLogin = async () => {
        setError('');
        if (!validatePhone()) {
            Toast.show({
                type: "error",
                text1: t('otpError'),
                text2: t('error_whatsapp_number'),
            });
            return;
        }
        try {
            setLoading(true);
            const newPhonewcode = '91';
            const res = await apiService({
                method: 'POST',
                endpoint: 'auth/send-otp',
                data: {
                    mobile: phone,
                    isdCode: newPhonewcode,
                    language: lang || 'en',
                }
            });
            if (res?.success) {
                Toast.show({
                    type: "success",
                    text1: "Success",
                    text2: "OTP sent successfully",
                });
                setlogindataPage({ ...res?.data, phonenumber: phone });
                renderSection(4);
            } else {
                setError(res?.error || 'Login failed');
                Toast.show({
                    type: "error",
                    text1: "Login Failed",
                    text2: res?.error || 'Something went wrong',
                });
            }
        } catch (err) {
            Toast.show({
                type: "error",
                text1: t('login'),
                text2: "We couldn't process your request right now. Please try again",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor="#1199ff" barStyle="light-content" />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.borderColor || '#eee' }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => renderSection(2)}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Phone Login</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Image
                        source={Images.MobileLoginCuat}
                        style={styles.image}
                        resizeMode="contain"
                    />

                    <Text style={[styles.heading, { color: theme.text }]}>Enter your number</Text>
                    <Text style={[styles.subheading, { color: theme.subText || '#888' }]}>
                        We'll send you a one-time verification code
                    </Text>

                    {/* Phone Input */}
                    <View style={[
                        styles.inputWrapper,
                        { backgroundColor: theme.inputBackground || '#F4F4F4', borderColor: theme.borderColor || '#E8E8E8' }
                    ]}>
                        <View style={[styles.countryCode, { backgroundColor: theme.background }]}>
                            <Text style={styles.flag}>🇮🇳</Text>
                            <Text style={[styles.codeText, { color: theme.text }]}>+91</Text>
                        </View>
                        <View style={styles.divider} />
                        <TextInput
                            placeholder="98765 43210"
                            keyboardType="phone-pad"
                            maxLength={10}
                            value={phone}
                            onChangeText={(text) => {
                                setPhone(text);
                                if (error) setError('');
                            }}
                            placeholderTextColor="#bbb"
                            style={[styles.input, { color: theme.text }]}
                        />
                    </View>

                    {error ? (
                        <View style={styles.errorRow}>
                            <Ionicons name="alert-circle" size={14} color="#e24b4a" />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <Text style={[styles.hint, { color: theme.subText || '#aaa' }]}>
                        Standard SMS rates may apply
                    </Text>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <Text style={styles.buttonText}>Please wait...</Text>
                        ) : (
                            <>
                                <Text style={styles.buttonText}>Send OTP</Text>
                                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    content: {
        paddingHorizontal: 24,
        paddingBottom: 60,
        paddingTop: 24,
    },
    image: {
        width: '100%',
        height: 220,
        marginBottom: 28,
    },
    heading: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 6,
    },
    subheading: {
        fontSize: 14,
        marginBottom: 24,
        lineHeight: 20,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1.5,
        overflow: 'hidden',
        marginBottom: 8,
    },
    countryCode: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 16,
    },
    flag: {
        fontSize: 18,
    },
    codeText: {
        fontSize: 15,
        fontWeight: '600',
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: '#ddd',
    },
    input: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 16,
        fontSize: 16,
        letterSpacing: 1,
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    errorText: {
        color: '#e24b4a',
        fontSize: 13,
    },
    hint: {
        fontSize: 12,
        marginBottom: 32,
    },
    button: {
        height: 54,
        backgroundColor: '#1294F2',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    buttonDisabled: {
        backgroundColor: '#85B7EB',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LoginScreen;
