import { Ionicons } from '@expo/vector-icons';
import { useContext, useState } from 'react';
import {
    ActivityIndicator,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ThemeContext } from '../../components/ThemeContext';
import GradientFill from '../../components/GradientFill';

// 👉 Apna actual Privacy Policy URL yahan daal do
const PRIVACY_URL = 'https://telebookservices.com/delete-account';

export default function Deleteaccount({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const isDark = theme?.mode === 'dark';
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#0D1117' : '#fff' }]}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            <View style={[styles.topBar, { backgroundColor: theme?.header || '#1199ff', paddingTop: insets.top + 14 }]}>
                <GradientFill />
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>Delete Account</Text>
            </View>

            <View style={styles.webviewWrap}>
                <WebView
                    source={{ uri: PRIVACY_URL }}
                    style={[styles.webview, { backgroundColor: isDark ? '#0D1117' : '#fff' }]}
                    onLoadStart={() => setLoading(true)}
                    onLoadEnd={() => setLoading(false)}
                    startInLoadingState
                    javaScriptEnabled
                    domStorageEnabled
                />
                {loading && (
                    <View style={[styles.loaderOverlay, { backgroundColor: isDark ? '#0D1117' : '#fff' }]}>
                        <ActivityIndicator size="large" color={theme.main} />
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1296f3',
        paddingHorizontal: 12,
        paddingVertical: 14,
        overflow: 'hidden',
        gap: 14,
    },
    backBtn: { padding: 4 },
    title: { color: '#fff', fontSize: 18, fontWeight: '700' },
    webviewWrap: { flex: 1 },
    webview: { flex: 1 },
    loaderOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
});