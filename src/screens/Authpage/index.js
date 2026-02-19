import React, { useState } from 'react';
import { SafeAreaView,StyleSheet } from 'react-native';
import LoginScreen from './Login';
import OtpScreen from './Otp';
import WellcomeScreen from './Wellcomescreen';
import TermsCondition from './TermsCondition';
import Signup from './Signup';
import { navigate, goBack  } from '../../navigation/RootNavigation';

export default function AuthPage() {
    const [pageSection, setPageSection] = useState(1);

    const renderSection = (tab) => {
        if(tab === 6){
            navigate('main');
        }else{
            setPageSection(tab);
        }
        
    }

    return (
        <SafeAreaView style={styles.container}>
            {pageSection === 3 && <LoginScreen setPageSection={setPageSection} renderSection={renderSection} />}
            {pageSection === 4 && <OtpScreen setPageSection={setPageSection} renderSection={renderSection} />}
            {pageSection === 5 && <Signup setPageSection={setPageSection} renderSection={renderSection} />}
            {pageSection === 1 && <WellcomeScreen setPageSection={setPageSection} renderSection={renderSection} />}
            {pageSection === 2 && <TermsCondition setPageSection={setPageSection} renderSection={renderSection} />}
        </SafeAreaView>
    );
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#fff',
    },
    
});
