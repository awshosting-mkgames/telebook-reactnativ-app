import React, { useState, useContext } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    StatusBar,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ThemeContext } from '../../../components/ThemeContext';
import Toast from 'react-native-toast-message';
import apiService from '../../../services/apiService';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { saveData } from '../../../services/staticStorage';
import { settotalappData } from '../../../redex/slices/totalappDataSlice';

const Signup = ({ navigation, renderSection }) => {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        city: '',
        about: 'Hey there! I am using TeleBook',
    });
    const [focused, setFocused] = useState('');

    const validateForm = () => {
        if (!formData.name.trim()) {
            Toast.show({ type: 'error', text1: 'Name required' });
            return false;
        }
        if (!formData.city.trim()) {
            Toast.show({ type: 'error', text1: 'City required' });
            return false;
        }
        if (!formData.about.trim()) {
            Toast.show({ type: 'error', text1: 'About required' });
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        try {
            setLoading(true);
            const res = await apiService({
                method: 'POST',
                endpoint: 'auth/complete-profile',
                data: formData,
            });
            if (res?.success) {
                const Data = res?.data;
                Toast.show({ type: 'success', text1: 'Profile created Successfully 🎉' });
                await saveData('userData', JSON.stringify(Data?.user));
                dispatch(settotalappData({ user: Data?.user, isLogin: true }));
                renderSection(6);
            } else {
                Toast.show({ type: 'error', text1: res?.error || 'Signup failed' });
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Server Error' });
        } finally {
            setLoading(false);
        }
    };

    const fields = [
        { key: 'name', label: t('full_name'), placeholder: t('enter_full_name'), icon: 'person-outline', type: 'default' },
        { key: 'city', label: t('city'), placeholder: t('enter_city'), icon: 'location-outline', type: 'default' },
        { key: 'about', label: t('About'), placeholder: t('write_about'), icon: 'information-circle-outline', type: 'default' },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor="#1199ff" barStyle="light-content" />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.borderColor || '#eee' }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => renderSection(4)}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Complete Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                    {/* Avatar */}
                    <View style={styles.avatarSection}>
                        <View style={[styles.avatar, { backgroundColor: theme.inputBackground || '#EEF4FF' }]}>
                            <Ionicons name="person" size={40} color="#1294F2" />
                        </View>
                        <TouchableOpacity style={styles.avatarEditBtn}>
                            <Ionicons name="camera" size={14} color="#fff" />
                        </TouchableOpacity>
                        <Text style={[styles.avatarHint, { color: theme.subText || '#aaa' }]}>
                            Tap to add photo
                        </Text>
                    </View>

                    {/* Fields */}
                    {fields.map((field) => (
                        <View key={field.key} style={styles.fieldGroup}>
                            <Text style={[styles.label, { color: theme.subText || '#666' }]}>{field.label}</Text>
                            <View style={[
                                styles.inputRow,
                                { backgroundColor: theme.inputBackground || '#F5F5F5', borderColor: focused === field.key ? '#1294F2' : (theme.borderColor || '#E8E8E8') },
                                focused === field.key && styles.inputFocused,
                            ]}>
                                <Ionicons name={field.icon} size={20} color={focused === field.key ? '#1294F2' : '#aaa'} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    placeholder={field.placeholder}
                                    placeholderTextColor="#bbb"
                                    value={formData[field.key]}
                                    onChangeText={(text) => setFormData({ ...formData, [field.key]: text })}
                                    onFocus={() => setFocused(field.key)}
                                    onBlur={() => setFocused('')}
                                    keyboardType={field.type}
                                />
                                {formData[field.key].trim().length > 0 && (
                                    <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                                )}
                            </View>
                        </View>
                    ))}

                    {/* Submit */}
                    <TouchableOpacity
                        style={[styles.submitBtn, loading && styles.submitDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <Text style={styles.submitText}>Please wait...</Text>
                        ) : (
                            <>
                                <Text style={styles.submitText}>Create Profile</Text>
                                <Ionicons name="checkmark" size={20} color="#fff" style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
            <Toast />
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
        paddingHorizontal: 22,
        paddingBottom: 60,
        paddingTop: 24,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarEditBtn: {
        position: 'absolute',
        bottom: 28,
        right: '35%',
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#1294F2',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    avatarHint: {
        fontSize: 12,
        marginTop: 8,
    },
    fieldGroup: {
        marginBottom: 18,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 54,
        borderWidth: 1.5,
    },
    inputFocused: {
        backgroundColor: '#F0F8FF',
    },
    input: {
        flex: 1,
        fontSize: 15,
        paddingVertical: 0,
    },
    submitBtn: {
        height: 54,
        backgroundColor: '#1294F2',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginTop: 12,
    },
    submitDisabled: {
        backgroundColor: '#85B7EB',
    },
    submitText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default Signup;
