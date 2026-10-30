import React from 'react';
import { StyleSheet, Text } from 'react-native';

// App-wide font size (Small / Medium / Large). Har <Text> ka fontSize ek multiplier se guna hota hai.
// Text.render ko ek baar patch karte hain; scale badalne par naye render se lagta hai
// (ThemeContext ke consumers turant, baaki screens agle render / app restart par).
export const FONT_SIZES = { small: 0.9, medium: 1, large: 1.15 };

let scale = 1;
let patched = false;

export const setGlobalFontScale = (key) => { scale = FONT_SIZES[key] ?? 1; };
export const getGlobalFontScale = () => scale;

export const patchTextFontScale = () => {
    if (patched || typeof Text.render !== 'function') return;
    patched = true;
    const origRender = Text.render;
    Text.render = function render(props, ref) {
        const el = origRender.call(this, props, ref);
        if (scale === 1 || !el || !el.props) return el;
        const flat = StyleSheet.flatten(el.props.style) || {};
        const fs = typeof flat.fontSize === 'number' ? flat.fontSize : 14;
        const extra = { fontSize: fs * scale };
        if (typeof flat.lineHeight === 'number') extra.lineHeight = flat.lineHeight * scale;
        return React.cloneElement(el, { style: [el.props.style, extra] });
    };
};
