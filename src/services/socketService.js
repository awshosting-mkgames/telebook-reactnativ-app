/**
 * socketService.js — Global singleton socket
 *
 * Ek hi socket connection poori app mein share hogi.
 * ChatList aur ChatScreen dono isko use karenge —
 * isliye message aane par ChatList bhi real-time update hoga.
 *
 * Usage:
 *   socketService.connect(token, userId)   → App start par (App.js ya auth ke baad)
 *   socketService.disconnect()             → Logout par
 *   socketService.getSocket()              → socket instance lene ke liye
 *   socketService.on(event, cb)            → kisi bhi screen se event sun'na
 *   socketService.off(event, cb)           → screen unmount par remove karo
 *   socketService.emit(event, data)        → event bhejo
 */

import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import Config from './config';

class SocketService {
    constructor() {
        this._socket   = null;
        this._userId   = null;
        this._listeners = {}; // event → Set of callbacks
        this._joinedChats = new Set(); // reconnect par dobara join karne ke liye
        this._appStateSub = null;
        this._callActive = false; // ek live call chal rahi ho to background disconnect skip karo
    }

    // API doc (section 7, rule 4): background me socket band, active par wapas.
    // Socket khula rehne par server user ko online samajhta hai aur push nahi bhejta.
    // iOS 'inactive' (notification center, app switcher) par band nahi karna.
    //
    // Exception: ek call chal rahi ho (_callActive) to background jaane par bhi
    // socket mat kaato — warna `call:ended`/`call:balance-warning` kabhi nahi
    // milenge aur InCallScreen ko pata hi nahi chalega call kab khatam hui.
    _watchAppState() {
        if (this._appStateSub) return;
        this._appStateSub = AppState.addEventListener('change', (state) => {
            if (!this._socket) return;
            if (state === 'active') {
                if (!this._socket.connected) this._socket.connect();
            } else if (state === 'background') {
                if (!this._callActive) this._socket.disconnect();
            }
        });
    }

    // InCallScreen/IncomingCallManager call start/end par yeh set karte hain.
    setCallActive(active) {
        this._callActive = !!active;
    }

    connect(token, userId) {
        // Socket pehle se bana hai (connected ya abhi connect ho raha hai) to
        // doosra mat banao — warna do socket bante hain aur har event do baar aata hai.
        // Reconnect socket.io khud karta hai.
        if (this._socket && this._userId === userId) return;
        if (this._socket) this.disconnect();

        this._userId = userId;
        this._socket = io(Config?.CHAT_URL, {
            auth:       { token },
            transports: ['websocket'],
            reconnection:      true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000, // backoff cap 10s
            reconnectionAttempts: Infinity, // network aate hi hamesha reconnect try karo
        });

        // Jo screens socket banne se pehle `on()` kar chuki hain, unke listeners
        // naye socket par laga do.
        Object.entries(this._listeners).forEach(([event, set]) => {
            set.forEach((cb) => this._socket.on(event, cb));
        });

        this._socket.on('connect', () => {
            this._socket.emit('setup', { _id: userId });
            // Reconnect ke baad server room bhool jata hai — khuli chats dobara join karo
            this._joinedChats.forEach((chatId) => this._socket.emit('join-chat', chatId));
            console.log('[Socket] Connected:', this._socket.id);
        });

        // API doc (section 7, rule 3): har `message-received` par `message-delivered`
        // bhejo — chahe koi bhi screen khuli ho. Isi se sender ko ✓✓ dikhta hai.
        this._socket.on('message-received', (msg) => {
            if (msg?._id) this._socket?.emit('message-delivered', { messageId: msg._id });
        });

        this._watchAppState();

        this._socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
        });

        this._socket.on('connect_error', (err) => {
            console.warn('[Socket] Error:', err.message);
        });
    }

    disconnect() {
        this._appStateSub?.remove();
        this._appStateSub = null;
        if (this._socket) {
            this._socket.disconnect();
            this._socket = null;
            this._userId = null;
        }
        this._joinedChats.clear();
    }

    getSocket() {
        return this._socket;
    }

    isConnected() {
        return this._socket?.connected ?? false;
    }

    emit(event, data) {
        this._socket?.emit(event, data);
    }

    on(event, callback) {
        if (!callback) return;
        if (!this._listeners[event]) this._listeners[event] = new Set();
        if (this._listeners[event].has(callback)) return;
        this._listeners[event].add(callback);
        this._socket?.on(event, callback);
    }

    // Hamesha callback ke saath call karo. Bina callback ke us event ke SAARE
    // listeners hat jate hain — doosri screens (jaise chat list) ke bhi.
    off(event, callback) {
        if (callback) {
            this._listeners[event]?.delete(callback);
            this._socket?.off(event, callback);
        } else {
            this._listeners[event]?.forEach((cb) => this._socket?.off(event, cb));
            delete this._listeners[event];
        }
    }

    joinChat(chatId) {
        if (!chatId) return;
        this._joinedChats.add(chatId);
        this.emit('join-chat', chatId);
    }

    leaveChat(chatId) {
        if (!chatId) return;
        this._joinedChats.delete(chatId);
        this.emit('leave-chat', chatId);
    }
}

// Singleton export — poori app mein ek hi instance
export default new SocketService();
