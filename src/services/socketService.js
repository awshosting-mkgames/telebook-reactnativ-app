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

import { io } from 'socket.io-client';
import Config from './config';

class SocketService {
    constructor() {
        this._socket   = null;
        this._userId   = null;
        this._listeners = {}; // event → Set of callbacks
    }

    connect(token, userId) {
        // Already connected hai toh naya mat banao
        if (this._socket?.connected) return;

        this._userId = userId;
        this._socket = io(Config?.CHAT_URL, {
            auth:       { token },
            transports: ['websocket'],
            reconnection:      true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10,
        });

        this._socket.on('connect', () => {
            this._socket.emit('setup', { _id: userId });
            console.log('[Socket] Connected:', this._socket.id);
        });

        this._socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
        });

        this._socket.on('connect_error', (err) => {
            console.warn('[Socket] Error:', err.message);
        });
    }

    disconnect() {
        if (this._socket) {
            this._socket.disconnect();
            this._socket = null;
            this._userId = null;
        }
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
        if (!this._socket) return;
        this._socket.on(event, callback);
    }

    off(event, callback) {
        if (!this._socket) return;
        if (callback) {
            this._socket.off(event, callback);
        } else {
            this._socket.removeAllListeners(event);
        }
    }

    joinChat(chatId) {
        this.emit('join-chat', chatId);
    }

    leaveChat(chatId) {
        this.emit('leave-chat', chatId);
    }
}

// Singleton export — poori app mein ek hi instance
export default new SocketService();
