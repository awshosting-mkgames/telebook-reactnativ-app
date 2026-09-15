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
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Media, links & docs</Text>
                <View style={styles.row}>
                    <Text style={styles.grayText}>{mediaDetails?.total || 0}</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.text} />
                </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                {mediaDetails?.images?.count > 0 && (
                    <View style={styles.stat}>
                        <Ionicons name="image-outline" size={16} color="#3498db" />
                        <Text style={styles.statText}>{mediaDetails.images.count} Photos</Text>
                    </View>
                )}
                {mediaDetails?.videos?.count > 0 && (
                    <View style={styles.stat}>
                        <Ionicons name="videocam-outline" size={16} color="#3498db" />
                        <Text style={styles.statText}>{mediaDetails.videos.count} Videos</Text>
                    </View>
                )}
                {mediaDetails?.documents?.count > 0 && (
                    <View style={styles.stat}>
                        <Ionicons name="document-outline" size={16} color="#3498db" />
                        <Text style={styles.statText}>{mediaDetails.documents.count} Docs</Text>
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
                        <Ionicons name="images-outline" size={28} color="#ccc" />
                        <Text style={styles.noMediaText}>No media yet</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    section:      { padding: 15 },
    rowBetween:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    row:          { flexDirection: 'row', alignItems: 'center' },
    sectionTitle: { fontSize: 17, fontWeight: '500' },
    grayText:     { color: '#9f9f9f', fontSize: 14 },
    statsRow:     { flexDirection: 'row', marginTop: 8, gap: 12 },
    stat:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText:     { fontSize: 13, color: '#3498db' },
    thumbRow:     { marginTop: 12, flexDirection: 'row' },
    thumb:        { width: 72, height: 72, borderRadius: 10, marginRight: 6, backgroundColor: '#eee' },
    moreOverlay:  { position: 'absolute', top: 0, left: 0, width: 72, height: 72, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    moreText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
    noMedia:      { width: 150, height: 72, borderRadius: 10, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
    noMediaText:  { fontSize: 12, color: '#ccc', marginTop: 4 },
});

export default GroupMedia;
