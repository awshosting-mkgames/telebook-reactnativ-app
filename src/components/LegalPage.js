import { Ionicons } from '@expo/vector-icons';
import { useContext, useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadSystemConfig } from '../services/systemConfig';
import { getUiColors, PRIMARY } from '../utils/uiColors';
import { ThemeContext } from './ThemeContext';
import WebPageScreen from './WebPageScreen';

// Privacy / Terms / About ek hi logic: server (system-config) ka content ho to native dikhao,
// HTML ho to WebView me, sirf url ho to WebPageScreen, kuch na ho (ya backend deploy nahi) to purana fixed URL.
const looksLikeHtml = (s) => /<\/?(p|div|h[1-6]|ul|ol|li|br|span|strong|b|a|body|html)[\s>/]/i.test(s);

// Bahut halka markdown/plain: '# heading', '- bullet', baaki paragraph
function PlainContent({ text, c }) {
    const blocks = String(text).replace(/\r/g, '').split(/\n{2,}/);
    return blocks.map((blk, i) => {
        const line = blk.trim();
        if (!line) return null;
        const h = /^(#{1,3})\s+(.*)$/.exec(line);
        if (h) return <Text key={i} style={[styles.h, { color: c.text }]}>{h[2]}</Text>;
        if (/^([-*•]\s)/.test(line)) {
            return (
                <View key={i} style={styles.listBlock}>
                    {line.split('\n').map((l, j) => (
                        <Text key={j} style={[styles.p, { color: c.text }]}>{'•  '}{l.replace(/^[-*•]\s*/, '')}</Text>
                    ))}
                </View>
            );
        }
        return <Text key={i} style={[styles.p, { color: c.text }]}>{line.replace(/^#+\s*/, '')}</Text>;
    });
}

export default function LegalPage({ navigation, kind, title, fallbackUrl }) {
    const { theme } = useContext(ThemeContext);
    const c = getUiColors(theme);
    const insets = useSafeAreaInsets();
    const [page, setPage] = useState(null);

    useEffect(() => {
        let alive = true;
        loadSystemConfig(kind, (d) => { if (alive) setPage(d); }).catch(() => {});
        return () => { alive = false; };
    }, [kind]);

    const content = typeof page?.content === 'string' ? page.content.trim() : '';
    const pageTitle = page?.title || title;

    if (content && looksLikeHtml(content)) {
        const wrapped = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>`
            + `body{font-family:sans-serif;padding:16px;line-height:1.55;color:${c.text};background:${c.bg};word-wrap:break-word}a{color:${PRIMARY}}img{max-width:100%}`
            + `</style></head><body>${content}</body></html>`;
        return <WebPageScreen navigation={navigation} title={pageTitle} html={wrapped} />;
    }

    if (content) {
        return (
            <View style={[styles.container, { backgroundColor: c.bg }]}>
                <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
                <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.title} numberOfLines={1}>{pageTitle}</Text>
                </View>
                <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
                    <PlainContent text={content} c={c} />
                    {!!page?.version && <Text style={[styles.meta, { color: c.subText }]}>Version {page.version}</Text>}
                </ScrollView>
            </View>
        );
    }

    // Sirf url (ya kuch nahi): url ho to wahi, warna purana fixed page
    return <WebPageScreen navigation={navigation} title={pageTitle} url={page?.url || fallbackUrl} />;
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    topBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: PRIMARY, paddingHorizontal: 12, paddingBottom: 14, gap: 12 },
    backBtn: { padding: 4 },
    title: { flex: 1, color: '#fff', fontSize: 19, fontWeight: '700' },
    body: { padding: 16 },
    h: { fontSize: 18, fontWeight: '700', marginTop: 14, marginBottom: 6 },
    p: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
    listBlock: { marginBottom: 6 },
    meta: { fontSize: 12, marginTop: 8 },
});
