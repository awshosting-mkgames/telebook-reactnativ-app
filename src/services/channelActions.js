// services/channelActions.js
// Channel screens (admin + subscriber) ke shared helpers: safe link open, copy/share,
// post pagination merge, forward aur report API calls. UI yahan nahi hai.
import Clipboard from '@react-native-clipboard/clipboard';
import { Linking, Share } from 'react-native';
import Toast from 'react-native-toast-message';
import apiService from './apiService';

export const POSTS_PAGE_SIZE = 20;

// Non-blocking toast (Alert nahi) — Copy/Share/Forward/Report ke feedback ke liye
export const showToast = (text1, type = 'success', text2) => {
    try { Toast.show({ type, text1, text2 }); } catch { /* toast host na ho to ignore */ }
};

// Sirf http/https kholo — javascript:, intent:, file: jaise schemes reject (security)
export const openSafeUrl = async (url) => {
    const u = String(url || '').trim();
    if (!/^https?:\/\//i.test(u)) return false;
    try {
        await Linking.openURL(u);
        return true;
    } catch {
        showToast('Could not open link', 'error');
        return false;
    }
};

export const copyText = (text) => {
    if (!text) return;
    Clipboard.setString(String(text));
    showToast('Copied');
};

// shareUrl hi use hota hai (internal id/inviteLink kabhi expose nahi)
export const copyChannelLink = (shareUrl) => {
    if (!shareUrl) return false;
    Clipboard.setString(shareUrl);
    showToast('Link copied');
    return true;
};

export const shareChannelLink = async (channel) => {
    const url = channel?.shareUrl;
    if (!url) return false;
    try {
        await Share.share({
            title: channel?.channelName,
            message: `Check out "${channel?.channelName || 'this channel'}" on Telebook: ${url}`,
        });
        return true;
    } catch (e) {
        console.log('Share error:', e);
        return false;
    }
};

// channels/:id ka response alag-alag shapes me aa sakta hai
export const extractChannel = (res) =>
    res?.data?.channel ?? res?.data?.data?.channel ?? res?.channel ?? res?.data ?? null;

export const fetchChannelById = async (channelId) => {
    const res = await apiService({ method: 'GET', endpoint: `channels/${channelId}` });
    return res?.success === false ? null : extractChannel(res);
};

// Newest-first page (page 1 = newest). Return: { posts, hasMore } ya null (error)
export const fetchPostsPage = async (channelId, page = 1, limit = POSTS_PAGE_SIZE) => {
    const res = await apiService({
        method: 'GET',
        endpoint: `channels/${channelId}/messages`,
        params: { page, limit },
    });
    if (res?.success === false) return null;
    const body = res?.data ?? res ?? {};
    const posts = Array.isArray(body.messages) ? body.messages : [];
    const hasMore = body.pagination?.hasMore ?? posts.length >= limit;
    return { posts, hasMore: !!hasMore };
};

// _id se de-dupe; order newest-first rakhta hai (purane pehle se bache hue ko pehle jagah)
export const mergePosts = (existing, incoming) => {
    const seen = new Set();
    const out = [];
    [...existing, ...incoming].forEach((p) => {
        const id = p?._id;
        if (id && seen.has(id)) return;
        if (id) seen.add(id);
        out.push(p);
    });
    return out;
};

export const forwardChannelPost = async (channelId, postId, chatIds) => {
    const res = await apiService({
        method: 'POST',
        endpoint: `channels/${channelId}/messages/${postId}/forward`,
        data: { chatIds },
    });
    return res;
};

export const REPORT_REASONS = [
    { key: 'spam', label: 'Spam' },
    { key: 'harassment', label: 'Harassment' },
    { key: 'inappropriate_content', label: 'Inappropriate content' },
    { key: 'violence', label: 'Violence' },
    { key: 'hate_speech', label: 'Hate speech' },
    { key: 'fake_news', label: 'Fake news' },
    { key: 'scam', label: 'Scam' },
    { key: 'other', label: 'Other' },
];

export const reportChannel = async (channelId, reason, description) => {
    const res = await apiService({
        method: 'POST',
        endpoint: 'reports/channel',
        data: {
            channelId,
            reason,
            ...((description || '').trim() ? { description: description.trim() } : {}),
        },
    });
    if (res?.success) return { ok: true };
    const code = res?.error?.code;
    return { ok: false, already: code === 'ALREADY_REPORTED', message: res?.error?.message };
};
