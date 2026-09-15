import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// VS Code jaisa "X of Y" + up/down navigation bar.
// current = 0-based index, total = total matches
const SearchNavBar = ({ isSearching, current, total, onPrev, onNext, theme }) => {
    const isDark = theme?.text === '#FFFFFF';
    const barBg = isDark ? '#1f2c34' : '#ffffff';
    const txtC = isDark ? '#e9edef' : '#222222';
    const subC = isDark ? '#8696a0' : '#777777';
    const iconC = isDark ? '#e9edef' : '#1296f3';
    const disC = isDark ? '#3a4a52' : '#c4c4c4';
    const borderC = isDark ? '#2a3942' : '#eeeeee';

    const has = total > 0;
    const label = isSearching && !has
        ? 'Searching...'
        : has
            ? `${current + 1} of ${total}`
            : 'No results';

    return (
        <View style={[styles.bar, { backgroundColor: barBg, borderBottomColor: borderC }]}>
            <Text style={[styles.count, { color: has ? txtC : subC }]}>{label}</Text>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.btn}
                    onPress={onPrev}
                    disabled={!has}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="chevron-up" size={22} color={has ? iconC : disC} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.btn}
                    onPress={onNext}
                    disabled={!has}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="chevron-down" size={22} color={has ? iconC : disC} />
                </TouchableOpacity>

                {isSearching && has && (
                    <ActivityIndicator size="small" color={iconC} style={{ marginLeft: 6 }} />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 0.5,
    },
    count: { fontSize: 14, fontWeight: '600' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    btn: { padding: 6 },
});

export default SearchNavBar;