import { Ionicons } from '@expo/vector-icons';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { getImageUrl } from './helpers';

 

const GroupHeader = ({ groupDetails, theme, onImagePress, onNamePress, onAddMember,IspermissonasAdmin }) => (
    <View style={styles.profileHeader}>

    
        <TouchableOpacity onPress={onImagePress} activeOpacity={0.85} style={styles.avatarContainer}>
            <Image
                source={{
                    uri: getImageUrl(groupDetails?.groupIcon)
                        || `https://ui-avatars.com/api/?name=${encodeURIComponent(groupDetails?.chatName || 'Group')}&background=3498db&color=fff&size=200`,
                }}
                style={styles.avatar}
            />
            <View style={styles.cameraOverlay}>
                <Ionicons name="camera" size={18} color="#fff" />
            </View>
        </TouchableOpacity>

        {/* Name — tap to edit */}
        <TouchableOpacity onPress={onNamePress} style={styles.nameRow} activeOpacity={0.7}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {groupDetails?.chatName || 'Group'}
            </Text>
            <Ionicons name="pencil" size={16} color="#3498db" style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        <Text style={styles.sub}>
            Group • {groupDetails?.totalMembers || 0} members
        </Text>
       
    </View>
);

const styles = StyleSheet.create({
    profileHeader:  { alignItems: 'center', paddingVertical: 25 },
    avatarContainer:{ position: 'relative' },
    avatar:         { width: 110, height: 110, borderRadius: 55, backgroundColor: '#eee' },
    cameraOverlay:  {
        position: 'absolute', bottom: 0, right: 0,
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#3498db',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: '#fff',
    },
    nameRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 20 },
    name:           { fontSize: 20, fontWeight: '700', textAlign: 'center' },
    sub:            { fontSize: 13, color: '#727272', marginTop: 4 },
    actionRow:      { flexDirection: 'row', marginTop: 20, width: '92%', justifyContent: 'space-around' },
    actionBtn:      { width: '22%', height: 65, borderRadius: 12, borderWidth: 1, borderColor: '#eee', justifyContent: 'center', alignItems: 'center' },
    actionIconWrap: { marginBottom: 5 },
    actionLabel:    { fontSize: 12, color: '#555' },
});

export default GroupHeader;
