import { updateUserData, settotalappData } from '../redex/slices/totalappDataSlice';
import { appendFile } from '../utils/uploadFile';
import apiService from './apiService';
import { apiErrorMessage } from './chatActions';

// Login (verify-otp) ka user object chhota hota hai — usme profilePicture/about
// nahi aate. Isliye poori profile GET auth/me se laate hain aur Redux me merge
// kar dete hain; header, Settings aur status avatar sab wahi se padhte hain.
export const refreshMyProfile = async (dispatch) => {
    try {
        const res = await apiService({ method: 'GET', endpoint: 'auth/me' });
        const user = res?.data?.user ?? res?.data;
        if (!res?.success || !user?._id) return null;

        dispatch(updateUserData(user));

        // Login ne userId set nahi kiya (response me `id` na ho) to yahan bhar do
        dispatch(settotalappData({ userId: user._id }));

        return user;
    } catch (error) {
        console.log('⚠️ refreshMyProfile error:', error);
        return null;
    }
};

const ok = (res) => !!res?.success && res?.data?.success !== false;

/**
 * PUT /users/profile (JSON) — name, about, district, city, state.
 * Server sirf non-empty values lagata hai. Response ka poora `user` Redux me merge.
 */
export const updateMyProfile = async (dispatch, fields) => {
    const res = await apiService({ method: 'PUT', endpoint: 'users/profile', data: fields });
    if (!ok(res)) return { ok: false, message: apiErrorMessage(res, 'Profile update nahi hua') };
    if (res.data?.user) dispatch(updateUserData(res.data.user));
    return { ok: true, user: res.data?.user };
};

/**
 * PUT /users/profile (multipart, field `profilePicture`). Purani photo server khud hata deta hai.
 * `asset` = expo-image-picker ka asset.
 */
export const uploadProfilePhoto = async (dispatch, asset) => {
    if (!asset?.uri) return { ok: false, message: 'Photo select nahi hui' };
    const type = asset.mimeType || 'image/jpeg';
    const ext = type.split('/')[1] || 'jpg';
    const form = new FormData();
    await appendFile(form, 'profilePicture', {
        uri: asset.uri,
        name: asset.fileName || `profile_${Date.now()}.${ext}`,
        type,
        file: asset.file, // web par picker File object deta hai
    });
    const res = await apiService({ method: 'PUT', endpoint: 'users/profile', data: form, isMultipart: true });
    if (!ok(res)) return { ok: false, message: apiErrorMessage(res, 'Photo upload nahi hui') };
    if (res.data?.user) dispatch(updateUserData(res.data.user));
    return { ok: true, user: res.data?.user };
};

// ── Privacy (GET/PUT /users/privacy) ─────────────────────────────────────────
export const fetchPrivacy = async () => {
    const res = await apiService({ method: 'GET', endpoint: 'users/privacy' });
    return ok(res) ? res.data?.privacySettings ?? null : null;
};
export const savePrivacy = async (dispatch, patch) => {
    const res = await apiService({ method: 'PUT', endpoint: 'users/privacy', data: patch });
    if (!ok(res)) return { ok: false, message: apiErrorMessage(res, 'Privacy save nahi hui') };
    const privacySettings = res.data?.privacySettings;
    if (privacySettings) dispatch(updateUserData({ privacySettings }));
    return { ok: true, privacySettings };
};

// ── Notifications (GET/PUT /users/notifications) ─────────────────────────────
export const fetchNotificationSettings = async () => {
    const res = await apiService({ method: 'GET', endpoint: 'users/notifications' });
    return ok(res) ? res.data?.notificationSettings ?? null : null;
};
export const saveNotificationSettings = async (dispatch, patch) => {
    const res = await apiService({ method: 'PUT', endpoint: 'users/notifications', data: patch });
    if (!ok(res)) return { ok: false, message: apiErrorMessage(res, 'Settings save nahi hui') };
    const notificationSettings = res.data?.notificationSettings;
    if (notificationSettings) dispatch(updateUserData({ notificationSettings }));
    return { ok: true, notificationSettings };
};
