import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts/legacy';

import {
    setContacts,
    syncStarted,
    syncFinished,
} from '../redex/slices/contactsSlice';
import apiService from './apiService';
import { refreshChatNames } from './chatSync';
import { checkRegisteredContacts } from './checkRegisteredContacts';
import {
    deleteContactsNotIn,
    getAllContacts,
    getLastSyncedAt,
    setLastSyncedAt,
    upsertContacts,
} from './contactsDb';

// Device contacts padhne ki ekmatra jagah yahi file hai.
// Screens kabhi expo-contacts ko haath nahi lagatin — wo Redux se padhti hain.
//
//   contactSync()
//        ↓
//   Device Contacts Get
//        ↓
//   PUT contact-cache   (device ka data server par)
//        ↓
//   GET contact-cache   (server se wapas)
//        ↓
//   SQL me set          (GET se jo mila, wahi)
//        ↓
//   Redux → UI
//
// Sirf do jagah se chalta hai: OTP success aur Settings → Sync Contacts.

const normalizePhone = (phone) => {
    if (!phone) return null;
    let cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length > 10) cleaned = cleaned.slice(-10);
    if (cleaned.length !== 10 || !/^[6789]/.test(cleaned)) return null;
    return cleaned;
};

const errorDetail = (error) =>
    typeof error === 'string' ? error : JSON.stringify(error ?? {});

// ── Server contact-cache ────────────────────────────────────────────────────
// apiService HTTP error par throw nahi karta, { success: false } deta hai —
// isliye har jagah explicit check karke throw karna zaruri hai.

const putContactCache = async (contacts) => {
    const res = await apiService({
        method: 'PUT',
        endpoint: 'contact-cache',
        data: { data: JSON.stringify(contacts) },
    });
    if (!res?.success) {
        throw new Error(`PUT contact-cache failed: ${errorDetail(res?.error)}`);
    }
};

const getContactCache = async () => {
    const res = await apiService({ method: 'GET', endpoint: 'contact-cache' });
    if (!res?.success) {
        throw new Error(`GET contact-cache failed: ${errorDetail(res?.error)}`);
    }
    // Server contacts ko JSON string me rakhta hai
    const raw = res?.data?.data;
    if (raw && typeof raw === 'string') return JSON.parse(raw);
    return res?.data?.contacts ?? res?.data ?? [];
};

// Server se aaya row → SQL me jaane wala shape
const toStoredContact = (contact) => {
    const phone = normalizePhone(contact?.phone ?? contact?.id);
    if (!phone) return null;
    return {
        phone,
        name: contact?.name || 'Unknown',
        avatar: contact?.avatar ?? null,
        isRegistered: !!contact?.isRegistered,
        appUser: contact?.appUser ?? null,
    };
};

/** SQL se contacts padh kar Redux me daal do (koi device/network call nahi). */
export const loadContactsFromDb = async (dispatch) => {
    try {
        const [contacts, lastSyncedAt] = await Promise.all([
            getAllContacts(),
            getLastSyncedAt(),
        ]);
        dispatch(setContacts(contacts));
        dispatch(syncFinished(lastSyncedAt));
        return contacts;
    } catch (error) {
        console.log('⚠️ loadContactsFromDb error:', error);
        return [];
    }
};

/**
 * Poora contact sync: device → server (PUT) → server (GET) → SQL → Redux.
 * @returns {Promise<{ok: boolean, count: number, reason?: string}>}
 */
export const contactSync = async (dispatch, { silent = false } = {}) => {
    dispatch(syncStarted());

    try {
        if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
            return { ok: false, count: 0, reason: 'unsupported-platform' };
        }

        // silent (auto sync): permission popup kabhi nahi — sirf jo already mili hai use karo
        const { status } = silent
            ? await Contacts.getPermissionsAsync()
            : await Contacts.requestPermissionsAsync();
        if (status !== 'granted') {
            console.log('📇 contactSync: permission denied');
            return { ok: false, count: 0, reason: 'permission-denied' };
        }

        // ── 1. Device contacts ──────────────────────────────────────────────
        const { data } = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name, Contacts.Fields.Image],
        });

        // phone par de-dupe — ek contact ke kai numbers ho sakte hain aur
        // alag-alag contacts me wahi number bhi ho sakta hai
        const byPhone = new Map();
        (data ?? []).forEach((contact) => {
            contact.phoneNumbers?.forEach(({ number }) => {
                const phone = normalizePhone(number);
                if (!phone || byPhone.has(phone)) return;
                byPhone.set(phone, {
                    id: phone,
                    phone,
                    name: contact.name || 'Unknown',
                    avatar: contact.imageAvailable ? (contact.image?.uri ?? null) : null,
                });
            });
        });

        const phones = [...byPhone.keys()];
        if (!phones.length) {
            return { ok: false, count: 0, reason: 'no-contacts' };
        }

        // ── 2. Server se pata karo kaun app par hai ─────────────────────────
        // isRegistered / appUser ke bina group aur broadcast banana kaam nahi karta,
        // isliye ye step fail hone par sync rok dete hain (SQL ka purana data
        // galat flags se overwrite na ho jaye).
        const { users } = await checkRegisteredContacts(phones);

        const registered = new Map();
        users.forEach((user) => {
            const key = user?.mobile || user?.phone;
            if (key) registered.set(String(key), user);
        });

        const processed = phones.map((phone) => ({
            ...byPhone.get(phone),
            isRegistered: registered.has(phone),
            appUser: registered.get(phone) ?? null,
        }));

        // ── 3. PUT: device ka data server par ───────────────────────────────
        await putContactCache(processed);

        // ── 4. GET: server se wapas — SQL me yahi data jayega ───────────────
        const fromServer = await getContactCache();
        const stored = (Array.isArray(fromServer) ? fromServer : [])
            .map(toStoredContact)
            .filter(Boolean);

        if (!stored.length) {
            // PUT non-empty gaya tha par GET khali laut aaya — round-trip toota hai.
            // Throw karke catch me jaate hain taki SQL ka purana data bacha rahe.
            throw new Error('GET contact-cache returned no contacts after PUT');
        }

        // ── 5. SQL me set (duplicate nahi, purane update ho jate hain) ──────
        await upsertContacts(stored);
        await deleteContactsNotIn(stored.map((contact) => contact.phone));

        const syncedAt = Date.now();
        await setLastSyncedAt(syncedAt);

        // ── 6. SQL se Redux ─────────────────────────────────────────────────
        const contacts = await getAllContacts();
        dispatch(setContacts(contacts));
        dispatch(syncFinished(syncedAt));

        // Contacts badle to chat list ke titles (saved naam / number) bhi refresh karo.
        // Fail ho to sync ko fail nahi karna.
        try { await dispatch(refreshChatNames()); } catch (e) { console.log('refreshChatNames error:', e); }

        // Ek summary line — sync ke baad list khali dikhe to yahin se pata chalta
        // hai ki device par kitne contacts mile aur unme kitne app par hain.
        console.log(
            `📇 contactSync: device=${data?.length ?? 0}, synced=${contacts.length}, ` +
            `on app=${contacts.filter((c) => c.isRegistered).length}`
        );
        return { ok: true, count: contacts.length };
    } catch (error) {
        console.log('❌ contactSync error:', error);
        // Sync fail hua to SQL ka purana data hi dikhate rahenge
        await loadContactsFromDb(dispatch);
        return { ok: false, count: 0, reason: error?.message ?? 'unknown-error' };
    } finally {
        dispatch(syncFinished());
    }
};
