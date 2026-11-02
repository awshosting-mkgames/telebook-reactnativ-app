import React, { useContext, useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ThemeContext } from './ThemeContext';

// theme.gradient ho to parent ko 135deg gradient se bhar deta hai (parent ka
// backgroundColor fallback rehta hai). Gradient na ho to kuch render nahi karta.
// react-native-svg pehle se installed hai, isliye native rebuild nahi chahiye.
export default function GradientFill({ colors }) {
    const { theme } = useContext(ThemeContext);
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const g = colors || theme?.gradient;
    if (!g) return null;
    return (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
                <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={g[0]} />
                    <Stop offset="1" stopColor={g[1]} />
                </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
    );
}
