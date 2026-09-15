import { Ionicons } from '@expo/vector-icons';
import { useContext, useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ThemeContext } from '../../components/ThemeContext';

// 👉 Apna actual Privacy Policy URL yahan daal do
const PRIVACY_URL = 'https://telebookservices.com/about';

export default function Aboutus({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const isDark = theme?.mode === 'dark';
    const [loading, setLoading] = useState(true);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0D1117' : '#fff' }]}>
            <StatusBar backgroundColor="#1296f3" barStyle="light-content" />
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>About us</Text>
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
                        <ActivityIndicator size="large" color="#1296f3" />
                    </View>
                )}
            </View>
        </SafeAreaView>
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