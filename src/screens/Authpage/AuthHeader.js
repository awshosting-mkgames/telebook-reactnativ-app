import { Ionicons } from '@expo/vector-icons';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Auth flow ka common header: back button + beech me title.
// Status bar ki jagah (insets.top) parent screen deta hai.
const AuthHeader = ({ title, onBack, c }) => (
    <>
        <StatusBar translucent backgroundColor="transparent" barStyle={c.barStyle} />
        <View style={[styles.header, { borderBottomColor: c.border }]}>
            <TouchableOpacity style={[styles.backBtn, { backgroundColor: c.card }]} onPress={onBack} hitSlop={8}>
                <Ionicons name="arrow-back" size={22} color={c.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{title}</Text>
            <View style={styles.backBtn} />
        </View>
    </>
);

export default AuthHeader;

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        textAlign: 'center',
        fontSize: 17,
        fontWeight: '700',
    },
});
