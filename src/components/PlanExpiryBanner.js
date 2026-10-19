import { useContext, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeContext } from './ThemeContext';
import { fetchMyPlan } from '../redex/slices/plansSlice';

// Plan expire hone mein itne din bache to banner dikhao (Part2 §2.12).
export const PLAN_EXPIRY_WARN_DAYS = 7;

/**
 * In-app expiry reminder. plansSlice se data leta hai; agar `plans/me` abhi load
 * nahi hua to fetch kar leta hai — render ko kabhi block nahi karta (null return).
 * Plans screen par `showButton={false}` do (wahan Upgrade buttons pehle se hain).
 */
export default function PlanExpiryBanner({ showButton = true, style }) {
    const dispatch = useDispatch();
    const navigation = useNavigation();
    const { theme } = useContext(ThemeContext);
    const me = useSelector((s) => s.plans?.me);
    const meLoading = useSelector((s) => s.plans?.meLoading);

    useEffect(() => {
        if (!me && !meLoading) dispatch(fetchMyPlan());
        // sirf mount par — baar-baar fetch nahi
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const ent = me?.entitlements;
    if (!ent?.isActive || ent.daysRemaining == null || ent.daysRemaining > PLAN_EXPIRY_WARN_DAYS) return null;

    const isDark = theme?.mode === 'dark';
    const colors = {
        bg: isDark ? '#3a2e12' : '#fff6e0',
        border: isDark ? '#6b5416' : '#f5d98a',
        txt: isDark ? '#f5e3b3' : '#7a5a00',
        icon: isDark ? '#f1c40f' : '#e0a100',
        btn: theme?.header || '#1199ff',
    };

    return (
        <View style={[styles.wrap, { backgroundColor: colors.bg, borderColor: colors.border }, style]}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.icon} />
            <View style={{ flex: 1 }}>
                <Text style={[styles.text, { color: colors.txt }]}>Your subscription is expiring soon. Upgrade/Renew your plan.</Text>
                {showButton && (
                    <TouchableOpacity style={[styles.btn, { backgroundColor: colors.btn }]} onPress={() => navigation.navigate('Plans')} activeOpacity={0.8}>
                        <Text style={styles.btnText}>Upgrade Plan</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 14, borderWidth: 1, alignItems: 'flex-start' },
    text: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
    btn: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
    btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
