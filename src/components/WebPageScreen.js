import { Ionicons } from '@expo/vector-icons';
import { useContext, useRef, useState } from 'react';
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
import { getUiColors, PRIMARY } from '../utils/uiColors';
import { ThemeContext } from './ThemeContext';

export default function WebPageScreen({ navigation, title, url }) {
    const { theme } = useContext(ThemeContext);
    const c = getUiColors(theme);
    const insets = useSafeAreaInsets();
    const webRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const retry = () => {
        setFailed(false);
        setLoading(true);
        webRef.current?.reload();
    };

    return (
        <View style={[styles.container, { backgroundColor: c.bg }]}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>

            <View style={[styles.webviewWrap, { paddingBottom: insets.bottom }]}>
                <WebView
                    ref={webRef}
                    source={{ uri: url }}
                    style={[styles.webview, { backgroundColor: c.bg }]}
                    onLoadStart={() => setLoading(true)}
                    onLoadEnd={() => setLoading(false)}
                    onError={() => setFailed(true)}
                    onHttpError={() => setFailed(true)}
                    javaScriptEnabled
                    domStorageEnabled
                />
                {(loading || failed) && (
                    <View style={[styles.overlay, { backgroundColor: c.bg }]}>
                        {failed ? (
                            <>
                                <View style={[styles.errorIcon, { backgroundColor: c.primarySoft }]}>
                                    <Ionicons name="cloud-offline-outline" size={34} color={PRIMARY} />
                                </View>
                                <Text style={[styles.errorTitle, { color: c.text }]}>Page load nahi hua</Text>
                                <Text style={[styles.errorSub, { color: c.subText }]}>
                                    Internet check karke dobara try karein
                                </Text>
                                <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.85}>
                                    <Text style={styles.retryText}>Retry</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <ActivityIndicator size="large" color={PRIMARY} />
                        )}
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
        backgroundColor: PRIMARY,
        paddingHorizontal: 12,
        paddingBottom: 14,
        gap: 12,
    },
    backBtn: { padding: 4 },
    title: { flex: 1, color: '#fff', fontSize: 19, fontWeight: '700' },
    webviewWrap: { flex: 1 },
    webview: { flex: 1 },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    errorIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    errorTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
    errorSub: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
    retryBtn: { backgroundColor: PRIMARY, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24 },
    retryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
