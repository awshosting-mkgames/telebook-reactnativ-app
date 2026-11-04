import React, { useContext, useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ThemeContext } from './ThemeContext';

// theme.gradient ho to parent ko left -> right gradient se bhar deta hai (parent ka
// backgroundColor fallback rehta hai). Gradient na ho to kuch render nahi karta.
// react-native-svg pehle se installed hai, isliye native rebuild nahi chahiye.
// Size onLayout se pixel me liya jata hai — "100%" par SVG kabhi parent se chhota (half) draw ho raha tha.
export default function GradientFill({ colors }) {
    const { theme } = useContext(ThemeContext);
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const [size, setSize] = useState({ w: 0, h: 0 });
    const g = colors || theme?.gradient;
    if (!g) return null;
    return (
        <View
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setSize((p) => (p.w === width && p.h === height ? p : { w: width, h: height }));
            }}
        >
            {size.w > 0 && size.h > 0 && (
                <Svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
                    <Defs>
                        <LinearGradient id={id} x1="0" y1="0" x2={size.w} y2="0" gradientUnits="userSpaceOnUse">
                            <Stop offset="0" stopColor={g[0]} />
                            <Stop offset="1" stopColor={g[1]} />
                        </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${id})`} />
                </Svg>
            )}
        </View>
    );
}
