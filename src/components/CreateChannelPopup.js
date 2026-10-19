import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Keyboard,
    Modal,
    Platform,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { ThemeContext } from '../components/ThemeContext';
import apiService from '../services/apiService';
import { appendFile } from '../utils/uploadFile';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CreateChannelPopup = ({ visible, onClose }) => {
    const { theme } = useContext(ThemeContext);
    const isDark = theme.text === '#FFFFFF';
    const navigation = useNavigation();

    const [channelName, setChannelName] = useState('');
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isPrivate, setIsPrivate] = useState(false);

    const shiftAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, () => {
            Animated.timing(shiftAnim, { toValue: -100, duration: 300, useNativeDriver: true }).start();
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            Animated.timing(shiftAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
        });
        return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });
        if (!result.canceled) setImage(result.assets[0].uri);
    };

    const handleCreateChannel = async () => {
        if (!channelName.trim()) { Toast.show({ type: 'error', text1: 'Name Required' }); return; }
        if (!image) { Toast.show({ type: 'error', text1: 'Icon Required' }); return; }

        setLoading(true);
        const formData = new FormData();
        formData.append('channelName', channelName);
        // Server string 'true'/'false' parse karta hai (multipart)
        formData.append('isPrivate', isPrivate ? 'true' : 'false');
        const filename = image.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image';
        await appendFile(formData, 'channelIcon', { uri: image, name: filename, type });

        try {
            const response = await apiService({ method: 'POST', endpoint: 'channels', data: formData, isMultipart: true });
            if (response.success) {
                Toast.show({ type: 'success', text1: 'Success 🎉' });
                setChannelName('');
                setImage(null);
                setIsPrivate(false);
                onClose();
            } else if (response.error?.code === 'PLAN_LIMIT') {
                // CreateGroup / CreateBroadcast jaisa hi Plan Limit alert
                Alert.alert(
                    'Plan Limit Reached',
                    ['Plan Limit Reached \u2013 Upgrade your plan to continue.', response.error.message].filter(Boolean).join('\n'),
                    [
                        { text: 'Upgrade Plan', onPress: () => { onClose(); navigation.navigate('Plans'); } },
                        { text: 'Cancel', style: 'cancel' },
                    ],
                );
            } else {
                Toast.show({ type: 'error', text1: 'Failed', text2: response.error?.message || 'Try again' });
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Failed', text2: 'Try again' });
        } finally {
            setLoading(false);
        }
    };

    // ── theme values ──────────────────────────────────────────────
    const sheetBg = isDark ? '#1a1a1a' : '#ffffff';
    const titleColor = isDark ? '#e0e0e0' : '#000000';
    const closeColor = isDark ? '#aaa' : '#333';
    const hintColor = isDark ? '#666' : '#888';
    const disclaimerClr = isDark ? '#555' : '#777';
    const inputColor = isDark ? '#e0e0e0' : '#000000';
    const placeholderClr = isDark ? '#555' : '#999';
    const imageBg = isDark ? '#2a2a2a' : '#f8f8f8';
    const imageBorder = isDark ? '#333' : '#eee';
    const cameraColor = isDark ? '#888' : '#666';
    const dividerColor = '#25D366';

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); onClose(); }}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                <Animated.View style={[styles.sheet, { backgroundColor: sheetBg, transform: [{ translateY: shiftAnim }] }]}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.container}>

                            {/* Header */}
                            <View style={styles.header}>
                                <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                                    <Ionicons name="close" size={22} color={closeColor} />
                                </TouchableOpacity>
                                <Text style={[styles.headerTitle, { color: titleColor }]}>Create Channel</Text>
                                <TouchableOpacity onPress={handleCreateChannel} disabled={loading} style={styles.headerBtn}>
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#25D366" />
                                    ) : (
                                        <Text style={styles.createText}>Create</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Divider */}
                            <View style={[styles.headerDivider, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]} />

                            {/* Image Section */}
                            <View style={styles.imageSection}>
                                <TouchableOpacity
                                    style={[styles.imagePlaceholder, { backgroundColor: imageBg, borderColor: imageBorder }]}
                                    onPress={pickImage}
                                    activeOpacity={0.8}
                                >
                                    {image ? (
                                        <Image source={{ uri: image }} style={styles.profileImage} />
                                    ) : (
                                        <View style={styles.cameraIconBg}>
                                            <Ionicons name="camera" size={28} color={cameraColor} />
                                        </View>
                                    )}
                                    {/* Edit overlay when image selected */}
                                    {image && (
                                        <View style={styles.editOverlay}>
                                            <Ionicons name="camera" size={18} color="#fff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                                <Text style={[styles.imageHint, { color: hintColor }]}>
                                    {image ? 'Tap to change' : 'Add channel icon'}
                                </Text>
                            </View>

                            {/* Input Section */}
                            <View style={[styles.inputContainer, { borderBottomColor: dividerColor }]}>
                                <Text style={styles.inputLabel}>Channel Name</Text>
                                <TextInput
                                    style={[styles.input, { color: inputColor }]}
                                    placeholder="Enter channel name..."
                                    value={channelName}
                                    onChangeText={setChannelName}
                                    maxLength={30}
                                    editable={!loading}
                                    placeholderTextColor={placeholderClr}
                                />
                            </View>

                            {/* Char count */}
                            <Text style={[styles.charCount, { color: hintColor }]}>
                                {channelName.length}/30
                            </Text>

                            <View style={styles.switchRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.switchTitle, { color: titleColor }]}>
                                        {isPrivate ? 'Private channel' : 'Public channel'}
                                    </Text>
                                    <Text style={[styles.switchHint, { color: disclaimerClr }]}>
                                        Public channels can be found and joined by anyone. Private channels need the invite link.
                                    </Text>
                                </View>
                                <Switch
                                    value={isPrivate}
                                    onValueChange={setIsPrivate}
                                    disabled={loading}
                                    trackColor={{ false: isDark ? '#444' : '#ccc', true: theme.header || '#1199ff' }}
                                    thumbColor="#fff"
                                />
                            </View>

                        </View>
                    </TouchableWithoutFeedback>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, alignItems: 'center', paddingTop: SCREEN_HEIGHT * 0.28 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: { width: '90%', borderRadius: 16, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, overflow: 'hidden' },
    container: { padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    headerBtn: { width: 46, alignItems: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '700' },
    createText: { color: '#25D366', fontSize: 15, fontWeight: '700' },
    headerDivider: { height: 0.5, marginBottom: 18 },
    imageSection: { alignItems: 'center', marginBottom: 22 },
    imagePlaceholder: { width: 84, height: 84, borderRadius: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, overflow: 'hidden' },
    profileImage: { width: '100%', height: '100%' },
    editOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    cameraIconBg: { alignItems: 'center', justifyContent: 'center' },
    imageHint: { marginTop: 8, fontSize: 12 },
    inputContainer: { borderBottomWidth: 1.5, paddingVertical: 4, marginBottom: 6 },
    inputLabel: { fontSize: 11, color: '#25D366', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { fontSize: 16, marginTop: 4, paddingVertical: 6 },
    charCount: { fontSize: 11, textAlign: 'right', marginBottom: 12 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
    switchTitle: { fontSize: 14, fontWeight: '700' },
    switchHint: { fontSize: 12, lineHeight: 17, marginTop: 2 },
    disclaimer: { textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 4 },
});

export default CreateChannelPopup;