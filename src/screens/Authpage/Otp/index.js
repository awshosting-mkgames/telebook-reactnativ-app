import React, { useRef, useState ,useContext } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,StatusBar,Platform
} from 'react-native';
import { ThemeContext } from '../../../components/ThemeContext';

const OTP_LENGTH = 4;

const OtpScreen = ({ setPageSection, renderSection }) => {
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
    const inputs = useRef([]);

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

    return (
        <SafeAreaView  style={[styles.container,{ backgroundColor: theme.background}]}>
              <StatusBar backgroundColor="#1199ff" barStyle="light-content" />
            {/* Header */}
            <TouchableOpacity style={styles.backBtn}>
               <Text style={[styles.backText,{ color: theme.text}]}>←</Text>
            </TouchableOpacity>

           <View style={styles.spacer}>
                <Text style={[styles.title,{color: theme.text}]}>We just sent an SMS</Text>
                <Text style={[styles.subtitle,{color: theme.text}]}>
                    Enter the security code we sent to
                </Text>
                <Text style={[styles.phone,{color: theme.text}]}>+32 123456789</Text>

                {/* OTP Inputs */}
                <View style={styles.otpRow}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => (inputs.current[index] = ref)}
                            style={[
                                styles.otpBox,
                                digit ? styles.activeBox : null,
                                { backgroundColor: theme.background,color: theme.text}
                            ]}
                            keyboardType="number-pad"
                            maxLength={1}
                            value={digit}
                            onChangeText={(text) => handleChange(text, index)}
                            onKeyPress={({ nativeEvent }) =>
                                handleBackspace(nativeEvent.key, index)
                            }
                        />
                    ))}
                </View>

                {/* Verify Button */}
                <TouchableOpacity style={styles.verifyBtn} onPress={() => renderSection(5)}>
                    <Text style={styles.verifyText}>Verify</Text>
                </TouchableOpacity>

                {/* Resend */}
                <Text style={[styles.resendText,{color: theme.text}]}>
                    Didn’t receive code?
                </Text>
                <TouchableOpacity>
                    <Text style={styles.resendLink}>Resend 00:56</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default OtpScreen;


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 20,

    },
    spacer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',  
        width: '100%', 
    },
    backBtn: {
        position: 'absolute',
        top: 20,
        left: 16,
    },
    backArrow: {
        fontSize: 22,
    },
    title: {
        marginTop: 80,
        fontSize: 22,
        fontWeight: '600',
    },
    subtitle: {
        marginTop: 30,
        color: '#999',
        fontSize:18
    },
    phone: {
        marginTop: 6,
        color: '#aaa',
        fontSize:16
    },
    otpRow: {
        flexDirection: 'row',
        marginTop: 40,
    },
    otpBox: {
        width: 60,
        height: 60,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#ddd',
        marginHorizontal: 8,
        textAlign: 'center',
        fontSize: 22,
        backgroundColor: '#f5f5f5',
    },
    activeBox: {
        borderColor: '#0096ff',
        backgroundColor: '#fff',
    },
    verifyBtn: {
        marginTop: 40,
        width: '85%',
        height: 55,
        backgroundColor: '#0096ff',
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    verifyText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    resendText: {
        marginTop: 30,
        color: '#999',
    },
    resendLink: {
        marginTop: 6,
        color: '#54b4f9',
        fontWeight: '500',
    },
});