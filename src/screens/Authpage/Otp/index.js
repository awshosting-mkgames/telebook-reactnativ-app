import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
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
import { useDispatch } from 'react-redux';
import { getStoredToken } from '../../../components/notification';
import { ThemeContext } from '../../../components/ThemeContext';
import { settotalappData } from '../../../redex/slices/totalappDataSlice';
import apiService from '../../../services/apiService';
import { contactSync } from '../../../services/contactSync';
import { getDeviceId, getDeviceInfo } from '../../../services/deviceId';
import { saveData } from '../../../services/staticStorage';
import { getUiColors } from '../../../utils/uiColors';
import AuthHeader from '../AuthHeader';

const OTP_LENGTH = 4;

const OtpScreen = ({ setPageSection, renderSection, logindataPage, setlogindataPage, setOtpdataPage }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { theme } = useContext(ThemeContext);
    const c = getUiColors(theme);
    const insets = useSafeAreaInsets();
    const [focusedIndex, setFocusedIndex] = useState(0);
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
        const digits = text.replace(/\D/g, '');
        const newOtp = [...otp];
        if (digits.length > 1) {
            // Paste / SMS autofill: poora code ek saath aaya
            digits.slice(0, OTP_LENGTH - index).split('').forEach((d, i) => { newOtp[index + i] = d; });
            setOtp(newOtp);
            const last = Math.min(index + digits.length, OTP_LENGTH) - 1;
            inputs.current[last]?.focus();
            return;
        }
        newOtp[index] = digits;
        setOtp(newOtp);
        if (digits && index < OTP_LENGTH - 1) {
            inputs.current[index + 1]?.focus();
        }
    };

    const handleBackspace = (key, index) => {
        if (key === 'Backspace' && !otp[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    const handleOtpVerfiy = async () => {
        if (loading) return;
        const str = otp.join('');
        if (str.length !== OTP_LENGTH) {
            Toast.show({ type: "error", text1: t('otpError'), text2: "Please enter all 4 digits" });
            return;
        }
        try {
            setLoading(true);
            const deviceId = await getDeviceId();
            const res = await apiService({
                method: 'POST',
                endpoint: 'auth/verify-otp',
                data: {
                    mobile: logindataPage?.phonenumber,
                    isdCode: '91',
                    userId: logindataPage?.userId,
                    fcmToken: fcmTokensend,
                    deviceType: 'android',
                    deviceId,
                    ...getDeviceInfo(),
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

                // OTP success par contact sync. Await nahi kar rahe: permission
                // dialog aur 1000+ contacts me waqt lagta hai, user ko OTP screen
                // par rokna nahi hai. Token upar save ho chuka hai isliye sync ki
                // API call authenticate ho jayegi.
                contactSync(dispatch);

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
        <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
            <AuthHeader title="Verify OTP" onBack={() => renderSection(3)} c={c} />

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[styles.iconBox, { backgroundColor: c.primarySoft }]}>
                        <Ionicons name="shield-checkmark" size={40} color={c.primary} />
                    </View>

                    <Text style={[styles.title, { color: c.text }]}>Enter verification code</Text>
                    <Text style={[styles.subtitle, { color: c.subText }]}>
                        We sent a {OTP_LENGTH}-digit code to
                    </Text>

                    {/* Phone + Change */}
                    <View style={styles.phoneRow}>
                        <Text style={[styles.phone, { color: c.text }]}>
                            +91 {logindataPage?.phonenumber}
                        </Text>
                        <TouchableOpacity onPress={() => renderSection(3)} style={[styles.changeBtn, { backgroundColor: c.primarySoft }]}>
                            <Ionicons name="create-outline" size={14} color={c.primary} />
                            <Text style={[styles.changeText, { color: c.primary }]}>Change</Text>
                        </TouchableOpacity>
                    </View>

                    {/* OTP Inputs */}
                    <View style={styles.otpRow}>
                        {otp.map((digit, index) => {
                            const active = focusedIndex === index;
                            return (
                                <TextInput
                                    key={index}
                                    ref={(ref) => (inputs.current[index] = ref)}
                                    style={[
                                        styles.otpBox,
                                        {
                                            backgroundColor: c.card,
                                            color: c.text,
                                            borderColor: active || digit ? c.primary : c.border,
                                        },
                                    ]}
                                    keyboardType="number-pad"
                                    textContentType="oneTimeCode"
                                    autoComplete={index === 0 ? 'sms-otp' : 'off'}
                                    autoFocus={index === 0}
                                    selectTextOnFocus
                                    maxLength={OTP_LENGTH}
                                    value={digit}
                                    onFocus={() => setFocusedIndex(index)}
                                    onChangeText={(text) => handleChange(text, index)}
                                    onKeyPress={({ nativeEvent }) => handleBackspace(nativeEvent.key, index)}
                                />
                            );
                        })}
                    </View>

                    {/* Verify Button */}
                    <TouchableOpacity
                        style={[styles.verifyBtn, { backgroundColor: filledCount === OTP_LENGTH && !loading ? c.primary : c.primaryDisabled }]}
                        onPress={handleOtpVerfiy}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.verifyText}>{t('submit')}</Text>
                        )}
                    </TouchableOpacity>

                    {/* Resend */}
                    <View style={styles.resendRow}>
                        <Text style={[styles.resendText, { color: c.subText }]}>
                            Didn't receive code?
                        </Text>
                        <TouchableOpacity onPress={resendOtp} disabled={loading} hitSlop={8}>
                            <Text style={[styles.resendLink, { color: c.primary }]}>{t('resendCode')}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

export default OtpScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 36,
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
    title: {
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 8,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 32,
    },
    phone: {
        fontSize: 16,
        fontWeight: '700',
    },
    changeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    changeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    otpRow: {
        flexDirection: 'row',
        gap: 14,
        marginBottom: 32,
    },
    otpBox: {
        width: 60,
        height: 64,
        borderRadius: 16,
        borderWidth: 1.5,
        textAlign: 'center',
        fontSize: 26,
        fontWeight: '700',
    },
    verifyBtn: {
        width: '100%',
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    verifyText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
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
        fontWeight: '700',
    },
});
