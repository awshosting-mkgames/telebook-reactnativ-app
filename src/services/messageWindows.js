// Part 4 M04: edit / delete-for-everyone ki time-window (seconds) EK hi jagah.
// Server (messaging.editWindowSeconds / deleteForEveryoneSeconds) asli enforcement karta hai
// aur 403 + code deta hai; ye constants sirf UI me option chhupane ke liye default hain
// (public settings endpoint nahi hai). 0 / negative = koi seema nahi.
export const EDIT_WINDOW_SECONDS = 900;
export const DELETE_WINDOW_SECONDS = 3600;

const isOlderThan = (createdAt, seconds) => {
    if (!(seconds > 0) || !createdAt) return false;
    const t = new Date(createdAt).getTime();
    return Number.isFinite(t) && Date.now() - t > seconds * 1000;
};
export const isEditWindowExpired = (msg) => isOlderThan(msg?.createdAt, EDIT_WINDOW_SECONDS);
export const isDeleteWindowExpired = (msg) => isOlderThan(msg?.createdAt, DELETE_WINDOW_SECONDS);

// Server ke rejection codes (res.error.code) -> user-facing English message
export const windowErrorMessage = (res) => {
    const code = res?.error?.code ?? res?.data?.code;
    if (code === 'DELETE_WINDOW_EXPIRED') return 'This message is too old to delete for everyone';
    if (code === 'EDIT_WINDOW_EXPIRED') return 'This message is too old to edit';
    return null;
};
