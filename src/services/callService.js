/**
 * callService.js — Agora voice/video engine wrapper (singleton)
 *
 * socketService.js jaisa hi singleton pattern — screen unmount/remount ke
 * beech bhi call zinda rehni chahiye, isliye engine yahan rakha hai, kisi
 * component ke state mein nahi.
 *
 * Usage:
 *   callService.requestCallPermissions(isVideo) → mount se pehle
 *   callService.init({appId})                   → POST /api/calls / /accept se mila appId
 *   callService.joinChannel({token, channel, uid, isVideo})
 *   callService.on('userJoined'|'userOffline'|'connectionStateChanged'|'error', cb)
 *   callService.leaveChannel()                   → call khatam
 *   callService.release()                        → screen unmount, poora teardown
 */

import { PermissionsAndroid, Platform } from 'react-native';
import createAgoraRtcEngine, {
    ChannelProfileType,
    ClientRoleType,
    DegradationPreference,
} from 'react-native-agora';

class CallService {
    constructor() {
        this._engine = null;
        this._appId = null;
        this._handler = null;
        this._isVideo = false;
        this._joinedChannel = null; // abhi kis channel me hain (screen dobara khulne par re-join na ho)
        this._listeners = {}; // event → Set of callbacks
    }

    async requestCallPermissions(isVideo) {
        if (Platform.OS !== 'android') return true;
        const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
        if (isVideo) perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
        try {
            const results = await PermissionsAndroid.requestMultiple(perms);
            return Object.values(results).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
        } catch (e) {
            console.warn('[CallService] permission error:', e?.message);
            return false;
        }
    }

    // Idempotent — same appId par dobara init call karna safe hai (no-op).
    init({ appId }) {
        if (this._engine && this._appId === appId) return this._engine;
        if (this._engine) this.release();

        this._appId = appId;
        this._engine = createAgoraRtcEngine();
        this._engine.initialize({
            appId,
            channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });

        // Agora v4: ek hi combined handler object — har event apne listener
        // Set ko dispatch karta hai, socketService._listeners jaisa.
        this._handler = {
            onUserJoined: (_connection, remoteUid) => this._emit('userJoined', remoteUid),
            onUserOffline: (_connection, remoteUid, reason) => this._emit('userOffline', remoteUid, reason),
            onConnectionStateChanged: (_connection, state, reason) => this._emit('connectionStateChanged', state, reason),
            onError: (err, msg) => this._emit('error', err, msg),
        };
        this._engine.registerEventHandler(this._handler);
        return this._engine;
    }

    joinChannel({ token, channel, uid, isVideo }) {
        if (!this._engine) return;
        this._isVideo = !!isVideo;
        this._joinedChannel = channel;
        if (isVideo) {
            this._engine.enableVideo();
            // Agora ka SDK-default encoder config set nahi tha, isliye poor
            // network par bitrate bahut neeche gir sakta tha ("blurry" video).
            // Explicit config + MaintainQuality — bandwidth kam ho to pehle
            // frame-rate girao, resolution/sharpness nahi.
            this._engine.setVideoEncoderConfiguration({
                dimensions: { width: 640, height: 480 },
                frameRate: 15,
                degradationPreference: DegradationPreference.MaintainQuality,
            });
            this._engine.startPreview();
        }
        this._engine.joinChannel(token, channel, uid, {
            clientRoleType: ClientRoleType.ClientRoleBroadcaster,
            publishMicrophoneTrack: true,
            publishCameraTrack: !!isVideo,
            autoSubscribeAudio: true,
            autoSubscribeVideo: !!isVideo,
        });
    }

    isJoined(channel) { return !!this._engine && this._joinedChannel === channel; }

    leaveChannel() {
        this._joinedChannel = null;
        if (!this._engine) return;
        try {
            this._engine.leaveChannel();
            if (this._isVideo) this._engine.stopPreview();
        } catch (e) {
            console.warn('[CallService] leaveChannel error:', e?.message);
        }
    }

    // Poora teardown — in-call screen unmount par. leaveChannel() alag hai
    // taaki "retry same call" jaisi situation mein dobara init na karna pade.
    release() {
        if (!this._engine) return;
        try {
            if (this._handler) this._engine.unregisterEventHandler(this._handler);
            this._engine.release();
        } catch (e) {
            console.warn('[CallService] release error:', e?.message);
        }
        this._engine = null;
        this._appId = null;
        this._handler = null;
        this._isVideo = false;
        this._joinedChannel = null;
    }

    toggleMute(muted) { this._engine?.muteLocalAudioStream(muted); }
    toggleSpeaker(on) { this._engine?.setEnableSpeakerphone(on); }
    toggleCamera(on) { this._engine?.enableLocalVideo(on); }
    switchCamera() { this._engine?.switchCamera(); }

    on(event, callback) {
        if (!callback) return;
        if (!this._listeners[event]) this._listeners[event] = new Set();
        this._listeners[event].add(callback);
    }

    off(event, callback) {
        if (callback) this._listeners[event]?.delete(callback);
        else delete this._listeners[event];
    }

    _emit(event, ...args) {
        this._listeners[event]?.forEach((cb) => cb(...args));
    }
}

// Singleton export — poori app mein ek hi instance (socketService jaisa)
export default new CallService();
