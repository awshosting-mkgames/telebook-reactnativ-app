// Chal rahi call ki state (module-level). Pehle sab kuch InCallScreen ke component state me tha
// aur screen unmount (kisi aur page par jana / back) hote hi call teardown ho jaati thi.
// Ab call screen se alag zinda rehti hai: InCallScreen sirf iska UI hai, aur ActiveCallBar
// kisi bhi page par "Ongoing call" mini bar dikhata hai (Point 13).

let active = null; // {callId,type,isIncoming,remoteUser,agora,phase,connected,startedAt,muted,speakerOn,cameraOn}
const subs = new Set();
const emit = () => subs.forEach((fn) => { try { fn(active); } catch (e) { /* ignore */ } });

export const getActiveCall = () => active;
export const setActiveCall = (call) => { active = call; emit(); };
export const patchActiveCall = (patch) => {
    if (!active) return;
    active = { ...active, ...patch };
    emit();
};
export const clearActiveCall = () => { if (active) { active = null; emit(); } };
export const subscribeActiveCall = (fn) => { subs.add(fn); return () => subs.delete(fn); };

// ── Call waiting (Point 13.3) ────────────────────────────────────────────────
// Ek call chal rahi ho aur doosri uthayi jaye to pehli yahan HOLD par rakhi jaati hai.
// Ek engine/ek channel hi hota hai, isliye hold wali call Agora channel se bahar hai
// (server par 'ongoing' hi rehti hai) aur resume par usi channel me dobara join hota hai.
let held = null; // active jaisi hi shape
export const getHeldCall = () => held;
export const setHeldCall = (call) => { held = call; emit(); };
export const clearHeldCall = () => { if (held) { held = null; emit(); } };

// Jin callIds ka `call:ended` hum khud la rahe hain (End & Accept) — screen/bar unhe
// "call khatam" maan kar naya call na tod dein.
const switching = new Set();
export const markSwitching = (callId) => {
    switching.add(String(callId));
    setTimeout(() => switching.delete(String(callId)), 15000);
};
export const isSwitching = (callId) => switching.has(String(callId));

// Samne wala (remote) ne hume hold par rakha ho
let remoteHold = {}; // callId -> bool
export const setRemoteHold = (callId, v) => { remoteHold = { ...remoteHold, [callId]: !!v }; emit(); };
export const isRemoteHeld = (callId) => !!remoteHold[callId];

// ── Recharge popup (coins khatam hone par call kat'ti hai) ──────────────────────
// Call screen kisi bhi page par ho sakti hai (ya band), isliye popup ek global listener
// (ActiveCallBar) dikhata hai; InCallScreen / ActiveCallBar dono yahi trigger karte hain.
let rechargeVisible = false;
const rechargeSubs = new Set();
export const isRechargePromptVisible = () => rechargeVisible;
export const showRechargePrompt = () => { rechargeVisible = true; rechargeSubs.forEach((fn) => fn(true)); };
export const hideRechargePrompt = () => { rechargeVisible = false; rechargeSubs.forEach((fn) => fn(false)); };
export const subscribeRechargePrompt = (fn) => { rechargeSubs.add(fn); return () => rechargeSubs.delete(fn); };
