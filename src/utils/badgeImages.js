// Plan badge config — EK file me sab kuch (rang, border, icon). Reference images aane par yahin retune karo.
//
// Mapping: Basic -> Silver, Premium -> Gold, VIP -> Diamond.
// Icons: assets/badges/{silver,gold,diamond}.png same naam se replace karne par code nahi badlega.
export const BADGE_ASPECT = 2.6; // chat-list wali chhoti pill image ka aspect (SwipeableChatItem)

export const BADGE_IMAGES = {
    silver: require('../../assets/badges/silver.png'),
    gold: require('../../assets/badges/gold.png'),
    diamond: require('../../assets/badges/diamond.png'),
};

// Profile badge: [icon] + naam, bold border. Silver -> silver, Gold -> golden, Diamond -> blue.
export const BADGE_STYLES = {
    silver:  { name: 'Silver',  icon: BADGE_IMAGES.silver,  border: '#C0C4CC', bg: '#F4F5F7', text: '#4A4F57' },
    gold:    { name: 'Gold',    icon: BADGE_IMAGES.gold,    border: '#D4A017', bg: '#FFF8E1', text: '#7A5A00' },
    diamond: { name: 'Diamond', icon: BADGE_IMAGES.diamond, border: '#1E6FFF', bg: '#EAF2FF', text: '#0B3FA8' },
};
export const BADGE_BORDER_WIDTH = 3; // bold + attractive (2.5-3px)
export const BADGE_ICON_SIZE = 22;

const BY_PLAN = { basic: 'silver', premium: 'gold', vip: 'diamond' };

/** badge = { planCode, label } (server planBadge / entitlements.badge) -> 'silver' | 'gold' | 'diamond' | null */
export const badgeKeyFor = (badge) => {
    if (!badge) return null;
    const byPlan = BY_PLAN[String(badge.planCode || '').toLowerCase()];
    const byLabel = String(badge.label || '').toLowerCase();
    if (byPlan) return byPlan;
    return BADGE_STYLES[byLabel] ? byLabel : null;
};

export const badgeStyleFor = (badge) => BADGE_STYLES[badgeKeyFor(badge)] || null;

/** image source ya null (chat list ki chhoti image ke liye) */
export const badgeImageFor = (badge) => BADGE_IMAGES[badgeKeyFor(badge)] || null;
