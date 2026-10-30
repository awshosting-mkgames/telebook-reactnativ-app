import * as Contacts from 'expo-contacts/legacy';
import { contactSync } from './contactSync';

const last10 = (v) => String(v ?? '').replace(/\D/g, '').slice(-10);

/**
 * Unknown user ka number phonebook me save karna: device ka contact form number prefilled
 * khulta hai, user khud naam bharta hai. Save ke baad contactSync chalta hai taaki naya naam
 * chat list / headers / calls / groups me global dikhe (contactSync refreshChatNames bhi chalata hai).
 *
 * @returns {Promise<'saved'|'exists'|'cancelled'|'denied'|'error'>}
 */
export const saveUnknownContact = async ({ mobile, dispatch }) => {
    if (!mobile) return 'error';
    try {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') return 'denied';

        const target = last10(mobile);
        const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
        const exists = (data || []).some((c) => (c.phoneNumbers || []).some((p) => last10(p.number) === target));
        if (exists) return 'exists';

        const before = (data || []).length;
        // Form resolve hota hai jab user save / cancel karke wapas aata hai
        await Contacts.presentFormAsync(null, {
            contactType: Contacts.ContactTypes.Person,
            phoneNumbers: [{ label: 'mobile', number: String(mobile) }],
        }, { isNew: true });

        // Save hua ya cancel? Number ab phonebook me hai to saved
        const after = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
        const saved = (after.data || []).some((c) => (c.phoneNumbers || []).some((p) => last10(p.number) === target));
        if (!saved && (after.data || []).length <= before) return 'cancelled';

        if (dispatch) await contactSync(dispatch, { silent: true }).catch(() => {});
        return 'saved';
    } catch (e) {
        console.log('saveUnknownContact error:', e);
        return 'error';
    }
};
