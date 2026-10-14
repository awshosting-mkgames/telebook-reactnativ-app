import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Toast from "react-native-toast-message";
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../../../components/ThemeContext';
import { getUiColors } from '../../../utils/uiColors';
import AuthHeader from '../AuthHeader';
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
    const c = getUiColors(theme);
    const insets = useSafeAreaInsets();
    const [focused, setFocused] = useState(false);
    const isValid = /^[0-9]{10}$/.test(phone);

    useEffect(() => {
        saveData('userData', null);
        saveData('token', null);
        saveData('userId', null);
        saveData('IsLogin', null);
    }, []);

    const handleLogin = async () => {
        if (loading) return;
        setError('');
        if (!isValid) {
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
        <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
            <AuthHeader title="Phone Login" onBack={() => renderSection(2)} c={c} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Image
                        source={Images.MobileLoginCuat}
                        style={styles.image}
                        resizeMode="contain"
                    />

                    <Text style={[styles.heading, { color: c.text }]}>Enter your number</Text>
                    <Text style={[styles.subheading, { color: c.subText }]}>
                        We'll send you a one-time verification code
                    </Text>

                    {/* Phone Input */}
                    <View style={[
                        styles.inputWrapper,
                        {
                            backgroundColor: c.card,
                            borderColor: error ? c.error : focused ? c.primary : c.border,
                        }
                    ]}>
                        <View style={styles.countryCode}>
                            <Text style={styles.flag}>🇮🇳</Text>
                            <Text style={[styles.codeText, { color: c.text }]}>+91</Text>
                        </View>
                        <View style={[styles.divider, { backgroundColor: c.border }]} />
                        <TextInput
                            placeholder="98765 43210"
                            keyboardType="phone-pad"
                            textContentType="telephoneNumber"
                            autoComplete="tel"
                            maxLength={10}
                            value={phone}
                            onChangeText={(text) => {
                                setPhone(text.replace(/\D/g, ''));
                                if (error) setError('');
                            }}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            onSubmitEditing={handleLogin}
                            placeholderTextColor={c.mutedText}
                            style={[styles.input, { color: c.text }]}
                        />
                        {isValid && (
                            <Ionicons name="checkmark-circle" size={20} color={c.primary} style={{ marginRight: 14 }} />
                        )}
                    </View>

                    {error ? (
                        <View style={styles.errorRow}>
                            <Ionicons name="alert-circle" size={14} color={c.error} />
                            <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>
                        </View>
                    ) : null}

                    <Text style={[styles.hint, { color: c.mutedText }]}>
                        Standard SMS rates may apply
                    </Text>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: isValid && !loading ? c.primary : c.primaryDisabled }]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.buttonText}>Send OTP</Text>
                                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    image: {
        width: '100%',
        height: 220,
        marginBottom: 24,
    },
    heading: {
        fontSize: 24,
        fontWeight: '800',
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
        fontSize: 16,
        fontWeight: '600',
    },
    divider: {
        width: 1,
        height: 28,
    },
    input: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 16,
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: 1,
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    errorText: {
        fontSize: 13,
    },
    hint: {
        fontSize: 12,
        marginBottom: 28,
    },
    button: {
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default LoginScreen;
