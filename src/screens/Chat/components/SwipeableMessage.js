import React, { useRef } from 'react';
import { View, Animated, PanResponder, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SWIPE_THRESHOLD = 60;
const SWIPE_MAX = 80;

const SwipeableMessage = ({ onReply, children }) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const replyScale = useRef(new Animated.Value(0)).current;
    const triggered  = useRef(false);

    const panResponder = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
            Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) && g.dx > 0,
        onPanResponderGrant: () => { triggered.current = false; },
        onPanResponderMove: (_, g) => {
            const x = Math.min(g.dx, SWIPE_MAX);
            if (x < 0) return;
            translateX.setValue(x);
            replyScale.setValue(Math.min(x / SWIPE_THRESHOLD, 1));
            if (x >= SWIPE_THRESHOLD && !triggered.current) {
                triggered.current = true;
                Animated.sequence([
                    Animated.spring(replyScale, { toValue: 1.35, friction: 3, useNativeDriver: true }),
                    Animated.spring(replyScale, { toValue: 1,    friction: 3, useNativeDriver: true }),
                ]).start();
            }
        },
        onPanResponderRelease: (_, g) => {
            if (g.dx >= SWIPE_THRESHOLD) onReply();
            Animated.parallel([
                Animated.spring(translateX, { toValue: 0, friction: 5, tension: 80, useNativeDriver: true }),
                Animated.spring(replyScale, { toValue: 0, friction: 5,             useNativeDriver: true }),
            ]).start();
            triggered.current = false;
        },
        onPanResponderTerminate: () => {
            Animated.parallel([
                Animated.spring(translateX, { toValue: 0, friction: 5, useNativeDriver: true }),
                Animated.spring(replyScale, { toValue: 0, friction: 5, useNativeDriver: true }),
            ]).start();
        },
    })).current;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Animated.View style={[styles.replyIcon, { transform: [{ scale: replyScale }], opacity: replyScale }]}>
                <Ionicons name="return-down-forward" size={18} color="#1296f3" />
            </Animated.View>
            <Animated.View style={{ flex: 1, transform: [{ translateX }] }} {...panResponder.panHandlers}>
                {children}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    replyIcon: {
        position: 'absolute', width: 34, height: 34, borderRadius: 17,
        backgroundColor: '#e3f2fd', alignItems: 'center', justifyContent: 'center',
        elevation: 2, shadowColor: '#1296f3', shadowOpacity: 0.2, shadowRadius: 4, zIndex: 0,
    },
});

export default SwipeableMessage;
