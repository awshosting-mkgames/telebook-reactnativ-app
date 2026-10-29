import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { memo, useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator, Dimensions, Image, Linking, Pressable,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Hyperlink from 'react-native-hyperlink';
import AudioPlayer from './AudioPlayer';
import SwipeableMessage from './SwipeableMessage';
import Ticks from './Ticks';
import moment from 'moment';
import { useMediaDownload } from '../../../utils/mediaCache';
import { useNameResolver } from '../../../services/nameResolver';

const { width: SCREEN_W } = Dimensions.get('window');

// Video ka thumbnail ek baar bana kar cache — pehle har video message ke liye poora
// video player banta tha (memory + network bhari, lambi chat me list atak jati thi).
const thumbCache = new Map();
const VideoThumb = memo(({ uri, style }) => {
    const [thumb, setThumb] = useState(thumbCache.get(uri) ?? null);
    useEffect(() => {
        if (!uri || thumbCache.has(uri)) { setThumb(thumbCache.get(uri) ?? null); return undefined; }
        let alive = true;
        VideoThumbnails.getThumbnailAsync(uri, { time: 500 })
            .then(({ uri: t }) => { thumbCache.set(uri, t); if (alive) setThumb(t); })
            .catch(() => { });
        return () => { alive = false; };
    }, [uri]);
    return thumb
        ? <Image source={{ uri: thumb }} style={style} resizeMode="cover" />
        : <View style={[style, { backgroundColor: '#1b1b1b' }]} />;
});

const fmtSize = (b) => {
    const n = Number(b);
    if (!n) return '';
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// WhatsApp jaisa download button / progress (media abhi device me nahi hai)
const DownloadBadge = ({ dl, size, label }) => (
    <View pointerEvents="none" style={styles.dlBadge}>
        {dl.downloading ? (
            <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.dlText}>{Math.round((dl.progress || 0) * 100)}%</Text>
            </>
        ) : (
            <>
                <Ionicons name={dl.failed ? 'refresh' : 'arrow-down'} size={18} color="#fff" />
                <Text style={styles.dlText}>{dl.failed ? 'Retry' : (size || label || '')}</Text>
            </>
        )}
    </View>
);

// Image: download ke baad hi dikhti/khulti hai; apni bheji hui auto-cache hoti hai.
const ImageAtt = memo(({ uri, size, auto, style, wrapStyle, pending, guard, onOpen, onLongPress }) => {
    const dl = useMediaDownload(uri, { auto });
    return (
        <Pressable
            style={wrapStyle}
            onPress={pending ? pending.onPress : guard(() => (dl.ready ? onOpen(dl.localUri) : dl.start()))}
            onLongPress={onLongPress}
            delayLongPress={200}
        >
            {dl.ready
                ? <Image source={{ uri: dl.localUri }} style={style} resizeMode="cover" />
                : <View style={[style, { backgroundColor: '#2b2b2b' }]} />}
            {pending ? pending.overlay : (!dl.ready && dl.checked ? <DownloadBadge dl={dl} size={size} /> : null)}
        </Pressable>
    );
});

const VideoAtt = memo(({ uri, size, auto, style, wrapStyle, pending, guard, onOpen, onLongPress }) => {
    const dl = useMediaDownload(uri, { auto });
    return (
        <Pressable
            style={wrapStyle}
            onPress={pending ? pending.onPress : guard(() => (dl.ready ? onOpen(dl.localUri) : dl.start()))}
            onLongPress={onLongPress}
            delayLongPress={200}
        >
            {/* Native video view touch kha leta hai — overlay upar rahe isliye pointerEvents none */}
            <View pointerEvents="none" style={style}>
                {dl.ready ? <VideoThumb uri={dl.localUri} style={style} /> : <View style={[style, { backgroundColor: '#1b1b1b' }]} />}
            </View>
            {pending ? pending.overlay : dl.ready ? (
                <View pointerEvents="none" style={styles.videoOverlay}>
                    <Ionicons name="play" size={30} color="#fff" />
                </View>
            ) : (dl.checked ? <DownloadBadge dl={dl} size={size} /> : null)}
        </Pressable>
    );
});

// Audio: download hone tak sirf download button, uske baad normal player (local file se, offline bhi)
const AudioAtt = memo(({ uri, size, auto, isMine, isDark, guard, onLongPress }) => {
    const dl = useMediaDownload(uri, { auto });
    if (dl.ready) return <AudioPlayer url={dl.localUri} isMine={isMine} isDark={isDark} />;
    return (
        <Pressable style={styles.audioUploadRow} onPress={guard(() => dl.start())} onLongPress={onLongPress} delayLongPress={200}>
            {dl.downloading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name={dl.failed ? 'refresh' : 'arrow-down-circle'} size={26} color="#fff" />}
            <Text style={styles.docName}>
                {dl.downloading ? `Downloading… ${Math.round((dl.progress || 0) * 100)}%` : `Voice message${size ? ` · ${size}` : ''}`}
            </Text>
        </Pressable>
    );
});

const DocAtt = memo(({ uri, att, auto, guard, onOpen, onLongPress }) => {
    const dl = useMediaDownload(uri, { auto });
    return (
        <TouchableOpacity style={styles.docRow} onPress={guard(() => (dl.ready ? onOpen(dl.localUri, att) : dl.start()))} onLongPress={onLongPress}>
            <MaterialCommunityIcons name={docIcon(att)} size={24} color="#fff" />
            <View style={{ flex: 1 }}>
                <Text style={styles.docName} numberOfLines={1}>{att.filename || 'Document'}</Text>
                {!dl.ready && !!att.fileSize && <Text style={styles.dlText}>{fmtSize(att.fileSize)}</Text>}
            </View>
            {!dl.ready && (dl.downloading
                ? <><ActivityIndicator size="small" color="#fff" /><Text style={styles.dlText}>{Math.round((dl.progress || 0) * 100)}%</Text></>
                : dl.checked ? <Ionicons name={dl.failed ? 'refresh' : 'arrow-down-circle-outline'} size={22} color="#fff" /> : null)}
        </TouchableOpacity>
    );
});

// Document ka icon file type ke hisaab se (har file PDF nahi hoti)
const docIcon = (att) => {
    const name = `${att?.filename ?? ''} ${att?.fileType ?? ''} ${att?.url ?? ''}`.toLowerCase();
    if (name.includes('pdf')) return 'file-pdf-box';
    if (/\b(image|jpe?g|png|gif|webp|heic)\b/.test(name)) return 'file-image';
    if (/\b(docx?|msword|wordprocessing)\b/.test(name)) return 'file-word-box';
    if (/\b(xlsx?|csv|spreadsheet|excel)\b/.test(name)) return 'file-excel-box';
    if (/\b(pptx?|presentation|powerpoint)\b/.test(name)) return 'file-powerpoint-box';
    if (/\b(zip|rar|7z)\b/.test(name)) return 'folder-zip';
    return 'file-document';
};

// Attachment abhi upload ho raha hai (local file, server par nahi pahuncha) —
// WhatsApp jaisa chhota progress overlay, tap karne par cancel.
const UploadOverlay = ({ progress = 0, onCancel }) => (
    <Pressable style={styles.uploadOverlay} onPress={onCancel}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.uploadOverlayText}>{progress}%</Text>
        <Text style={styles.uploadOverlayHint}>tap to cancel</Text>
    </Pressable>
);

