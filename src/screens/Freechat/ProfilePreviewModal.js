import { Ionicons } from '@expo/vector-icons';
import { Dimensions, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// WhatsApp jaisa: chat list me avatar tap karne par profile photo bada popup me — upar naam,
// neeche Message / Call / Video / Info. Bahar tap karne par band.
const CARD_W = Math.min(Dimensions.get('window').width * 0.78, 340);

const getInitials = (name = '') => String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export default function ProfilePreviewModal({ item, theme, onClose, onMessage, onCall, onVideo, onInfo }) {
    if (!item) return null;
    const accent = theme?.main || '#1199ff';
    const isGroup = !!item.isGroupChat;
    const dark = theme?.mode === 'dark';
    const cardBg = dark ? '#1f2c34' : '#ffffff';
    const hasPhoto = !!item.displayAvatar;

    const Action = ({ icon, onPress, label }) => (
        <TouchableOpacity style={styles.action} onPress={onPress} activeOpacity={0.7} accessibilityLabel={label}>
            <Ionicons name={icon} size={26} color={accent} />
        </TouchableOpacity>
    );

    return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={[styles.card, { backgroundColor: cardBg, width: CARD_W }]} onPress={() => {}}>
                    <View style={{ width: CARD_W, height: CARD_W }}>
                        {hasPhoto ? (
                            <Image source={{ uri: item.displayAvatar }} style={styles.photo} resizeMode="cover" />
                        ) : (
                            <View style={[styles.photo, styles.photoFallback, { backgroundColor: accent }]}>
                                <Text style={styles.initials}>{getInitials(item.displayName)}</Text>
                            </View>
                        )}
                        <View style={styles.nameBar}>
                            <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
                        </View>
                    </View>
                    <View style={styles.actions}>
                        <Action icon="chatbubble-ellipses" label="Message" onPress={onMessage} />
                        {!isGroup && <Action icon="call" label="Call" onPress={onCall} />}
                        {!isGroup && <Action icon="videocam" label="Video call" onPress={onVideo} />}
                        <Action icon="information-circle" label="Info" onPress={onInfo} />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center' },
    card: { borderRadius: 8, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    photo: { width: '100%', height: '100%', backgroundColor: '#2b2b2b' },
    photoFallback: { alignItems: 'center', justifyContent: 'center' },
    initials: { color: '#fff', fontSize: 84, fontWeight: '700' },
    nameBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.38)' },
    name: { color: '#fff', fontSize: 18, fontWeight: '600' },
    actions: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10 },
    action: { width: 56, height: 44, alignItems: 'center', justifyContent: 'center' },
});
