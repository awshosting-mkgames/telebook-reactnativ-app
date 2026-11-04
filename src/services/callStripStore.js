// Ongoing-call strip (ActiveCallBar) ki asli height — jab strip dikh rahi ho (>0) to app ka baaki content
// uske neeche shuru hota hai, taaki strip screen ke header ko dhank na de. 0 = strip nahi dikh rahi.
import { useSyncExternalStore } from 'react';

let height = 0;
const listeners = new Set();

export const setCallStripHeight = (h) => {
    const next = Math.max(0, Math.round(h || 0));
    if (next === height) return;
    height = next;
    listeners.forEach((fn) => fn());
};

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const useCallStripHeight = () => useSyncExternalStore(subscribe, () => height, () => 0);