const MessageBubble = ({
    item, MY_USER_ID, isGroup, theme, getFullUrl,
    setImageModalUri, setVideoModalUri, openDocInBrowser, openLocalDoc,
    setReplyMsg, setShowEmoji, fmtTime,
    isSelectMode, isHighlighted, isSelected, onSelect, onReplyPress, isMatch,
    openPopup, retryMessage, onCancelUpload, onReactionPress,
}) => {
    const { t } = useTranslation();
    const resolveName = useNameResolver();
    const isMine = item.sender?._id === MY_USER_ID || item.sender === MY_USER_ID;
    // theme.mode se dark detect (text colour compare karna fragile tha)
    const isDark = theme?.mode ? theme.mode === 'dark' : theme?.text === '#FFFFFF';

    // Outgoing bubble ka ek hi source: theme.bubbleMine (fallback sirf safety ke liye)
    const mineBg = theme?.bubbleMine ?? (isDark ? '#1f3a52' : '#d9efff');
    const theirsBg = isDark ? '#1e2428' : '#ffffff';
    const normalBg = isMine ? mineBg : theirsBg;
    const matchBg = isDark ? '#3a3a1e' : '#FFFDE7'; // matched bubbles ka halka tint
    const bg = isHighlighted                         // active match — strong yellow
        ? '#996101'
        : isSelected                                 // select-mode — blue
            ? (theme?.bubbleSelected ?? (isDark ? '#2a5d7c' : '#B3E5FC'))
            : isMatch                                // baaki matches — halka yellow
                ? matchBg
                : normalBg;

    const textColor = isDark ? '#e9edef' : '#111111';
    const timeColor = isDark ? '#8696a0' : '#777777';
    const replyTextC = isDark ? '#a0b0b8' : '#666666';
    const deletedC = isDark ? '#8696a0' : '#888888';
    const replyBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

    const isFailed = isMine && item.status === 'failed';
    // Attachment abhi local file hai, server upload chal raha hai — har
    // media type (image/video/document/audio) isi se progress overlay dikhata hai.
    const isPendingUpload = isMine && item.status === 'sending' && !!item.attachments?.[0]?._pendingUpload;
    // Tap: select mode me select/unselect, failed message par retry
    // Deleted ya abhi-bhejte (temp_) message select nahi hone chahiye
    const canSelect = !item.isDeleted && !item.isOptimistic && !String(item._id ?? '').startsWith('temp_');
    const handlePress = () => {
        if (isSelectMode) return canSelect ? onSelect(item) : undefined;
        if (isFailed) retryMessage?.(item);
    };
    // Long press: select mode shuru / toggle. Failed message par Retry/Delete popup.
    const handleLongPress = () => {
        if (item.isDeleted) return;
        if (isFailed) return openPopup?.(item); // Retry / Delete
        if (item.isOptimistic) return;
        // WhatsApp jaisa: long press seedha select mode shuru karta hai (header me actions)
        if (canSelect && onSelect) return onSelect(item);
        openPopup?.(item);
    };
    // Reactions ko emoji ke hisaab se group karo: ❤️ 2  👍 1
    const reactionGroups = Object.entries(
        (item.reactions ?? []).reduce((acc, r) => {
            if (r?.emoji) acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
            return acc;
        }, {})
    );
    // Meri apni reaction (agar hai) — sirf usi chip par tap se hatega
    const myReactionEmoji = (item.reactions ?? []).find(
        (r) => r?.emoji && (r.user?._id ?? r.user ?? r.userId) === MY_USER_ID
    )?.emoji;
    const isStarred = !!item.starredBy?.some((u) => (u?._id ?? u) === MY_USER_ID);
    // Media par tap: select mode me select, warna full-screen viewer
    const openMedia = (open) => () => (isSelectMode ? (canSelect ? onSelect(item) : undefined) : open());


    const pendingProps = isPendingUpload ? {
        onPress: () => onCancelUpload?.(item._id),
        overlay: <UploadOverlay progress={item.uploadProgress ?? 0} onCancel={() => onCancelUpload?.(item._id)} />,
    } : null;

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
                                {resolveName(item.sender).title}
                            </Text>
                        )}
                        {item.isForwarded && !item.isDeleted && (
                            <View style={styles.forwardedRow}>
                                <Ionicons name="arrow-redo" size={12} color={timeColor} />
                                <Text style={[styles.forwardedText, { color: timeColor }]}>Forwarded</Text>
                            </View>
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
                                        {resolveName(item.replyTo.sender).title}
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
                                    <ImageAtt
                                        key={i}
                                        uri={getFullUrl(att.url)}
                                        size={fmtSize(att.fileSize)}
                                        auto={isMine}
                                        style={styles.msgImage}
                                        wrapStyle={styles.mediaWrap}
                                        pending={pendingProps}
                                        guard={openMedia}
                                        onOpen={setImageModalUri}
                                        onLongPress={handleLongPress}
                                    />
                                ))}

                                {item.messageType === 'video' && item.attachments?.map((att, i) => (
                                    <VideoAtt
                                        key={i}
                                        uri={getFullUrl(att.url)}
                                        size={fmtSize(att.fileSize)}
                                        auto={isMine}
                                        style={styles.msgImage}
                                        wrapStyle={styles.videoThumbWrap}
                                        pending={pendingProps}
                                        guard={openMedia}
                                        onOpen={setVideoModalUri}
                                        onLongPress={handleLongPress}
                                    />
                                ))}

                                {item.messageType === 'audio' && item.attachments?.map((att, i) => (
                                    <View key={i} style={styles.audioWrapper}>
                                        {isPendingUpload ? (
                                            <Pressable style={styles.audioUploadRow} onPress={() => onCancelUpload?.(item._id)}>
                                                <ActivityIndicator size="small" color="#fff" />
                                                <Text style={styles.docName}>Uploading voice message… {item.uploadProgress ?? 0}%</Text>
                                            </Pressable>
                                        ) : (
                                            <AudioAtt
                                                uri={getFullUrl(att.url)}
                                                size={fmtSize(att.fileSize)}
                                                auto={isMine}
                                                isMine={isMine}
                                                isDark={isDark}
                                                guard={openMedia}
                                                onLongPress={handleLongPress}
                                            />
                                        )}
                                    </View>
                                ))}

                                {item.messageType === 'document' && item.attachments?.map((att, i) => (
                                    isPendingUpload ? (
                                        <Pressable key={i} style={styles.docRow} onPress={() => onCancelUpload?.(item._id)}>
                                            <ActivityIndicator size="small" color="#fff" />
                                            <Text style={styles.docName} numberOfLines={1}>
                                                {att.filename || 'Document'} · {item.uploadProgress ?? 0}%
                                            </Text>
                                        </Pressable>
                                    ) : (
                                        <DocAtt
                                            key={i}
                                            uri={getFullUrl(att.url)}
                                            att={att}
                                            auto={isMine}
                                            guard={openMedia}
                                            onOpen={openLocalDoc}
                                            onLongPress={handleLongPress}
                                        />
                                    )
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
                            {isStarred && <Ionicons name="star" size={10} color={timeColor} />}
                            {item.isEdited && !item.isDeleted && (
                                <Text style={[styles.timeText, { color: timeColor }]}>edited</Text>
                            )}
                            <Text style={[styles.timeText, { color: timeColor }]}>{Shawtime}</Text>
                            <Ticks
                                status={item.status}
                                readBy={item.readBy}
                                senderId={item.sender?._id}
                                myId={MY_USER_ID}
                                isDark={isDark}
                            />
                        </View>
                        {isFailed && (
                            <View style={styles.failedRow}>
                                <Text style={styles.failedText}>
                                    {item.offlineQueued ? 'Failed · waiting for network' : 'Failed to send'}
                                </Text>
                                {/* Point 15: failed media ke saath seedha Retry button */}
                                <TouchableOpacity style={styles.retryBtn} onPress={() => retryMessage?.(item)} hitSlop={8}>
                                    <Ionicons name="refresh" size={12} color="#fff" />
                                    <Text style={styles.retryText}>Retry</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                    {reactionGroups.length > 0 && !item.isDeleted && (
                        <View style={[styles.reactionRow, { backgroundColor: isDark ? '#1f2c34' : '#ffffff' }]}>
                            {reactionGroups.map(([emoji, count]) => (
                                // Sirf meri reaction wale chip par tap kaam karta hai; baaki par kuch nahi
                                <Pressable
                                    key={emoji}
                                    hitSlop={6}
                                    disabled={isSelectMode || emoji !== myReactionEmoji || item.isOptimistic}
                                    onPress={() => onReactionPress?.(item, emoji)}
                                >
                                    <Text style={styles.reactionText}>
                                        {emoji}{count > 1 ? <Text style={[styles.reactionCount, { color: timeColor }]}> {count}</Text> : null}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
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
    msgText: { fontSize: 15, lineHeight: 20 },
    // Point 6: photo/video bubble ki puri available width (bubble maxWidth 80% - padding) tak
    msgImage: { width: SCREEN_W * 0.8 - 12, height: (SCREEN_W * 0.8 - 12) * 1.1, borderRadius: 8, backgroundColor: '#eee' },
    msgMedia: { width: SCREEN_W * 0.65, height: SCREEN_W * 0.65, borderRadius: 8, backgroundColor: '#eee' },
    audioWrapper: { width: SCREEN_W * 0.65 },
    videoThumbWrap: { width: SCREEN_W * 0.8 - 12, height: (SCREEN_W * 0.8 - 12) * 1.1, justifyContent: 'center', alignItems: 'center', borderRadius: 8, overflow: 'hidden' },
    dlBadge: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.3)' },
    dlText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    videoOverlay: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 30, padding: 10 },
    docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#1296f3', borderRadius: 8, width: SCREEN_W * 0.65 },
    docName: { color: '#fff', fontSize: 13, flex: 1 },
    audioUploadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#1296f3', borderRadius: 8 },
    uploadOverlay: {
        ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center', justifyContent: 'center', gap: 4,
    },
    uploadOverlayText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    uploadOverlayHint: { color: 'rgba(255,255,255,0.75)', fontSize: 10 },
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
    forwardedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3, paddingHorizontal: 2 },
    forwardedText: { fontSize: 11, fontStyle: 'italic' },
    failedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 2 },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e74c3c', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    retryText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    failedText: { color: '#e74c3c', fontSize: 11 },
    reactionRow: { flexDirection: 'row', gap: 4, marginTop: -6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
    reactionText: { fontSize: 14 },
    reactionCount: { fontSize: 11 },
});

export default MessageBubble;