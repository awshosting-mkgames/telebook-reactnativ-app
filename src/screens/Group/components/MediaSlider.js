import React, { useState, useRef, useEffect } from 'react';
import {
    Modal, View, Text, Image, TouchableOpacity,
    FlatList, StyleSheet, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');

const MediaSlider = ({ visible, items, startIndex, onClose, getUrl }) => {
    const [current, setCurrent] = useState(startIndex ?? 0);
    const flatRef = useRef();

    useEffect(() => {
        if (visible && flatRef.current && items?.length) {
            setTimeout(() => {
                flatRef.current?.scrollToIndex({ index: startIndex ?? 0, animated: false });
            }, 100);
        }
        setCurrent(startIndex ?? 0);
    }, [visible, startIndex]);

    if (!items?.length) return null;

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                    <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.counter}>{current + 1} / {items.length}</Text>

                <FlatList
                    ref={flatRef}
                    data={items}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item, i) => item._id || i.toString()}
                    onMomentumScrollEnd={(e) => {
                        const idx = Math.round(e.nativeEvent.contentOffset.x / W);
                        setCurrent(idx);
                    }}
                    getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
                    renderItem={({ item }) => (
                        <View style={styles.slide}>
                            <Image
                                source={{ uri: getUrl(item.attachments?.[0]?.url) }}
                                style={styles.img}
                                resizeMode="contain"
                            />
                        </View>
                    )}
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    closeBtn:  {
        position: 'absolute',
        top:   Platform.OS === 'ios' ? 56 : 36,
        right: 16,
        zIndex: 20,
        padding: 6,
    },
    counter: {
        position: 'absolute',
        top:  Platform.OS === 'ios' ? 60 : 40,
        alignSelf: 'center',
        color: '#fff', fontSize: 15, fontWeight: '600',
        zIndex: 20,
    },
    slide: { width: W, height: H, justifyContent: 'center', alignItems: 'center' },
    img:   { width: W, height: H * 0.85 },
});

export default MediaSlider;
