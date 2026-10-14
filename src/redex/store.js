// src/redux/store.js
import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './reducers/rootReducer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistStore, persistReducer } from 'redux-persist';

const persistConfig = {
    key: 'root',
    storage: AsyncStorage,
    // contacts aur chatList jaan-boojh kar nahi hain: dono ka persistent store
    // SQL hai (services/contactsDb.js, services/chatsDb.js). Dono jagah rakhne
    // se data har change par AsyncStorage me dobara likha jata, aur rehydrate
    // par purana shape Redux ke naye shape ko overwrite kar deta.
    whitelist: ['userData', 'totalappData'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
});

export const persistor = persistStore(store);
