import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSelector } from 'react-redux';
import socketService from '../services/socketService';
import { flushPending } from '../services/statusSync';
import { purgeExpiredStatus } from '../services/statusDb';

// Login ke baad hamesha mounted: status ka offline queue (views / reactions) jab bhi network wapas aaye bhejta hai
// — app foreground, socket reconnect, aur start par. Expire hue local status / seen bhi saaf karta hai.
export default function StatusSyncManager() {
    const token = useSelector((s) => s.totalappData?.apiToken ?? null);
    useEffect(() => {
        if (!token) return undefined;
        const run = () => { purgeExpiredStatus().catch(() => {}); flushPending(); };
        run();
        const sub = AppState.addEventListener('change', (st) => { if (st === 'active') run(); });
        socketService.on('connect', run);
        return () => { sub.remove(); socketService.off('connect', run); };
    }, [token]);
    return null;
}
