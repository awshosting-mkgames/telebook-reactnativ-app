// Auth aur info screens ke common colors — light/dark dono me ek jaisa look.
// theme.js me subText/borderColor nahi hain, isliye yahan derive karte hain.
export const PRIMARY = '#1199ff';

export const getUiColors = (theme) => {
    const isDark = theme?.mode === 'dark';
    // Theme ka accent follow karo; hex ho tabhi alpha suffix lagta hai
    const main = theme?.main || PRIMARY;
    const isHex = /^#[0-9a-f]{6}$/i.test(main);
    return {
        isDark,
        primary: main,
        primarySoft: isHex ? main + (isDark ? '33' : '22') : (isDark ? '#0E2A42' : '#EAF5FF'),
        primaryDisabled: isHex ? main + '88' : (isDark ? '#1E4C72' : '#9FD2FF'),
        bg: isDark ? '#000000' : '#FFFFFF',
        card: isDark ? '#141414' : '#F6F7F9',
        border: isDark ? '#2A2A2A' : '#E6E8EB',
        text: isDark ? '#FFFFFF' : '#0F1115',
        subText: isDark ? '#9A9A9A' : '#6B7280',
        mutedText: isDark ? '#6B6B6B' : '#9CA3AF',
        error: '#E24B4A',
        barStyle: isDark ? 'light-content' : 'dark-content',
    };
};
