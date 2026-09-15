import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import { useDispatch, useSelector } from 'react-redux';
import { saveContacts, fetchCachedContacts } from '../redex/slices/contactsSlice';
import { checkRegisteredContacts } from '../services/checkRegisteredContacts';

const normalizePhone = (phone) => {
    if (!phone) return null;
    let cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length > 10) cleaned = cleaned.slice(-10);
    if (cleaned.length !== 10 || !/^[6789]/.test(cleaned)) return null;
    return cleaned;
};

export default function useContactSync() {
    const dispatch   = useDispatch();
    const hasSynced  = useSelector((state) => state.contacts.hasSynced);
    const [loading, setLoading] = useState(false);

    const loadCachedContacts = useCallback(async () => {
        try {
            const result = await dispatch(fetchCachedContacts()).unwrap();
            console.log('📋 Cached contacts loaded:', result?.length);
        } catch (err) {
            console.log('⚠️ GET contact-cache error:', err);
        }
    }, [dispatch]);

    const runFullSync = useCallback(async () => {
        setLoading(true);
        try {
            if (Platform.OS !== 'android') {
                await loadCachedContacts();
                return;
            }

            const { status } = await Contacts.requestPermissionsAsync();
            if (status !== 'granted') {
                console.log('❌ Permission nahi mili → cached load');
                await loadCachedContacts();
                return;
            }

            const { data } = await Contacts.getContactsAsync({
                fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name, Contacts.Fields.Image],
            });

            if (!data?.length) {
                console.log('❌ Contacts nahi hain → cached load');
                await loadCachedContacts();
                return;
            }

            const contactMap = {};
            const allPhones  = [];

            data.forEach((contact) => {
                contact.phoneNumbers?.forEach(({ number }) => {
                    const normalized = normalizePhone(number);
                    if (normalized && !contactMap[normalized]) {
                        contactMap[normalized] = {
                            id:     normalized,
                            name:   contact.name || 'Unknown',
                            phone:  normalized,
                            avatar: contact.imageAvailable ? contact.image?.uri : null,
                        };
                        allPhones.push(normalized);
                    }
                });
            });

            if (!allPhones.length) {
                await loadCachedContacts();
                return;
            }

            let users = [];
            try {
                const result = await checkRegisteredContacts(allPhones);
                users = result?.users || [];
                console.log(`✅ Sync: ${users.length} registered users mile`);
            } catch (syncErr) {
                console.log('⚠️ checkRegisteredContacts error:', syncErr);
                await loadCachedContacts();
                return;
            }

            const registeredMap = {};
            users.forEach((user) => {
                const key = user.mobile || user.phone;
                if (key) registeredMap[key] = user;
            });

            const processed = allPhones.map((phone) => ({
                ...contactMap[phone],
                isRegistered: !!registeredMap[phone],
                appUser:      registeredMap[phone] ?? null,
            }));

            try {
                await dispatch(saveContacts(processed)).unwrap();
                console.log(`✅ PUT: ${processed.length} contacts saved`);
            } catch (saveErr) {
                console.log('⚠️ saveContacts error:', saveErr);
            }
        } catch (err) {
            console.log('❌ runFullSync error:', err);
        } finally {
            await loadCachedContacts();
            setLoading(false);
        }
    }, [dispatch, loadCachedContacts]);

    // App open pe call karo — pehli baar full sync, baad mein sirf GET
    const fetchAndSyncContacts = useCallback(async () => {
        if (hasSynced) {
            console.log('⚡ Already synced → cached load only');
            await loadCachedContacts();
        } else {
            console.log('🔄 First time → full sync');
            await runFullSync();
        }
    }, [hasSynced, loadCachedContacts, runFullSync]);

    // Sync button pe call karo — hamesha full sync
    const manualSync = useCallback(async () => {
        console.log('🔄 Manual sync triggered');
        await runFullSync();
    }, [runFullSync]);

    return {
        loading,
        fetchAndSyncContacts,
        manualSync,
        loadCachedContacts,
    };
}
