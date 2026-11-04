import React from 'react';
import {
    View, Text, Image, TouchableOpacity,
    ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from './helpers';

const GroupMedia = ({ mediaDetails, theme, onMediaPress }) => {
    const mediaImages = mediaDetails?.images?.items || [];

    return (
        <View style={styles.section}>
            {/* Header */}
            <View style={styles.rowBetween}>
                <View style={styles.row}>
                    <View style={[styles.titleIcon, { backgroundColor: (theme.main || '#3498db') + '18' }]}>
                        <Ionicons name="images" size={16} color={theme.main || '#3498db'} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Media, links & docs</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.grayText}>{mediaDetails?.total || 0}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#9f9f9f" />
                </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                {mediaDetails?.images?.count > 0 && (
                    <View style={styles.stat}>
                        <Ionicons name="image-outline" size={16} color={theme.main || '#3498db'} />
                        <Text style={[styles.statText, { color: theme.main || '#3498db' }]}>{mediaDetails.images.count} Photos</Text>
                    </View>
                )}
                {mediaDetails?.videos?.count > 0 && (
                    <View style={styles.stat}>
                        <Ionicons name="videocam-outline" size={16} color={theme.main || '#3498db'} />
                        <Text style={[styles.statText, { color: theme.main || '#3498db' }]}>{mediaDetails.videos.count} Videos</Text>
                    </View>
                )}
                {mediaDetails?.documents?.count > 0 && (
                    <View style={styles.stat}>
                        <Ionicons name="document-outline" size={16} color={theme.main || '#3498db'} />
                        <Text style={[styles.statText, { color: theme.main || '#3498db' }]}>{mediaDetails.documents.count} Docs</Text>
                    </View>
                )}
            </View>

            {/* Thumbnails */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
                {mediaImages.length > 0 ? (
                    mediaImages.slice(0, 7).map((item, index) => (
                        <TouchableOpacity
                            key={item._id || index}
                            onPress={() => onMediaPress(index)}
                            activeOpacity={0.85}
                        >
                            <Image
                                source={{ uri: getImageUrl(item.attachments?.[0]?.url) }}
                                style={styles.thumb}
                            />
                            {/* "+N more" overlay on last thumb */}
                            {index === 6 && mediaImages.length > 7 && (
                                <View style={styles.moreOverlay}>
                                    <Text style={styles.moreText}>+{mediaImages.length - 7}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))
                ) : (
                    <View style={styles.noMedia}>
                        <Ionicons name="images-outline" size={22} color="#b0b0b0" />
                        <Text style={styles.noMediaText}>No media yet</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    section:      { padding: 16 },
    rowBetween:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    row:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
    titleIcon:    { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '700' },
    grayText:     { color: '#9f9f9f', fontSize: 14, fontWeight: '600' },
    statsRow:     { flexDirection: 'row', marginTop: 10, gap: 14 },
    stat:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText:     { fontSize: 13, fontWeight: '600' },
    thumbRow:     { marginTop: 12, flexDirection: 'row' },
    thumb:        { width: 80, height: 80, borderRadius: 12, marginRight: 8, backgroundColor: '#e6e6e6' },
    moreOverlay:  { position: 'absolute', top: 0, left: 0, width: 80, height: 80, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    moreText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
    noMedia:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 56, borderRadius: 14, backgroundColor: 'rgba(128,128,128,0.10)' },
    noMediaText:  { fontSize: 13, color: '#9f9f9f' },
});

export default GroupMedia;
