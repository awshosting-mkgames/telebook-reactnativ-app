// apiService lazy require: axiosInstance -> suspensionStore -> apiService -> axiosInstance ka cycle na bane
const api = (cfg) => require('./apiService').default(cfg);

// Admin ne account suspend kiya ho to poori app ke upar suspension screen (components/SuspensionGate.js).
// Do raste se pata chalta hai: (1) app open par GET account/status, (2) kisi bhi API ka 403 ACCOUNT_SUSPENDED
// (axiosInstance interceptor `markSuspended` bulata hai).
let state = { suspended: false, reason: null, reviewRequest: null, canRequestReview: false, loaded: false };
const subs = new Set();

const emit = () => subs.forEach((fn) => fn(state));
const set = (patch) => { state = { ...state, ...patch }; emit(); };

export const getSuspension = () => state;
export const subscribeSuspension = (fn) => { subs.add(fn); return () => subs.delete(fn); };

export const markSuspended = (reason = null) => {
    if (!state.suspended) set({ suspended: true, reason: reason ?? state.reason, loaded: true });
};
export const clearSuspension = () => set({ suspended: false, reason: null, reviewRequest: null, canRequestReview: false });

let inflight = null;
export const refreshSuspension = () => {
    if (inflight) return inflight;
    inflight = (async () => {
        const res = await api({ method: 'GET', endpoint: 'account/status' });
        // Suspended user par protectAllowSuspended chalta hai, isliye yeh 200 deta hai
        const d = res?.success ? (res.data?.data ?? res.data) : null;
        if (d) {
            set({
                suspended: !!d.suspended,
                reason: d.reason ?? null,
                reviewRequest: d.reviewRequest ?? null,
                canRequestReview: !!d.canRequestReview,
                loaded: true,
            });
        }
        return state;
    })().finally(() => { inflight = null; });
    return inflight;
};

export const requestReview = async (message = '') => {
    const res = await api({ method: 'POST', endpoint: 'account/review-request', data: { message } });
    if (!res?.success) {
        return { ok: false, message: res?.error?.message || 'Could not send the request. Please try again.' };
    }
    await refreshSuspension();
    return { ok: true };
};
