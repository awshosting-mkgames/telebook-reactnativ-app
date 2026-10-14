import {
    loadFinished,
    loadStarted,
    setAllTabs,
    setBlockedIds,
    syncFailed,
    syncFinished,
    syncStarted,
} from '../redex/slices/chatListSlice';
import apiService from './apiService';
import Config from './config';
import {
    CHAT_TABS,
    getAllTabChats,
    getChatsSyncedAt,
    hasChatData,
    replaceTabChats,
    setChatsSyncedAt,
} from './chatsDb';

// 4 tabs ka data. Ek hi jagah se fetch + SQL + Redux hota hai.
//
//   App open → SQL check → data hai to SQL→Redux, warna syncAllTabData()
//                            (yahi ek jagah hai jahan poora loader dikhta hai)
//   Header   → Sync Data  → syncAllTabData({ background: true })  (loader nahi)
//   Socket   → trigger    → syncAllTabData({ background: true })  (loader nahi)

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const DEFAULT_GROUP = 'https://cdn-icons-png.flaticon.com/512/681/681494.png';

const resolveAvatar = (path, fallback) => (!path ? fallback : Config.MEDIA_URL + path);

// raw API chat → display-ready object (wahi shape jo screens pehle se use karti hain)
export const processChat = (item, myUserId) => {
    if (item?.isGroupChat) {
        return {
            ...item,
            displayName: item.chatName || 'Group',
            displayAvatar: resolveAvatar(item.groupIcon, DEFAULT_GROUP),
            displayUser: null,
        };
    }
    const other = item?.users?.find((u) => u?._id !== myUserId);
    return {
        ...item,
        displayName: other?.name || item.chatName || 'Unknown',
        displayAvatar: resolveAvatar(other?.profilePicture, DEFAULT_AVATAR),
        displayUser: other || null,
    };
};

// Har tab kaun sa endpoint aur response ka kaun sa field use karta hai.
// Unread aur Calls ke liye abhi alag API nahi hai, isliye wo 'chats' se
// derive hote hain. Jis din backend un endpoints ko de de, sirf yahan
// endpoint/pick badalna hoga — baaki flow waisa hi rahega.
const TAB_SOURCES = {
    All: { endpoint: 'chats', pick: (d) => d?.chats },
    Groups: { endpoint: 'chats/groups', pick: (d) => d?.groups },
    // API `unseenCount` deti hai (unreadCount sirf local socket update me banta hai)
    Unread: { endpoint: 'chats', pick: (d) => d?.chats, filter: (c) => (c?.unreadCount ?? c?.unseenCount ?? 0) > 0 },
    Calls: { endpoint: 'chats', pick: (d) => d?.chats },
};

const errorDetail = (error) =>
    typeof error === 'string' ? error : JSON.stringify(error ?? {});

const fetchTab = async (tab, myUserId) => {
    const source = TAB_SOURCES[tab];
    const res = await apiService({ method: 'GET', endpoint: source.endpoint });

    // apiService HTTP error par throw nahi karta, { success: false } deta hai
    if (!res?.success) {
        throw new Error(`GET ${source.endpoint} failed: ${errorDetail(res?.error)}`);
    }

    const picked = source.pick(res?.data);
    const raw = Array.isArray(picked)
        ? picked
        : Array.isArray(res?.data) ? res.data : [];

    const processed = raw.map((item) => processChat(item, myUserId));
    return source.filter ? processed.filter(source.filter) : processed;
};

const fetchBlockedIds = async (dispatch) => {
    try {
        const res = await apiService({ method: 'GET', endpoint: 'users/blocked' });
        if (!res?.success || res?.data?.success === false) return;
        const ids = (res.data?.blockedUsers ?? []).map((u) => u?._id ?? u).filter(Boolean);
        dispatch(setBlockedIds(ids));
    } catch (error) {
        console.log('❌ fetchBlockedIds error:', error);
    }
};

/**
 * Redux me hue local badlav (unread clear, naya message, nayi chat) SQL me likh do,
 * taki app dobara khulne par purana badge / purana last message na dikhe.
 * Koi API call nahi.
 */
export const saveTabsToDb = async (tabs) => {
    try {
        for (const tab of CHAT_TABS) {
            await replaceTabChats(tab, Array.isArray(tabs?.[tab]) ? tabs[tab] : []);
        }
    } catch (error) {
        console.log('❌ saveTabsToDb error:', error);
    }
};

