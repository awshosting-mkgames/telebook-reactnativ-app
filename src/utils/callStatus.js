// "Missed call" = mujhe (receiver ko) aayi call jo maine receive nahi ki: ring timeout (missed), caller ne uthane se pehle
// kaat di (cancelled), ya connect nahi ho paayi (failed). Maine khud reject ki ho (rejected) to missed nahi.
// Purane server ke rows me sirf status + durationSeconds aate hain, isliye wahi use karte hain.
const NOT_RECEIVED = ['missed', 'cancelled', 'failed'];

export const isMissedCall = (c) => !!c
    && c.direction === 'incoming'
    && NOT_RECEIVED.includes(c.status)
    && !(Number(c.durationSeconds) > 0);
