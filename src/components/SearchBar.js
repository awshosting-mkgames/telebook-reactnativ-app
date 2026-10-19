import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Shared search box (Freechat + Contact). Fixed height + fixed border width => focus par layout jump nahi.
// Colors theme se; theme.header ko accent ki tarah use karte hain.
export default function SearchBar({
    value,
    onChangeText,
    placeholder = 'Search',
    theme,
    style,
    inputProps,
    right = null,
}) {
    const [focused, setFocused] = useState(false);
    const isDark = theme?.mode === 'dark';
    const accent = theme?.header && !isDark ? theme.header : '#1199ff';

    const bg = isDark ? '#2a2a2a' : '#f2f2f2';
    const focusBg = isDark ? '#222222' : '#ffffff';

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: focused ? focusBg : bg,
                    borderColor: focused ? accent : (isDark ? '#3a3a3a' : 'transparent'),
                },
                style,
            ]}
        >
            <Ionicons name="search-outline" size={18} color={focused ? accent : (isDark ? '#888' : '#999')} />
            <TextInput
                style={[styles.input, { color: isDark ? '#e0e0e0' : '#000000' }]}
                placeholder={placeholder}
                placeholderTextColor={isDark ? '#777' : '#aaa'}
                value={value}
                onChangeText={onChangeText}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                {...inputProps}
            />
            {/* Clear button hamesha jagah gheraata hai (opacity) taki typing par text na hile */}
            <TouchableOpacity
                onPress={() => onChangeText?.('')}
                style={[styles.clearBtn, { opacity: value?.length ? 1 : 0 }]}
                disabled={!value?.length}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Ionicons name="close-circle" size={18} color={isDark ? '#888' : '#b5b5b5'} />
            </TouchableOpacity>
            {right}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 14,
        marginTop: 12,
        marginBottom: 2,
        paddingHorizontal: 12,
        borderRadius: 14,
        height: 44,
        borderWidth: 1.5,
        gap: 8,
    },
    input: { flex: 1, fontSize: 14, paddingVertical: 0 },
    clearBtn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
});