// Thunk: Redux ka current data thodi der baad SQL me likh do. Debounce isliye
// ki message burst me har message par SQL write na ho.
let persistTimer = null;
export const persistChatTabs = () => (_dispatch, getState) => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
        persistTimer = null;
        const { tabs, syncing, loading } = getState()?.chatList ?? {};
        // Sync chal raha ho to wo khud SQL likhega
        if (!tabs || syncing || loading) return;
        saveTabsToDb(tabs);
    }, 600);
};

/** SQL se chaaron tabs padh kar Redux me daal do (koi API call nahi). */
export const loadTabsFromDb = async (dispatch) => {
    const [tabs, lastSyncedAt] = await Promise.all([
        getAllTabChats(),
        getChatsSyncedAt(),
    ]);
    dispatch(setAllTabs(tabs));
    if (lastSyncedAt) dispatch(syncFinished(lastSyncedAt));
    return tabs;
};

/**
 * 4 APIs → SQL update → Redux update.
 *
 * Sirf teen jagah se call hota hai: header ka Sync Data, socket trigger,
 * aur app open par jab SQL khali ho.
 *
 * @param {object} opts
 * @param {boolean} opts.background  true = socket sync, loader nahi dikhega
 */
export const syncAllTabData = async (dispatch, myUserId, opts = {}) => {
    const { background = false } = opts;

    dispatch(syncStarted());
    if (!background) dispatch(loadStarted());

    try {
        // Chaaron tabs parallel me — ek doosre par depend nahi karte.
        // Blocked list bhi saath me (Block / Unblock label ke liye); wo fail ho
        // to sync fail nahi hona chahiye.
        const [results] = await Promise.all([
            Promise.all(CHAT_TABS.map(async (tab) => [tab, await fetchTab(tab, myUserId)])),
            fetchBlockedIds(dispatch),
        ]);

        // SQL pehle, phir SQL se hi Redux — taki dono hamesha same rahen
        for (const [tab, chats] of results) {
            await replaceTabChats(tab, chats);
        }

        const syncedAt = Date.now();
        await setChatsSyncedAt(syncedAt);

        const tabs = await getAllTabChats();
        dispatch(setAllTabs(tabs));
        dispatch(syncFinished(syncedAt));

        const count = CHAT_TABS.reduce((sum, tab) => sum + (tabs[tab]?.length ?? 0), 0);
        return { ok: true, count };
    } catch (error) {
        console.log('❌ syncAllTabData error:', error);
        // API fail hui to SQL/Redux ka purana data chhedna nahi hai
        dispatch(syncFailed(error?.message ?? 'sync failed'));
        return { ok: false, count: 0, reason: error?.message ?? 'unknown-error' };
    } finally {
        if (!background) dispatch(loadFinished());
    }
};

/**
 * Free Chat screen focus par safety net: Redux ki list khali ho gayi ho (Fast
 * Refresh, state reset, pehli load fail) to SQL se wapas le aao. SQL bhi khali
 * ho to initChatTabs() — lekin API wala raasta ek session me ek hi baar.
 */
let triedEmptyInit = false;
export const ensureChatTabsLoaded = (myUserId) => async (dispatch, getState) => {
    const { tabs, loading, syncing } = getState()?.chatList ?? {};
    if (!myUserId || loading || syncing) return;
    const isEmpty = CHAT_TABS.every((tab) => !(tabs?.[tab]?.length));
    if (!isEmpty) return;
    try {
        if (await hasChatData()) {
            await loadTabsFromDb(dispatch);
            return;
        }
        if (triedEmptyInit) return;
        triedEmptyInit = true;
        await initChatTabs(dispatch, myUserId);
    } catch (error) {
        console.log('❌ ensureChatTabsLoaded error:', error);
    }
};

/**
 * App open par: pehle SQL check.
 * SQL me data hai  → SQL → Redux (koi API nahi)
 * SQL khali hai    → syncAllTabData() → SQL → Redux
 */
export const initChatTabs = async (dispatch, myUserId) => {
    dispatch(loadStarted());
    try {
        const hasLocal = await hasChatData();

        if (hasLocal) {
            await loadTabsFromDb(dispatch);
            dispatch(loadFinished());
            // SQL wala data turant dikh gaya; ab background me server se taaza
            // kar lo (loader nahi) — app band rehne ke dauran aaye message / nayi
            // chats bhi list me aa jayein.
            syncAllTabData(dispatch, myUserId, { background: true });
            return { ok: true, fromSql: true };
        }

        // Loader pehle se on hai; syncAllTabData usi ko aage chalata rahega
        const result = await syncAllTabData(dispatch, myUserId);
        return { ...result, fromSql: false };
    } catch (error) {
        console.log('❌ initChatTabs error:', error);
        return { ok: false, fromSql: false, reason: error?.message };
    } finally {
        dispatch(loadFinished());
    }
};
