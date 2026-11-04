import { useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useHeaderMetrics } from '../../utils/headerMetrics';
import { ThemeContext } from '../../components/ThemeContext';
import RecommendedChannels from './RecommendedChannels';
import StatusSection from './StatusSection';
import GradientFill from '../../components/GradientFill';

export default function Updates({ navigation }) {
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    const { top, height } = useHeaderMetrics(); // status bar + 60 header

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
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

            {/* Header */}
            <View style={[styles.header, { height, paddingTop: top, paddingBottom: 0, backgroundColor: theme.header || '#1199ff' }]}>
                <GradientFill />
                <Text style={[styles.headerTitle, { color: theme.headerText || '#fff' }]}>{t('Updates')}</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.main]} tintColor={theme.main} />
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        backgroundColor: '#1296f3', overflow: 'hidden',
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16,
    },
    headerTitle: { color: '#fff', fontSize: 19, fontWeight: '600' },
});
