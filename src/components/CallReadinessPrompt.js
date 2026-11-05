import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { promptCallReadinessIfNeeded } from '../services/callReadiness';

// Login ke baad ek baar: lock-screen call aur battery settings ki jaanch (UI nahi, sirf Alert).
export default function CallReadinessPrompt() {
    const token = useSelector((s) => s.totalappData?.apiToken ?? null);
    useEffect(() => {
        if (!token) return undefined;
        const t = setTimeout(promptCallReadinessIfNeeded, 4000);   // app settle hone do
        return () => clearTimeout(t);
    }, [token]);
    return null;
}
