import { useEffect } from 'react';

// App mein ek waqt par sirf ek hi audio/video baje.
//
// Pehle har player (chat voice note, status video, channel post, media viewer)
// apna alag instance banata tha aur kisi ko dusre ka pata nahi tha, isliye doosra
// audio chalane par pehla background mein chalta rehta tha.
//
// expo-audio aur expo-video dono ke player object par `.playing` aur `.pause()`
// hote hain, isliye ek hi manager dono ke liye kaam karta hai.

let currentPlayer = null;

const safePause = (player) => {
    try {
        player?.pause?.();
    } catch (e) {
        // Player release ho chuka hai (unmount ke baad) — ignore
    }
};

/**
 * Naya player bajane se turant pehle call karo. Purana player usi waqt
 * (synchronously) pause ho jata hai, isliye dono kabhi ek saath nahi bajte.
 */
export const claimPlayback = (player) => {
    if (!player) return;
    if (currentPlayer && currentPlayer !== player) safePause(currentPlayer);
    currentPlayer = player;
};

/** Player ruk gaya ya unmount ho gaya. */
export const releasePlayback = (player) => {
    if (player && currentPlayer === player) currentPlayer = null;
};

/** Sab band karo — screen chhodte waqt ya recording shuru karte waqt. */
export const stopPlayback = () => {
    safePause(currentPlayer);
    currentPlayer = null;
};

// expo-video 'playingChange' bhejta hai, expo-audio 'playbackStatusUpdate'.
// Dono par listener laga dete hain aur asli state player.playing se padhte hain.
const PLAYBACK_EVENTS = ['playingChange', 'playbackStatusUpdate'];

/**
 * Player ko manager se jodta hai. Native controls se play hone par bhi
 * baaki players band ho jate hain, aur unmount par ye player khud ruk jata hai.
 */
export const useExclusivePlayback = (player) => {
    useEffect(() => {
        if (!player) return undefined;

        const sync = () => {
            if (player.playing) claimPlayback(player);
            else releasePlayback(player);
        };

        const subs = [];
        PLAYBACK_EVENTS.forEach((event) => {
            try {
                subs.push(player.addListener(event, sync));
            } catch (e) {
                // Is player par ye event maujood nahi hai — dusra wala chalega
            }
        });

        return () => {
            subs.forEach((sub) => sub?.remove?.());
            releasePlayback(player);
            safePause(player);
        };
    }, [player]);
};
