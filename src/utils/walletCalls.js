// Wallet ledger me har call ke HAR billing unit ka alag row hota hai ("Audio call — 1 min" x N) + ek refund/settle row.
// Ye helper unhe ek call = ek line banata hai: asli duration (call history se) aur NET coins (kate − wapas mile).
// Server naya ho to wo pehle hi group karke bhejta hai (row par `callType` hota hai) — tab kuch nahi badalte.

const fmtDuration = (sec) => {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    if (s < 60) return `${s} sec`;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h) return m ? `${h} hr ${m} min` : `${h} hr`;
    return r ? `${m} min ${r} sec` : `${m} min`;
};

const isCallRow = (r) => r?.refModel === 'CallSession' && !!r?.refId && (r.reason === 'call' || r.reason === 'refund');

/** Call rows ke refIds (history se duration lookup ke liye) */
export const callRefIds = (rows = []) => [...new Set(rows.filter((r) => isCallRow(r) && r.callType === undefined).map((r) => String(r.refId)))];

/**
 * @param rows     newest-first ledger rows
 * @param callMap  { [callId]: { type, durationSeconds, acceptedAt, status } } — GET /calls se
 */
export const groupCallTransactions = (rows = [], callMap = {}) => {
    const out = [];
    const groups = new Map();
    for (const r of rows) {
        if (!isCallRow(r) || r.callType !== undefined) { out.push(r); continue; }
        const key = String(r.refId);
        let g = groups.get(key);
        if (!g) {
            g = { item: { ...r }, debits: 0, credits: 0, units: 0, secUnits: false, video: /video/i.test(r.description || '') };
            groups.set(key, g);
            out.push(g.item);   // newest row = group ki jagah (date/balance isi ke)
        }
        if (r.type === 'debit') {
            g.debits += Number(r.amount) || 0;
            if (/\b1 ?min\b/i.test(r.description || '')) g.units += 1;
            if (/\b1 ?s\b/i.test(r.description || '')) { g.units += 1; g.secUnits = true; }
        } else g.credits += Number(r.amount) || 0;
        if (/video/i.test(r.description || '')) g.video = true;
    }
    for (const [key, g] of groups) {
        const net = g.debits - g.credits;
        const call = callMap[key];
        const kind = (call?.type ? call.type === 'video' : g.video) ? 'Video' : 'Audio';
        let dur = null;
        if (call) dur = call.acceptedAt ? fmtDuration(call.durationSeconds) : 'Not connected';
        else if (g.units) dur = g.secUnits ? `${g.units} sec` : `${g.units} min billed`;   // history me nahi mili: kate hue units
        Object.assign(g.item, {
            type: net >= 0 ? 'debit' : 'credit',
            amount: Math.abs(net),
            reason: 'call',
            feature: net >= 0 ? 'Calling' : 'Call refund',
            description: `${kind} call${dur ? ` · ${dur}` : ''}`,
            callType: call?.type || kind.toLowerCase(),
            durationSeconds: call?.acceptedAt ? (call.durationSeconds || 0) : 0,
        });
    }
    return out;
};
