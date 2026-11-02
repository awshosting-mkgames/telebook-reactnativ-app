// Premium Luxury Gradient themes. Keys backend `Theme.key` se match karte hain
// (telebook-backend-api/src/config/seedThemes.js) — backend ke bhi values aate
// hain, ye local copy sirf offline / pehle frame ke liye hai.
//
// accent  : spec ka accent colour — active pill, filter chip background, highlights.
// main    : accent ka gehra (contrast-safe) roop — icon/text/FAB, jo safed background par
//           bhi saaf dikhe (jaise Rose Gold ka #FFC1D5 safed par nahi dikhta).
export const PREMIUM_THEMES = {
    'royal-sapphire': { key: 'royal-sapphire', name: 'Royal Sapphire', emoji: '🔵', gradient: ['#1565C0', '#00B4DB'], accent: '#00C6FF', main: '#0A84D0', bubble: '#D9F0FF', background: '#F5FAFF' },
    'emerald-luxury': { key: 'emerald-luxury', name: 'Emerald Luxury', emoji: '🟢', gradient: ['#064E3B', '#10B981'], accent: '#34D399', main: '#059669', bubble: '#D1FAE5', background: '#F3FCF7' },
    'royal-amethyst': { key: 'royal-amethyst', name: 'Royal Amethyst', emoji: '🟣', gradient: ['#581C87', '#A855F7'], accent: '#D8B4FE', main: '#9333EA', bubble: '#F0E3FF', background: '#FAF7FF' },
    'rose-gold': { key: 'rose-gold', name: 'Rose Gold', emoji: '🌸', gradient: ['#9D174D', '#F09AB8'], accent: '#FFC1D5', main: '#D6336C', bubble: '#FFE4ED', background: '#FFF8FA' },
    'obsidian-gold': { key: 'obsidian-gold', name: 'Obsidian Gold', emoji: '🖤', gradient: ['#111827', '#374151'], accent: '#D4AF37', main: '#B8921F', bubble: '#F5EACB', background: '#F8F7F2' },
};

export const PREMIUM_THEME_LIST = Object.values(PREMIUM_THEMES);

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const ok = (c) => typeof c === 'string' && HEX.test(c.trim());

/** Backend theme object ({id, accent, colors:{gradientStart,...}}) ko local defaults ke upar merge karta hai */
export const resolvePremiumTheme = (key, remote) => {
    const base = PREMIUM_THEMES[key];
    if (!base) return null;
    const c = remote?.colors || {};
    const start = ok(c.gradientStart) ? c.gradientStart : base.gradient[0];
    const end = ok(c.gradientEnd) ? c.gradientEnd : base.gradient[1];
    const accent = ok(remote?.accent) ? remote.accent : base.accent;
    return {
        ...base,
        gradient: [start, end],
        accent,
        bubble: ok(c.bubble) ? c.bubble : base.bubble,
        background: ok(c.background) ? c.background : base.background,
    };
};

/** Gradient/accent par kaunsa text/icon colour padhne layak hai (WCAG luminance) */
export const readableOn = (hex) => {
    const h = (hex || '#000').replace('#', '');
    const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? '#111111' : '#FFFFFF';
};

/**
 * Base (light/dark) theme ke upar premium theme laga do. Dark mode me background/bubble
 * dark hi rehte hain; gradient + accent dono modes me lagte hain.
 */
export const applyPremiumTheme = (base, p) => {
    if (!p) return base;
    const light = base.mode === 'light';
    return {
        ...base,
        premiumKey: p.key,
        gradient: p.gradient,
        accent: p.accent,
        accentText: readableOn(p.accent),
        main: p.main,
        maincolor: p.main,
        header: p.gradient[0],
        headerText: '#FFFFFF',
        batchColor: light ? p.bubble : base.batchColor,
        ...(light ? { background: p.background, bubbleMine: p.bubble, freeChatmess: p.bubble } : {}),
    };
};
