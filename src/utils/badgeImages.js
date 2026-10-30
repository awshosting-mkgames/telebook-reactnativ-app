// Plan badge images. Files assets/badges/{silver,gold,diamond}.png abhi PLACEHOLDER (simple coloured
// circles) hain — final artwork aate hi same naam se in files ko replace kar do, code nahi badlega.
//
// Mapping: Basic -> Silver, Premium -> Gold, VIP -> Diamond.
export const BADGE_IMAGES = {
    silver: require('../../assets/badges/silver.png'),
    gold: require('../../assets/badges/gold.png'),
    diamond: require('../../assets/badges/diamond.png'),
};

const BY_PLAN = { basic: 'silver', premium: 'gold', vip: 'diamond' };

/** badge = { planCode, label } (server planBadge / entitlements.badge) -> image source ya null */
export const badgeImageFor = (badge) => {
    if (!badge) return null;
    const byPlan = BY_PLAN[String(badge.planCode || '').toLowerCase()];
    const byLabel = String(badge.label || '').toLowerCase();
    return BADGE_IMAGES[byPlan] || BADGE_IMAGES[byLabel] || null;
};
