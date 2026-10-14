import { createSlice } from '@reduxjs/toolkit';

// Redux me sirf current contacts rehte hain. Persistent copy SQL me hai
// (src/services/contactsDb.js) — isliye ye slice redux-persist me nahi hai.
const initialState = {
    contacts: [],
    syncing: false,
    lastSyncedAt: null,
};

const contactsSlice = createSlice({
    name: 'contacts',
    initialState,
    reducers: {
        // SQL se padhe hue contacts Redux me set karo
        setContacts: (state, action) => {
            state.contacts = action.payload ?? [];
        },
        syncStarted: (state) => {
            state.syncing = true;
        },
        syncFinished: (state, action) => {
            state.syncing = false;
            if (action.payload) state.lastSyncedAt = action.payload;
        },
        clearContacts: (state) => {
            state.contacts = [];
            state.syncing = false;
            state.lastSyncedAt = null;
        },
    },
});

export const {
    setContacts,
    syncStarted,
    syncFinished,
    clearContacts,
} = contactsSlice.actions;

export default contactsSlice.reducer;
