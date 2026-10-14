import React, { useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeContext } from '../../components/ThemeContext';
import LoginScreen from './Login';
import OtpScreen from './Otp';
import WellcomeScreen from './Wellcomescreen';
import TermsCondition from './TermsCondition';
import Signup from './Signup';
import { navigate } from '../../navigation/RootNavigation';



export default function AuthPage() {
    const { theme } = useContext(ThemeContext);
    const [pageSection, setPageSection] = useState(1);
    const [logindataPage, setlogindataPage] = useState(1);
    const [oTpdataPage, setOtpdataPage] = useState(1);

    const renderSection = (tab) => {
        if (tab === 6) {
            navigate('main');
        } else {
            setPageSection(tab);
        }
    }
    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {pageSection === 3 && <LoginScreen setPageSection={setPageSection} renderSection={renderSection} setlogindataPage={setlogindataPage} />}
            {pageSection === 4 && <OtpScreen setPageSection={setPageSection} renderSection={renderSection} logindataPage={logindataPage} setlogindataPage={setlogindataPage} setOtpdataPage={setOtpdataPage} />}
            {pageSection === 5 && <Signup setPageSection={setPageSection} renderSection={renderSection} oTpdataPage={oTpdataPage} />}
            {pageSection === 1 && <WellcomeScreen setPageSection={setPageSection} renderSection={renderSection} />}
            {pageSection === 2 && <TermsCondition setPageSection={setPageSection} renderSection={renderSection} />}
        </View>
    );
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
    },

});
