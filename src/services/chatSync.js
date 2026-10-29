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
import { getAllContacts } from './contactsDb';
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

// ── Phonebook naam cache ─────────────────────────────────────────────────────
// Chat list ka title = phonebook me saved naam, nahi to registered mobile number
// (server ka profile naam list title kabhi nahi banta — wo sirf profile page par dikhta hai).
// processChat sync hai (ChatListSocketSync bhi use karta hai), isliye contacts SQL se
// ek baar phone→name map memory me rakhte hain aur contact change par refresh karte hain.
let phoneNameCache = new Map();

const last10 = (v) => String(v ?? '').replace(/\D/g, '').slice(-10);

// Number ko ek jaisa format do: country code pata ho to '+91 98765 43210', warna 10 digits
export const formatMobile = (mobile, countryCode) => {
    const d = last10(mobile);
    if (!d) return '';
    const cc = String(countryCode ?? '').replace(/\D/g, '');
    if (cc && d.length === 10) return `+${cc} ${d.slice(0, 5)} ${d.slice(5)}`;
    return d;
};

export const loadPhoneNameCache = async () => {
    try {
        const contacts = await getAllContacts();
        const map = new Map();
        contacts.forEach((c) => {
            const key = last10(c?.phone ?? c?.mobile);
            const name = (c?.name || '').trim();
            // 'Unknown' contactSync ka placeholder hai, asli saved naam nahi
            if (key && name && name !== 'Unknown') map.set(key, name);
        });
        phoneNameCache = map;
    } catch (e) {
        console.log('⚠️ loadPhoneNameCache error:', e);
    }
    return phoneNameCache;
};

// displayName / isSaved nikalo — group par kuch nahi badalta
const resolveOneToOneName = (other, fallbackName) => {
    const key = last10(other?.mobile);
    const saved = key ? phoneNameCache.get(key) : null;
    if (saved) return { displayName: saved, isSaved: true, displaySub: null };
    const num = formatMobile(other?.mobile, other?.countryCode);
    // Unsaved: number title, profile naam (ya "Unknown") chhote text me neeche
    const profile = (other?.name || '').trim();
    return { displayName: num || profile || fallbackName || 'User', isSaved: false, displaySub: num ? (profile || 'Unknown') : null };
};

// Maujooda chats ke naam naye cache se dobara nikalo (contacts badalne par / SQL se load par)
const relabelTabs = (tabs) => {
    const out = {};
    Object.keys(tabs || {}).forEach((tab) => {
        out[tab] = (tabs[tab] || []).map((c) => {
            if (!c || c.isGroupChat || !c.displayUser) return c;
            const r = resolveOneToOneName(c.displayUser, c.displayName);
            return c.displayName === r.displayName && c.isSaved === r.isSaved && c.displaySub === r.displaySub ? c : { ...c, ...r };
        });
    });
    return out;
};

/** Contacts badle (sync/refresh) to chat list ke naam bhi turant update karo. */
export const refreshChatNames = () => async (dispatch, getState) => {
    await loadPhoneNameCache();
    const tabs = getState()?.chatList?.tabs;
    if (!tabs) return;
    dispatch(setAllTabs(relabelTabs(tabs)));
    dispatch(persistChatTabs());
};

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
    const { displayName, isSaved } = resolveOneToOneName(other, item?.chatName);
    return {
        ...item,
        displayName,
        isSaved,
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

// Server /chats aur /chats/groups default 50 chats ka ek page dete hain. Pehle sirf page 1 aata
// tha, isliye 50 se zyada chats wale user ko baaki chats/purani history kabhi dikhti hi nahi thi
// (Point 14). Ab saare pages mangte hain (safety cap ke saath).
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

const fetchTab = async (tab, myUserId) => {
    const source = TAB_SOURCES[tab];
    let raw = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
        const res = await apiService({ method: 'GET', endpoint: source.endpoint, params: { page, limit: PAGE_SIZE } });

        // apiService HTTP error par throw nahi karta, { success: false } deta hai
        if (!res?.success) {
            // Pehla page fail = poora sync fail; baad ka page fail ho to jo mil chuka wahi rakho
            if (page === 1) throw new Error(`GET ${source.endpoint} failed: ${errorDetail(res?.error)}`);
            break;
        }

        const picked = source.pick(res?.data);
        const rows = Array.isArray(picked)
            ? picked
            : Array.isArray(res?.data) ? res.data : [];
        const seen = new Set(raw.map((c) => c?._id));
        raw = raw.concat(rows.filter((c) => !seen.has(c?._id)));

        if (!res?.data?.pagination?.hasMore || rows.length === 0) break;
    }

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
        loadPhoneNameCache(),
    ]);
    // Purane cached chats me bhi phonebook naam / number lagao
    dispatch(setAllTabs(relabelTabs(tabs)));
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
        // processChat se pehle phonebook cache taiyar ho
        await loadPhoneNameCache();
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

        const tabs = relabelTabs(await getAllTabChats());
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
    try {
        // Loader yahan nahi: SQL read milliseconds ka kaam hai, uske liye spinner
        // dikhane se cached data hone par bhi list ke upar loader chalta tha.
        // lastSyncedAt bhi dekhte hain — user ke 0 chats hon to chat_tabs khali
        // hota hai, par sync pehle ho chuka hota hai (har open par loader nahi).
        const [hasRows, syncedAt] = await Promise.all([hasChatData(), getChatsSyncedAt()]);

        if (hasRows || syncedAt) {
            await loadTabsFromDb(dispatch);
            // SQL wala data turant dikh gaya; ab background me server se taaza
            // kar lo (loader nahi) — app band rehne ke dauran aaye message / nayi
            // chats bhi list me aa jayein.
            syncAllTabData(dispatch, myUserId, { background: true });
            return { ok: true, fromSql: true };
        }

        // Sach me pehli baar (SQL poora khali): yahi ek case hai jahan loader sahi hai.
        // syncAllTabData(non-background) khud loadStarted/loadFinished karta hai.
        const result = await syncAllTabData(dispatch, myUserId);
        return { ...result, fromSql: false };
    } catch (error) {
        console.log('❌ initChatTabs error:', error);
        return { ok: false, fromSql: false, reason: error?.message };
    }
};
