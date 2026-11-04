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
    'obsidian-gold': { key: 'obsidian-gold', name: 'Obsidian Gold', emoji: '🖤', gradient: ['#111827', '#374151'], accent: '#F5B800', main: '#F5B800', bubble: '#F5C84B', background: '#0B0E14', dark: true },
};

export const PREMIUM_THEME_LIST = Object.values(PREMIUM_THEMES);

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const ok = (c) => typeof c === 'string' && HEX.test(c.trim());

const hexToRgb = (hex) => {
    const h = (hex || '#000').replace('#', '');
    const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};
const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** a ko b ki taraf t (0..1) khiskao */
export const mixHex = (a, b, t) => { const x = hexToRgb(a); const y = hexToRgb(b); return rgbToHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (hex) => {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const x = lum(a) + 0.05; const y = lum(b) + 0.05; return x > y ? x / y : y / x; };
/** color ko tab tak gehra/halka karo jab tak `bg` par kam se kam `min` contrast na aa jaye (hue wahi rehta hai) */
export const ensureContrast = (color, bg, min = 3) => {
    const toward = lum(bg) > 0.5 ? '#000000' : '#FFFFFF';
    let c = color;
    for (let i = 0; i < 20 && contrast(c, bg) < min; i++) c = mixHex(c, toward, 0.1);
    return c;
};

/**
 * Backend theme object ({id, accent, colors:{gradientStart,gradientEnd,...}}) ko local defaults ke upar merge karta hai.
 * Admin ko sirf 2 colour dene hote hain (gradientStart/gradientEnd). Gradient badle (ya naya key ho) to accent, main aur
 * bubble in 2 colours se khud nikalte hain — admin ko baaki colour nahi bharne. Background yahan kabhi nahi aata
 * (wo light/dark mode se tay hota hai).
 */
export const resolvePremiumTheme = (key, remote) => {
    const base = PREMIUM_THEMES[key];
    const c = remote?.colors || {};
    const hasGrad = ok(c.gradientStart) && ok(c.gradientEnd);
    if (!base && !hasGrad) return null;
    const start = ok(c.gradientStart) ? c.gradientStart : base.gradient[0];
    const end = ok(c.gradientEnd) ? c.gradientEnd : base.gradient[1];
    const same = base && start.toLowerCase() === base.gradient[0].toLowerCase() && end.toLowerCase() === base.gradient[1].toLowerCase();
    if (same) {
        return { ...base, gradient: [start, end], accent: ok(remote?.accent) ? remote.accent : base.accent, bubble: ok(c.bubble) ? c.bubble : base.bubble };
    }
    return {
        key, name: remote?.name || base?.name || key, emoji: base?.emoji || '🎨',
        gradient: [start, end],
        accent: end,
        main: end,
        bubble: ok(c.bubble) ? c.bubble : mixHex(end, '#FFFFFF', 0.82),
        background: '#FFFFFF',
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
 * Base (light/dark) theme ke upar premium theme laga do.
 * Rule: light/dark MODE hi background, text, card, input, chat-background tay karta hai.
 * Premium/admin theme sirf "accent" cheezein badalti hai: header gradient, button, selected/active
 * option, FAB, icon (main/accent) aur apne bhejhe message ka bubble. Isliye background/card/text
 * yahan kabhi override nahi hote (Obsidian Gold bhi ab light mode me light rehta hai).
 */
export const applyPremiumTheme = (base, p) => {
    if (!p) return base;
    const light = base.mode === 'light';
    const mainFor = ensureContrast(p.main, light ? '#FFFFFF' : '#000000', light ? 3 : 4.5);
    return {
        ...base,
        premiumKey: p.key,
        gradient: p.gradient,
        accent: p.accent,
        accentText: readableOn(p.accent),
        // main ko mode ke background par readable bana do (light me chamakdar yellow/gold/pastel gehra ho jata hai,
        // dark me bahut gehra halka). Isse har theme dono modes me chalti hai.
        main: mainFor,
        maincolor: mainFor,
        header: p.gradient[0],
        headerText: '#FFFFFF',
        batchColor: light ? p.bubble : base.batchColor,
        bubbleMine: p.dark ? p.bubble : (light ? p.bubble : base.bubbleMine),
        bubbleMineText: p.dark ? '#1A1405' : undefined,
    };
};
