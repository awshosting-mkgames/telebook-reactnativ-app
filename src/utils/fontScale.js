import React from 'react';
import { StyleSheet } from 'react-native';

// App-wide font size (Small / Medium / Large). Har <Text> ka explicit fontSize ek multiplier se guna hota hai.
//
// RN 0.86 + React 19 me Text ek plain function component hai (forwardRef nahi), isliye `Text.render`
// patch karna kaam nahi karta. Iski jagah `react-native` module ka `Text` getter ek wrapper se badalte hain
// (module.exports object-literal getter hai, configurable). Jo bhi `import { Text } from 'react-native'`
// karta hai (screens + third-party libs) use wrapper milta hai; scale badalne par naye render se lagta hai
// (ThemeContext ke consumers turant, baaki screens agle render / app restart par).
export const FONT_SIZES = { small: 0.9, medium: 1, large: 1.15 };

let scale = 1;
let patched = false;

export const setGlobalFontScale = (key) => { scale = FONT_SIZES[key] ?? 1; };
export const getGlobalFontScale = () => scale;

export const patchTextFontScale = () => {
    if (patched) return;
    try {
        const RN = require('react-native');
        const OrigText = RN.Text;
        if (!OrigText) return;
        patched = true;

        // Sirf explicit fontSize scale hota hai: nested <Text> (bina fontSize) parent se inherit karta hai,
        // use 14 maan kar override karne se parent ka size toot jata.
        const ScaledText = (props) => {
            if (scale === 1) return React.createElement(OrigText, props);
            const flat = StyleSheet.flatten(props.style) || {};
            if (typeof flat.fontSize !== 'number') return React.createElement(OrigText, props);
            const extra = { fontSize: flat.fontSize * scale };
            if (typeof flat.lineHeight === 'number') extra.lineHeight = flat.lineHeight * scale;
            return React.createElement(OrigText, { ...props, style: [props.style, extra] });
        };
        ScaledText.displayName = 'Text';

        Object.defineProperty(RN, 'Text', { get: () => ScaledText, configurable: true, enumerable: true });
    } catch (e) {
        patched = false; // font size nahi badlega, par app chalega
    }
};
