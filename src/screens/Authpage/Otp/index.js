import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import { useDispatch } from 'react-redux';
import { getStoredToken } from '../../../components/notification';
import { ThemeContext } from '../../../components/ThemeContext';
import { settotalappData } from '../../../redex/slices/totalappDataSlice';
import apiService from '../../../services/apiService';
import { saveData } from '../../../services/staticStorage';

const OTP_LENGTH = 4;

const OtpScreen = ({ setPageSection, renderSection, logindataPage, setlogindataPage, setOtpdataPage }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { theme } = useContext(ThemeContext);
    const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
    const [loading, setLoading] = useState(false);
    const [fcmTokensend, setfcmTokensend] = useState('');
    const lang = 'en';
    const inputs = useRef([]);

    useEffect(() => {
        const initToken = async () => {
            let token = await getStoredToken();
            setfcmTokensend(token);
        };
        initToken();
    }, []);

    const handleChange = (text, index) => {
        if (/^\d?$/.test(text)) {
            const newOtp = [...otp];
            newOtp[index] = text;
            setOtp(newOtp);
            if (text && index < OTP_LENGTH - 1) {
                inputs.current[index + 1].focus();
            }
        }
    };

    const handleBackspace = (key, index) => {
        if (key === 'Backspace' && !otp[index] && index > 0) {
            inputs.current[index - 1].focus();
        }
    };

    const handleOtpVerfiy = async () => {
        const str = otp.join('');
        if (str.length !== 4) {
            Toast.show({ type: "error", text1: t('otpError'), text2: "Please enter all 4 digits" });
            return;
        }
        try {
            setLoading(true);
            const res = await apiService({
                method: 'POST',
                endpoint: 'auth/verify-otp',
                data: {
                    mobile: logindataPage?.phonenumber,
                    isdCode: '91',
                    userId: logindataPage?.userId,
                    fcmToken: fcmTokensend,
                    deviceType: 'android',
                    otp: str,
                    language: lang || 'en',
                }
            });
            if (res?.success) {
                let Data = res?.data;
                Toast.show({ type: "success", text1: "Success", text2: "OTP verified successfully" });
                await saveData('userData', JSON.stringify(Data?.user));
                await saveData('token', Data?.token);
                await saveData('userId', Data?.user?.id);
                await saveData('IsLogin', true);
                if (Data?.isNewUser) {
                    dispatch(settotalappData({ user: Data?.user, isLogin: false, apiToken: Data?.token, userId: Data?.user?.id }));
                    setOtpdataPage(res?.data);
                    renderSection(5);
                } else {
                    dispatch(settotalappData({ user: Data?.user, isLogin: true, apiToken: Data?.token, userId: Data?.user?.id }));
                    renderSection(6);
                }
            } else {
                Toast.show({ type: "error", text1: t('otpError'), text2: "Please enter a valid OTP" });
            }
        } catch (error) {
            Toast.show({ type: "error", text1: t('otpError'), text2: "Please enter a valid OTP" });
        } finally {
            setLoading(false);
        }
    };

    const resendOtp = async () => {
        try {
            setLoading(true);
            setOtp(Array(OTP_LENGTH).fill(''));
            const res = await apiService({
                method: 'POST',
                endpoint: 'auth/send-otp',
                data: {
                    mobile: logindataPage?.phonenumber,
                    isdCode: '91',
                    language: lang || 'en',
                }
            });
            if (res?.success) {
                Toast.show({ type: "success", text1: "Success", text2: "OTP resent successfully" });
                setlogindataPage({ ...res?.data, phonenumber: logindataPage?.phonenumber });
                renderSection(4);
            } else {
                Toast.show({ type: "error", text1: "Failed", text2: res?.error || 'Something went wrong' });
            }
        } catch (error) {
            Toast.show({ type: "error", text1: "Login Failed", text2: "Something went wrong" });
        } finally {
            setLoading(false);
        }
    };

    const filledCount = otp.filter(d => d !== '').length;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor="#1199ff" barStyle="light-content" />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.borderColor || '#eee' }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => renderSection(3)}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Verify OTP</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                    {/* Icon */}
                    <View style={[styles.iconBox, { backgroundColor: theme.inputBackground || '#EEF4FF' }]}>
                        <Text style={styles.iconEmoji}>🔐</Text>
                    </View>

                    <Text style={[styles.title, { color: theme.text }]}>Enter verification code</Text>
                    <Text style={[styles.subtitle, { color: theme.subText || '#888' }]}>
                        We sent a 4-digit code to
                    </Text>

                    {/* Phone + Change */}
                    <View style={styles.phoneRow}>
                        <Text style={[styles.phone, { color: theme.text }]}>
                            +91 {logindataPage?.phonenumber}
                        </Text>
                        <TouchableOpacity onPress={() => renderSection(3)} style={styles.changeBtn}>
                            <Ionicons name="create-outline" size={14} color="#1294F2" />
                            <Text style={styles.changeText}>Change</Text>
                        </TouchableOpacity>
                    </View>

                    {/* OTP Inputs */}
                    <View style={styles.otpRow}>
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={(ref) => (inputs.current[index] = ref)}
                                style={[
                                    styles.otpBox,
                                    digit ? styles.activeBox : null,
                                    { backgroundColor: theme.inputBackground || '#f5f5f5', color: theme.text, borderColor: digit ? '#1294F2' : (theme.borderColor || '#ddd') }
                                ]}
                                keyboardType="number-pad"
                                maxLength={1}
                                value={digit}
                                onChangeText={(text) => handleChange(text, index)}
                                onKeyPress={({ nativeEvent }) => handleBackspace(nativeEvent.key, index)}
                            />
                        ))}
                    </View>

                    {/* Progress dots */}
                    <View style={styles.progressRow}>
                        {otp.map((_, i) => (
                            <View
                                key={i}
                                style={[styles.dot, i < filledCount ? styles.dotFilled : styles.dotEmpty]}
                            />
                        ))}
                    </View>

                    {/* Verify Button */}
                    <TouchableOpacity
                        style={[styles.verifyBtn, loading && styles.btnDisabled, filledCount < 4 && styles.btnInactive]}
                        onPress={handleOtpVerfiy}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.verifyText}>{loading ? 'Verifying...' : t('submit')}</Text>
                    </TouchableOpacity>

                    {/* Resend */}
                    <View style={styles.resendRow}>
                        <Text style={[styles.resendText, { color: theme.subText || '#999' }]}>
                            Didn't receive code?
                        </Text>
                        <TouchableOpacity onPress={resendOtp} disabled={loading}>
                            <Text style={styles.resendLink}>{t('resendCode')}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default OtpScreen;

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
        paddingTop: 32,
        alignItems: 'center',
    },
    iconBox: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    iconEmoji: {
        fontSize: 40,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 10,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 32,
    },
    phone: {
        fontSize: 16,
        fontWeight: '600',
    },
    changeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#EEF4FF',
        borderRadius: 20,
    },
    changeText: {
        fontSize: 12,
        color: '#1294F2',
        fontWeight: '500',
    },
    otpRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    otpBox: {
        width: 62,
        height: 62,
        borderRadius: 14,
        borderWidth: 1.5,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '700',
    },
    activeBox: {
        borderColor: '#1294F2',
    },
    progressRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 32,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dotFilled: {
        backgroundColor: '#1294F2',
    },
    dotEmpty: {
        backgroundColor: '#ddd',
    },
    verifyBtn: {
        width: '100%',
        height: 54,
        backgroundColor: '#1294F2',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    btnDisabled: {
        backgroundColor: '#85B7EB',
    },
    btnInactive: {
        backgroundColor: '#B0CFEF',
    },
    verifyText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    resendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    resendText: {
        fontSize: 14,
    },
    resendLink: {
        fontSize: 14,
        color: '#1294F2',
        fontWeight: '600',
    },
});
