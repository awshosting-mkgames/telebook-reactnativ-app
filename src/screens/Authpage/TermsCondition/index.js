import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    SafeAreaView,StatusBar,Platform
} from 'react-native';
import Images from '../../../utils/images';
import { ThemeContext } from '../../../components/ThemeContext';

const TermsAndConditionsScreen = ({ navigation, renderSection }) => {

    const [selectedLanguage, setSelectedLanguage] = useState('en');
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <SafeAreaView  style={[styles.container,{ backgroundColor: theme.background}]}>
              <StatusBar backgroundColor="#1199ff" barStyle="light-content" />
            <TouchableOpacity style={styles.backBtn} onPress={() => renderSection(1)}>
                <Text style={[styles.backText,{ color: theme.text}]}>←</Text>
            </TouchableOpacity>
            <ScrollView contentContainerStyle={styles.content}>
                <Image
                    source={Images.Acceptterms} 
                    style={styles.image}
                    resizeMode="contain"
                />
                <Text style={[styles.title,{ color: theme.text}]}>Terms and conditions</Text>
                <Text style={[styles.text,{ color: theme.text}]}>
                    Welcome to Website Name!{'\n\n'}
                    These terms and conditions outline the rules and regulations for the
                    use of Company Name's Website, located at Website.com.{'\n\n'}
                    By accessing this website we assume you accept these terms and
                    conditions. Do not continue to use Website Name if you do not agree to
                    take all of the terms and conditions stated on this page.{'\n\n'}
                    The following terminology applies to these Terms and Conditions,
                    Privacy Statement and Disclaimer Notice and all Agreements: “Client”,
                    “You” and “Your” refers to you, the person log on this website and
                    compliant to the Company's terms and conditions.
                </Text>
            </ScrollView>
            <TouchableOpacity
                style={styles.button}
                onPress={() => {
                    renderSection(3);
                }}
            >
                <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default TermsAndConditionsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    backBtn: {
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    backText: {
        fontSize: 24,
    },
    content: {
        paddingHorizontal: 24,
        paddingBottom: 120,
    },
    image: {
        width: '100%',
        height: 220,
        marginBottom: 10,
        paddingTop: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '400',
        textAlign: 'center',
        marginBottom: 20,
        marginTop:15
    },
    text: {
        fontSize: 15,
        color: '#555',
        lineHeight: 20,
        textAlign: 'left',
        marginTop:50
    },
    button: {
        position: 'absolute',
        bottom: 54,
        left: 24,
        right: 24,
        height: 52,
        backgroundColor: '#1294F2',
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});