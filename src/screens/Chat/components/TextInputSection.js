import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator, Animated, FlatList, Image, Keyboard,
    Platform, StyleSheet,
    Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Config from '../../../services/config';
import { APP_BUILD_HEADERS } from '../../../services/appBuild';
import { useNameResolver } from '../../../services/nameResolver';
import StickerPanel from './StickerPanel';

const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '👍', '❤️', '🔥', '🎉', '🙏', '✅', '🫡',
    '😅', '🤣', '😊', '😇', '🤩', '🤗', '😏', '😒', '😞', '😔', '😢', '😭',
    '😤', '😠', '🤬', '😱', '😨', '😰', '😓', '🤔', '🤭', '🫢', '🤫', '🫠'];

const MIN_H = 48;
const MAX_H = 150;
const BTN_LARGE = 50;
const BTN_SMALL = 42;

// ─── Main TextInputSection ─────────────────────────────────────
const TextInputSection = ({
    inputText, handleTyping, showEmoji, setShowEmoji,
    keyboardH, sending, sendMessage,
    isRecording, startRecording, stopRecording, cancelRecording,
    replyMsg, setReplyMsg, recordSecs, scaleAnim, fmtSecs,
    setShowAttach, theme, openCamera, getFullUrl, bottomInset = 0,
    editMsg, onCancelEdit,
}) => {
    const resolveName = useNameResolver();
    const { t } = useTranslation();

    const isDark = theme?.text === '#FFFFFF';

    const wrapperBg = isDark ? '#111b21' : '#f0f2f3';
    const pillBg = isDark ? '#202c33' : '#ffffff';
    const pillBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const inputColor = isDark ? '#e9edef' : '#000000';
    const iconColor = isDark ? '#8696a0' : '#54656f';
    const placeholder = isDark ? '#8696a0' : '#999999';

    const replyBanBg = isDark ? '#1f2c34' : '#ffffff';
    const accent = theme?.main ?? '#1296f3';
    const replyNameC = accent;
    const replyTextC = isDark ? '#8696a0' : '#777777';

    const recBarBg = isDark ? '#1f2c34' : '#ffffff';
    const tabActiveBg = isDark ? '#2a3942' : (theme?.main ? theme.main + '22' : '#e8f4fe');
    const tabBg = isDark ? '#1f2c34' : '#f5f5f5';
    const tabActiveText = accent;
    const tabInactiveText = isDark ? '#8696a0' : '#888';

    const [inputHeight, setInputHeight] = useState(MIN_H);
    const [emojiTab, setEmojiTab] = useState('emoji'); // 'emoji' | 'sticker'
    const btnAnim = useRef(new Animated.Value(0)).current;
    // Send par jaldi-jaldi do tap → ek hi message jaye
    const sendLock = useRef(false);
    const handleSendPress = () => {
        if (sendLock.current || !inputText.trim()) return;
        sendLock.current = true;
        setTimeout(() => { sendLock.current = false; }, 400);
        sendMessage({ content: inputText, messageType: 'text' });
    };

    const showSend = inputText.trim().length > 0;

    useEffect(() => {
        Animated.spring(btnAnim, {
            toValue: showSend ? 1 : 0,
            useNativeDriver: false,
            friction: 8,
            tension: 100,
        }).start();
    }, [showSend]);

    useEffect(() => { if (!inputText) setInputHeight(MIN_H); }, [inputText]);

    const btnSize = btnAnim.interpolate({ inputRange: [0, 1], outputRange: [BTN_SMALL, BTN_LARGE] });
    const btnRadius = btnAnim.interpolate({ inputRange: [0, 1], outputRange: [BTN_SMALL / 2, BTN_LARGE / 2] });

    const onContentSizeChange = (e) => {
        const raw = e.nativeEvent.contentSize.height;
        setInputHeight(Math.min(Math.max(raw, MIN_H), MAX_H));
    };

    // ── Sticker send: direct message send karo, text input mein set mat karo ──
    const handleStickerSend = (sticker) => {
        if (!sendMessage || !sticker?.url) return;
        const filename = sticker.filename || sticker.name || 'sticker.png';
        const ext = (sticker.fileType || filename.split('.').pop() || 'png').replace(/^.*\//, '');
        sendMessage({
            content: '',
            messageType: 'image',
            uploadedData: {
                url: sticker.url, // server path — bubble me getFullUrl sahi base lagata hai
                filename,
                fileType: `image/${ext}`,
                fileSize: sticker.fileSize ?? 0,
            },
        });
        setShowEmoji(false);
    };

    return (
        // Keyboard handling parent (Chat screen) ka KeyboardAvoidingView karta hai.
        // Yahan doosra KAV lagane se keyboard khulne par input do baar khisakta tha.
        <View style={[styles.wrapper, { backgroundColor: wrapperBg, paddingBottom: bottomInset }]}>

                {/* Edit Banner */}
                {editMsg && (
                    <View style={[styles.replyBanner, { backgroundColor: replyBanBg, borderLeftColor: '#8e44ad' }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.replyName, { color: '#8e44ad' }]}>Editing message</Text>
                            <Text style={[styles.replyText, { color: replyTextC }]} numberOfLines={1}>{editMsg.content}</Text>
                        </View>
                        <TouchableOpacity onPress={onCancelEdit} style={styles.replyClose}>
                            <Ionicons name="close" size={16} color={iconColor} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Reply Banner */}
                {replyMsg && !editMsg && (
                    <View style={[styles.replyBanner, { backgroundColor: replyBanBg, borderLeftColor: accent }]}>
                        <View style={[styles.replyAccent, { backgroundColor: accent }]} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.replyName, { color: replyNameC }]}>
                                Replying to {replyMsg.sender ? resolveName(replyMsg.sender).title : 'You'}
                            </Text>
                            <Text style={[styles.replyText, { color: replyTextC }]} numberOfLines={1}>
                                {replyMsg.messageType !== 'text' ? `📎 ${replyMsg.messageType}` : replyMsg.content}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setReplyMsg(null)} style={styles.replyClose}>
                            <Ionicons name="close" size={16} color={iconColor} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Recording Bar */}
                {isRecording && (
                    <View style={[styles.recordingBar, { backgroundColor: recBarBg }]}>
                        <Animated.View style={[styles.recordPulse, { transform: [{ scale: scaleAnim }] }]}>
                            <Ionicons name="mic" size={20} color="#e74c3c" />
                        </Animated.View>
                        <Text style={styles.recordTime}>{fmtSecs(recordSecs)}</Text>
                        <View style={styles.recordLabelWrapper}>
                            <Text style={[styles.recordLabel, { color: iconColor }]}>{t('Recording...')}</Text>
                        </View>
                        <TouchableOpacity onPress={stopRecording} style={[styles.recordSendBtn, { backgroundColor: accent }]}>
                            <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={cancelRecording} style={styles.recordCancelBtn}>
                            <Text style={styles.cancelText}>{t('Cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── Emoji / Sticker Panel ── */}
                {showEmoji && (
                    <View style={{ backgroundColor: isDark ? '#111b21' : '#f8f8f8' }}>

                        {/* Tab Bar */}
                        <View style={[styles.tabBar, { backgroundColor: tabBg, borderBottomColor: isDark ? '#2a3942' : '#e0e0e0' }]}>
                            <TouchableOpacity
                                style={[styles.tab, emojiTab === 'emoji' && { backgroundColor: tabActiveBg, borderRadius: 20 }]}
                                onPress={() => setEmojiTab('emoji')}
                            >
                                <Text style={{ fontSize: 18 }}>😀</Text>
                                <Text style={[styles.tabLabel, { color: emojiTab === 'emoji' ? tabActiveText : tabInactiveText }]}>
                                    Emoji
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, emojiTab === 'sticker' && { backgroundColor: tabActiveBg, borderRadius: 20 }]}
                                onPress={() => setEmojiTab('sticker')}
                            >
                                <Text style={{ fontSize: 18 }}>🖼️</Text>
                                <Text style={[styles.tabLabel, { color: emojiTab === 'sticker' ? tabActiveText : tabInactiveText }]}>
                                    Stickers
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Emoji Grid */}
                        {emojiTab === 'emoji' && (
                            <View style={[styles.emojiGrid, { backgroundColor: isDark ? '#1f2c34' : '#ffffff' }]}>
                                {EMOJIS.map(e => (
                                    <TouchableOpacity
                                        key={e}
                                        onPress={() => handleTyping(inputText + e)}
                                        style={styles.emojiBtn}
                                    >
                                        <Text style={styles.emojiText}>{e}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Sticker Grid */}
                        {emojiTab === 'sticker' && (
                            <StickerPanel
                                onSendSticker={handleStickerSend}
                                isDark={isDark}
                                getFullUrl={getFullUrl}
                                accent={accent}
                            />
                        )}
                    </View>
                )}

                {/* Input Row */}
                <View style={[styles.inputRow, { paddingBottom: 8 }]}>

                    <TouchableOpacity
                        onPress={() => {
                            // Emoji panel aur keyboard ek saath na khulein
                            if (!showEmoji) Keyboard.dismiss();
                            setShowEmoji(v => !v);
                        }}
                        style={styles.iconBtn}
                    >
                        <Ionicons
                            name={showEmoji ? 'keypad-outline' : 'happy-outline'}
                            size={26}
                            color={iconColor}
                        />
                    </TouchableOpacity>

                    <View style={[styles.inputPill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
                        <TextInput
                            style={[styles.textInput, { color: inputColor, height: inputHeight }]}
                            placeholder={t('Message')}
                            placeholderTextColor={placeholder}
                            value={inputText}
                            onChangeText={handleTyping}
                            multiline
                            scrollEnabled
                            onContentSizeChange={onContentSizeChange}
                            onFocus={() => setShowEmoji(false)}
                            textAlignVertical="center"
                        />
                        <TouchableOpacity onPress={() => setShowAttach(true)} style={styles.attachBtn}>
                            <Ionicons
                                name="attach"
                                size={24}
                                color={iconColor}
                                style={{ transform: [{ rotate: '45deg' }] }}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={openCamera} style={styles.attachBtn}>
                            <Ionicons name="camera" size={24} color={iconColor} />
                        </TouchableOpacity>
                    </View>

                    {/* Send / Mic button */}
                    <Animated.View style={[
                        styles.actionBtnBase,
                        { width: btnSize, height: btnSize, borderRadius: btnRadius, backgroundColor: accent },
                    ]}>
                        {showSend ? (
                            <TouchableOpacity
                                style={styles.actionInner}
                                onPress={handleSendPress}
                            >
                                {sending
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Ionicons name={editMsg ? 'checkmark' : 'send'} size={editMsg ? 22 : 18} color="#fff" style={{ marginLeft: editMsg ? 0 : 2 }} />
                                }
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[
                                    styles.actionInner,
                                    isRecording && { backgroundColor: '#e74c3c', borderRadius: BTN_SMALL / 2 },
                                ]}
                                // Tap = recording shuru; upar wale bar se Send / Cancel
                                onPress={isRecording ? stopRecording : startRecording}
                            >
                                <Ionicons name="mic" size={20} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </Animated.View>
                </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.08)' },
    replyBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, borderLeftWidth: 4, borderLeftColor: '#1296f3', margin: 8, borderRadius: 8 },
    replyAccent: { width: 3, height: 34, backgroundColor: '#1296f3', borderRadius: 2, marginRight: 10 },
    replyName: { fontSize: 12, fontWeight: '700' },
    replyText: { fontSize: 13 },
    replyClose: { padding: 6 },
    recordingBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(231,76,60,0.2)', gap: 8 },
    recordPulse: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(231,76,60,0.1)', alignItems: 'center', justifyContent: 'center' },
    recordTime: { fontSize: 17, fontWeight: '700', color: '#e74c3c', minWidth: 46 },
    recordLabelWrapper: { flex: 1 },
    recordLabel: { fontSize: 14 },
    recordSendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1296f3', alignItems: 'center', justifyContent: 'center' },
    recordCancelBtn: { paddingHorizontal: 8, paddingVertical: 6 },
    cancelText: { color: '#e74c3c', fontSize: 14, fontWeight: '600' },

    // Tab Bar
    tabBar: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6 },
    tabLabel: { fontSize: 13, fontWeight: '600' },

    // Emoji Grid
    emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'flex-start', minHeight: 120, maxHeight: 220 },
    emojiBtn: { padding: 6 },
    emojiText: { fontSize: 26 },

    // Input Row
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 8, gap: 8 },
    iconBtn: { width: 40, height: MIN_H, justifyContent: 'center', alignItems: 'center' },
    inputPill: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, paddingHorizontal: 12, borderWidth: 1 },
    textInput: { flex: 1, fontSize: 16, paddingTop: Platform.OS === 'ios' ? 12 : 8, paddingBottom: Platform.OS === 'ios' ? 12 : 8 },
    attachBtn: { width: 35, height: MIN_H, justifyContent: 'center', alignItems: 'center' },
    actionBtnBase: { justifyContent: 'center', alignItems: 'center', elevation: 3 },
    actionInner: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
});

export default TextInputSection;