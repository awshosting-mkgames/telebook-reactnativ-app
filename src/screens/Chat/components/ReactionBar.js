import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🙏', '❌', '❓', '✅'];

// Long press se select mode me ek message chuna ho to header ke neeche turant reaction emojis
// (pehle sirf popup me milte the). `mine` = meri current reaction, usi par highlight.
const ReactionBar = ({ top = 90, isDark, mine, onReact }) => (
    <View pointerEvents="box-none" style={[styles.wrap, { top }]}>
        <View style={[styles.bar, { backgroundColor: isDark ? '#1f2c34' : '#ffffff' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.row}>
                {EMOJIS.map((e) => (
                    <TouchableOpacity key={e} onPress={() => onReact(e)} style={[styles.btn, mine === e && styles.btnOn]}>
                        <Text style={styles.emoji}>{e}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    </View>
);

const styles = StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, zIndex: 20, alignItems: 'center', paddingHorizontal: 12, paddingTop: 6 },
    bar: { borderRadius: 28, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, maxWidth: '100%' },
    row: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, gap: 2 },
    btn: { padding: 5, borderRadius: 20 },
    btnOn: { backgroundColor: 'rgba(18,150,243,0.18)' },
    emoji: { fontSize: 28 },
});

export default ReactionBar;
