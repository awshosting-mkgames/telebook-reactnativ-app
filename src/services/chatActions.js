import { setBlockedIds, setUserBlocked, updateChatFlags } from '../redex/slices/chatListSlice';
import apiService from './apiService';
import { persistChatTabs } from './chatSync';

// Chat list aur chat screen dono yahi functions use karte hain, taki pin /
// block ka API aur Redux update ek hi jagah rahe (API doc: 6.2 aur 6.3).

// Server ka message nikal lo (apiService error par { success:false, error } deta hai)
export const apiErrorMessage = (res, fallback = 'Something went wrong') =>
    res?.error?.message || res?.data?.message || (typeof res?.error === 'string' ? res.error : '') || fallback;

// API success tabhi jab HTTP bhi OK ho aur body me success: true ho (doc rule 3)
const isOk = (res) => !!res?.success && res?.data?.success !== false;

/** GET /users/blocked → Redux blockedIds */
export const fetchBlockedUsers = async (dispatch) => {
    const res = await apiService({ method: 'GET', endpoint: 'users/blocked' });
    if (!isOk(res)) return null;
    const ids = (res.data?.blockedUsers ?? []).map((u) => u?._id ?? u).filter(Boolean);
    dispatch(setBlockedIds(ids));
    return ids;
};

/** PUT /users/block/:userId  ya  PUT /users/unblock/:userId */
export const setBlocked = async (dispatch, userId, blocked) => {
    if (!userId) return { ok: false, message: 'User not found' };
    // Optimistic — fail hua to wapas
    dispatch(setUserBlocked({ userId, blocked }));
    const res = await apiService({
        method: 'PUT',
        endpoint: `users/${blocked ? 'block' : 'unblock'}/${userId}`,
        data: {},
    });
    if (isOk(res)) return { ok: true };
    dispatch(setUserBlocked({ userId, blocked: !blocked }));
    return { ok: false, message: apiErrorMessage(res, blocked ? 'Could not block user' : 'Could not unblock user') };
};

/** PUT /chats/:chatId/pin  ya  /unpin */
export const setChatPinned = async (dispatch, chat, pinned, myUserId) => {
    const chatId = chat?._id;
    if (!chatId) return { ok: false };
    const pinnedBy = (chat.pinnedBy ?? []).filter((id) => (id?._id ?? id) !== myUserId);
    const patch = (value) => ({
        isPinned: value,
        pinnedBy: value ? [...pinnedBy, myUserId] : pinnedBy,
    });
    dispatch(updateChatFlags({ chatId, patch: patch(pinned) }));
    const res = await apiService({ method: 'PUT', endpoint: `chats/${chatId}/${pinned ? 'pin' : 'unpin'}`, data: {} });
    if (!isOk(res)) {
        dispatch(updateChatFlags({ chatId, patch: patch(!pinned) }));
        // Part 3 §3.4c: favourites limit — UI Upgrade button dikha sake
        return { ok: false, planLimit: res?.error?.code === 'PLAN_LIMIT', message: apiErrorMessage(res, 'Could not update pin') };
    }
    dispatch(persistChatTabs());
    return { ok: true };
};

// Chat pinned hai ya nahi — server `isPinned` deta hai, purane data me sirf `pinnedBy`
export const isChatPinned = (chat, myUserId) => {
    if (typeof chat?.isPinned === 'boolean') return chat.isPinned;
    return !!chat?.pinnedBy?.some((id) => (id?._id ?? id) === myUserId);
};
