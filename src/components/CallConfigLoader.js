import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { fetchCallsConfig } from '../services/callConfigStore';

// ProfileLoader/ContactsLoader (src/index.js) jaisa hi pattern — login ke baad
// ek baar GET /api/calls/config laa kar cache mein daal deta hai, taaki
// ChatHeader/Call screen ko har baar fetch na karna pade.
const CallConfigLoader = () => {
    const token = useSelector((state) => state.totalappData?.apiToken ?? null);
    const doneForToken = useRef(null);

    useEffect(() => {
        if (!token) {
            doneForToken.current = null;
            return;
        }
        if (doneForToken.current === token) return;
        doneForToken.current = token;
        fetchCallsConfig();
    }, [token]);

    return null;
};

export default CallConfigLoader;
