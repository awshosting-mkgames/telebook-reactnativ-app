import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';

// Globally display name ka ek hi niyam:
//   1. Phonebook me saved naam  → title (har jagah)
//   2. Saved nahi → mobile number title; Telebook profile naam chhote text me neeche,
//      profile naam bhi na ho to "Unknown".
// Profile/registration naam kabhi title nahi banta (jab tak number hi na ho).

const last10 = (v) => String(v ?? '').replace(/\D/g, '').slice(-10);

export const formatMobile = (mobile, countryCode) => {
    const d = last10(mobile);
    if (!d) return '';
    const cc = String(countryCode ?? '').replace(/\D/g, '');
    if (cc && d.length === 10) return `+${cc} ${d.slice(0, 5)} ${d.slice(5)}`;
    return d;
};

// contacts (Redux/SQL) → Map(last10 → saved naam). 'Unknown' contactSync ka placeholder hai.
export const buildSavedNameMap = (contacts = []) => {
    const map = new Map();
    contacts.forEach((c) => {
        const key = last10(c?.phone ?? c?.mobile);
        const name = (c?.name || '').trim();
        if (key && name && name !== 'Unknown') map.set(key, name);
    });
    return map;
};

/**
 * user = { mobile|phone, countryCode?, name? } (name = Telebook profile naam)
 * → { title, subtitle, isSaved }  (subtitle sirf unsaved par; saved par null)
 */
export const resolveUserName = (user, savedMap) => {
    const key = last10(user?.mobile ?? user?.phone);
    const profile = (user?.name || '').trim();
    const saved = key ? savedMap?.get(key) : null;
    if (saved) return { title: saved, subtitle: null, isSaved: true };
    const num = formatMobile(user?.mobile ?? user?.phone, user?.countryCode);
    if (num) return { title: num, subtitle: profile || 'Unknown', isSaved: false };
    // number hi nahi pata (purana payload) — profile naam fallback, warna Unknown
    return { title: profile || 'Unknown', subtitle: null, isSaved: false };
};

/** Hook: contacts badalne par components khud re-render hote hain. */
export const useNameResolver = () => {
    const contacts = useSelector((s) => s.contacts?.contacts);
    const map = useMemo(() => buildSavedNameMap(contacts ?? []), [contacts]);
    return useCallback((user) => resolveUserName(user, map), [map]);
};
