import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import socketService from '../services/socketService';
import { acceptCall, rejectCall } from '../services/callHelpers';
import { navigate as rootNavigate } from '../navigation/RootNavigation';
import IncomingCallOverlay from '../screens/Call/IncomingCallOverlay';
import { cancelIncomingCallNotification } from './notification';
import { playRingtone, stopRingtone } from '../services/ringtoneModule';

// Always-mounted sibling (ChatListSocketSync.js jaisa) — `call:incoming` par
// ek global full-screen overlay dikhata hai, chahe app kisi bhi screen/tab
// par ho. Koi portal/modal-provider is codebase mein nahi hai, isliye Toast
// jaisa hi ek absolutely-positioned View use kiya hai.
const IncomingCallManager = () => {
    const token = useSelector((state) => state.totalappData?.apiToken ?? null);
    const [incomingCall, setIncomingCall] = useState(null); // {callId, type, caller, startedAt, ringTimeoutSeconds}
    const acceptingRef = useRef(false);

    useEffect(() => {
        if (!token) {
            setIncomingCall(null);
            return undefined;
        }

        const handleIncoming = (payload) => {
            if (!payload?.callId) return;
            acceptingRef.current = false;
            setIncomingCall(payload);
            playRingtone();
        };
        // Caller ne hangup kar diya ya ringTimeoutSeconds beet gaya — overlay hata do.
        const handleEnded = (payload) => {
            if (payload?.callId) cancelIncomingCallNotification(payload.callId);
            stopRingtone();
            setIncomingCall((cur) => (cur && cur.callId === payload?.callId ? null : cur));
        };

        socketService.on('call:incoming', handleIncoming);
        socketService.on('call:ended', handleEnded);

        return () => {
            socketService.off('call:incoming', handleIncoming);
            socketService.off('call:ended', handleEnded);
            stopRingtone();
        };
    }, [token]);

    if (!incomingCall) return null;

    const handleAccept = async () => {
        if (acceptingRef.current) return;
        acceptingRef.current = true;
        stopRingtone();
        cancelIncomingCallNotification(incomingCall.callId); // race-safe: push bhi aa gaya ho to hata do
        const res = await acceptCall(incomingCall.callId);
        if (res.ok) {
            socketService.setCallActive(true);
            setIncomingCall(null);
            rootNavigate('InCall', {
                callId: incomingCall.callId,
                type: incomingCall.type,
                isIncoming: true,
                agora: res.agora,
                billing: res.billing,
                remoteUser: incomingCall.caller,
            });
        } else {
            // Call already ended/timed out server-side — bas overlay hata do.
            setIncomingCall(null);
        }
        acceptingRef.current = false;
    };

    const handleReject = () => {
        stopRingtone();
        rejectCall(incomingCall.callId);
        cancelIncomingCallNotification(incomingCall.callId);
        setIncomingCall(null);
    };

    return (
        <View style={styles.overlay}>
            <IncomingCallOverlay
                caller={incomingCall.caller}
                type={incomingCall.type}
                onAccept={handleAccept}
                onReject={handleReject}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999, elevation: 9999,
    },
});

export default IncomingCallManager;
