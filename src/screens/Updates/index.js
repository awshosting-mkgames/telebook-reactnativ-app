import { useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { ThemeContext } from '../../components/ThemeContext';
import RecommendedChannels from './RecommendedChannels';
import StatusSection from './StatusSection';

export default function Updates({ navigation }) {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);

    const maniAllData = useSelector((state) => state.totalappData);
    const MY_USER_ID = maniAllData?.userId ?? '';

    const [statusRefreshSignal, setStatusRefreshSignal] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    // StatusSection fetchStatuses() ko promise expose nahi karta — refreshSignal
    // bump karke fire-and-forget refetch trigger karte hain, spinner ko short
    // fixed delay ke baad hide karte hain (StatusSection ka focus-effect bhi
    // already alag se refetch karta hai, isliye yeh sirf visual cue hai).
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setStatusRefreshSignal((n) => n + 1);
        setTimeout(() => setRefreshing(false), 800);
    }, []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar backgroundColor="#1296f3" barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('Updates')}</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1296f3']} tintColor="#1296f3" />
                }
            >
                {/* Status Section (Status + Viewed Status) */}
                <StatusSection
                    navigation={navigation}
                    myUserId={MY_USER_ID}
                    refreshSignal={statusRefreshSignal}
                />

                {/* Sponsored + Popular channel recommendations */}
                <RecommendedChannels
                    navigation={navigation}
                    refreshSignal={statusRefreshSignal}
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        height: 90, backgroundColor: '#1296f3',
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    headerTitle: { color: '#fff', fontSize: 19, fontWeight: '600' },
});
