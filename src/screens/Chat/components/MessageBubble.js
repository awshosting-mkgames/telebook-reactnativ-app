import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

import { useTranslation } from 'react-i18next';
import {
    Dimensions, Image, Linking, Pressable,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Hyperlink from 'react-native-hyperlink';
import AudioPlayer from './AudioPlayer';
import SwipeableMessage from './SwipeableMessage';
import Ticks from './Ticks';
import moment from 'moment';

const { width: SCREEN_W } = Dimensions.get('window');

// Muted video thumbnail — hook ko .map() ke andar call na karna pade isliye alag component
const VideoThumb = ({ uri, style }) => {
    const player = useVideoPlayer(uri, (p) => {
        p.muted = true;
        p.loop = false;
    });

    return (
        <VideoView
            style={style}
            player={player}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
        />
    );
};

const MessageBubble = ({
    item, MY_USER_ID, isGroup, theme, getFullUrl,
    setImageModalUri, setVideoModalUri, openDocInBrowser,
    setReplyMsg, setShowEmoji, fmtTime,
    isSelectMode, isHighlighted, isSelected, onSelect, onReplyPress, isMatch,
}) => {
    const { t } = useTranslation();
    const isMine = item.sender?._id === MY_USER_ID || item.sender === MY_USER_ID;
    const isDark = theme?.text === '#FFFFFF';


    const mineBg = isDark ? '#005c4b' : '#dcf8c6';
    const theirsBg = isDark ? '#1e2428' : '#ffffff';
    const normalBg = isMine ? mineBg : theirsBg;
    const matchBg = isDark ? '#3a3a1e' : '#FFFDE7'; // matched bubbles ka halka tint
    const bg = isHighlighted                         // active match — strong yellow
        ? '#996101'
        : isSelected                                 // select-mode — blue
            ? '#B3E5FC'
            : isMatch                                // baaki matches — halka yellow
                ? matchBg
                : normalBg;

    const textColor = isDark ? '#e9edef' : '#111111';
    const timeColor = isDark ? '#8696a0' : '#777777';
    const replyTextC = isDark ? '#a0b0b8' : '#666666';
    const deletedC = isDark ? '#8696a0' : '#888888';
    const replyBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

    const handlePress = () => isSelectMode ? onSelect(item) : null;
    const handleLongPress = () => !item.isDeleted && onSelect(item);


    const Shawtime = moment(item.createdAt).format('hh:mm A');

    return (
        <SwipeableMessage
            onReply={() => {
                if (!isSelectMode && !item.isDeleted) {
                    setReplyMsg(item);
                    setShowEmoji(false);
                }
            }}
        >
            <Pressable
                onPress={handlePress}
                onLongPress={handleLongPress}
                delayLongPress={200}
                style={[styles.msgWrapper, isMine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}
            >
                {isSelectMode && !isMine && (
                    <View style={[styles.selectCircle, isSelected && styles.selectCircleChecked, { marginRight: 8 }]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                )}

                <View style={[styles.bubbleContainer, { alignItems: isMine ? 'flex-end' : 'flex-start' }]}>


                    <View style={[
                        styles.bubble,
                        { backgroundColor: bg },
                        isMine ? styles.bubbleMine : styles.bubbleTheirs,
                    ]}>
                        {isGroup && !isMine && (
                            <Text numberOfLines={1} style={styles.senderName}>
                                {item.sender?.name ?? 'User'}
                            </Text>
                        )}
                        {item.replyTo && (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                style={[styles.replyPreview, { backgroundColor: replyBg }]}
                                onPress={() => onReplyPress(item.replyTo._id || item.replyTo)}
                            >
                                <View style={styles.replyBar} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.replyName} numberOfLines={1}>
                                        {item.replyTo.sender?.name ?? 'User'}
                                    </Text>
                                    <Text style={[styles.replyText, { color: replyTextC }]} numberOfLines={1}>
                                        {item.replyTo.messageType !== 'text'
                                            ? `📎 ${item.replyTo.messageType}`
                                            : item.replyTo.content}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Content */}
                        {item.isDeleted ? (
                            <Text style={[styles.deletedText, { color: deletedC }]}>
                                🚫 {t('This message was deleted')}
                            </Text>
                        ) : (
                            <View style={styles.contentContainer}>
                                {item.messageType === 'image' && item.attachments?.map((att, i) => (
                                    <View key={i} style={styles.mediaWrap}>
                                        <Image source={{ uri: getFullUrl(att.url) }} style={styles.msgMedia} resizeMode="cover" />
                                        <TouchableOpacity
                                            style={styles.zoomBtn}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            onPress={() => setImageModalUri(getFullUrl(att.url))}
                                        >
                                            <Ionicons name="expand" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}

                                {item.messageType === 'video' && item.attachments?.map((att, i) => (
                                    <View key={i} style={styles.videoThumbWrap}>
                                        <VideoThumb uri={getFullUrl(att.url)} style={styles.msgMedia} />
                                        <View style={styles.videoOverlay}>
                                            <Ionicons name="play" size={30} color="#fff" />
                                        </View>
                                        <TouchableOpacity
                                            style={styles.zoomBtn}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            onPress={() => setVideoModalUri(getFullUrl(att.url))}
                                        >
                                            <Ionicons name="expand" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}

                                {item.messageType === 'audio' && item.attachments?.map((att, i) => (
                                    <View key={i} style={styles.audioWrapper}>
                                        <AudioPlayer url={getFullUrl(att.url)} isMine={isMine} isDark={isDark} />
                                    </View>
                                ))}

                                {item.messageType === 'document' && item.attachments?.map((att, i) => (
                                    <TouchableOpacity key={i} style={styles.docRow} onPress={() => openDocInBrowser(att.url)}>
                                        <MaterialCommunityIcons name="file-pdf-box" size={24} color="#fff" />
                                        <Text style={styles.docName} numberOfLines={1}>{att.filename || 'Document'}</Text>
                                    </TouchableOpacity>
                                ))}

                                {!!item.content && item.messageType !== 'document' && (
                                    <View style={item.messageType !== 'text' ? { marginTop: 5 } : null}>
                                        <Hyperlink
                                            linkStyle={{ color: '#2980b9', textDecorationLine: 'underline' }}
                                            onPress={(url) => Linking.openURL(url)}
                                        >
                                            <Text
                                                style={[styles.msgText, { color: textColor }]}
                                            >
                                                {item.content}
                                            </Text>
                                        </Hyperlink>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Time + Ticks */}
                        <View style={styles.timeRow}>
                            <Text style={[styles.timeText, { color: timeColor }]}>{Shawtime}</Text>
                            <Ticks
                                status={item.status}
                                readBy={item.readBy}
                                senderId={item.sender?._id}
                                myId={MY_USER_ID}
                            />
                        </View>
                    </View>
                </View>

                {isSelectMode && isMine && (
                    <View style={[styles.selectCircle, isSelected && styles.selectCircleChecked, { marginLeft: 8 }]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                )}
            </Pressable>
        </SwipeableMessage>
    );
};

const styles = StyleSheet.create({
    msgWrapper: { marginVertical: 5, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
    bubbleContainer: { maxWidth: '82%' },
    bubble: { borderRadius: 12, padding: 6, minWidth: 80, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 1, maxWidth: SCREEN_W * 0.8 },
    bubbleMine: { borderTopRightRadius: 4 },
    bubbleTheirs: { borderTopLeftRadius: 4 },
    contentContainer: { overflow: 'hidden' },
    mediaWrap: { position: 'relative' },
    zoomBtn: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    msgText: { fontSize: 15, lineHeight: 20 },
    msgMedia: { width: SCREEN_W * 0.65, height: SCREEN_W * 0.65, borderRadius: 8, backgroundColor: '#eee' },
    audioWrapper: { width: SCREEN_W * 0.65 },
    videoThumbWrap: { width: SCREEN_W * 0.65, height: SCREEN_W * 0.65, justifyContent: 'center', alignItems: 'center', borderRadius: 8, overflow: 'hidden' },
    videoOverlay: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 30, padding: 10 },
    docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#1296f3', borderRadius: 8, width: SCREEN_W * 0.65 },
    docName: { color: '#fff', fontSize: 13, flex: 1 },
    timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2, gap: 4 },
    timeText: { fontSize: 10 },
    senderName: { fontSize: 12, color: '#1296f3', fontWeight: 'bold', marginBottom: 2, marginLeft: 0, marginVertical: 5, marginBottom: 15 },
    replyPreview: { flexDirection: 'row', borderRadius: 6, padding: 6, marginBottom: 6, borderLeftWidth: 4, borderLeftColor: '#1296f3' },
    replyBar: { width: 0 },
    replyName: { fontSize: 12, fontWeight: 'bold', color: '#1296f3' },
    replyText: { fontSize: 12 },
    selectCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#1296f3', alignItems: 'center', justifyContent: 'center' },
    selectCircleChecked: { backgroundColor: '#1296f3' },
    deletedText: { fontSize: 13, fontStyle: 'italic', padding: 4 },
});

export default MessageBubble;