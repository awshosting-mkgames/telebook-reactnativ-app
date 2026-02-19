import React, { useState, useContext } from 'react';
import {
View,
Text,
StyleSheet,
TouchableOpacity,
SafeAreaView,
StatusBar,Platform,Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Images from '../../../utils/images';
import { ThemeContext } from '../../../components/ThemeContext';

const Wellcomescreen = ({ setPageSection, renderSection }) => {
const [selectedLanguage, setSelectedLanguage] = useState('en');
const { theme, toggleTheme } = useContext(ThemeContext);

return (
    <SafeAreaView style={[styles.container,{ backgroundColor: theme.background}]}>
            <StatusBar backgroundColor={theme.statusbar} barStyle={theme?.statusbar}/>
            <View style={styles.illustrationSection}>
                <Image source={Images.WellcomeBannerPage} style={{width: '100%', height: '100%', resizeMode: 'contain'}} />
            </View>
            <Text style={styles.title}>Select Language</Text>
            <View style={[styles.languageContainer,{ backgroundColor: theme.background}]}>
                <TouchableOpacity style={[styles.languageCard,{ backgroundColor: theme.background}, selectedLanguage === 'hi' && styles.selectedCard]}  onPress={() => {toggleTheme();setSelectedLanguage('hi')}} activeOpacity={0.7} >
                    <View style={styles.languageContent}>
                        <View style={styles.flagCircle}>
                            <Text style={styles.flag}>🇮🇳</Text>
                        </View>
                        <Text style={[styles.languageName,{ color: theme.text}, selectedLanguage === 'hi' && styles.selectedText]} >Hindi</Text>
                    </View>
                    {
                        selectedLanguage === 'hi' && <Ionicons name="checkmark" size={28} color="#00A8FF" />
                    }
                </TouchableOpacity>
                <TouchableOpacity  style={[styles.languageCard,{ backgroundColor: theme.background}, selectedLanguage === 'en' && styles.selectedCard]} onPress={() =>{toggleTheme();setSelectedLanguage('en')} } activeOpacity={0.7}>
                    <View style={styles.languageContent}>
                        <View style={styles.flagCircle}>
                            <Text style={styles.flag}>🇺🇸</Text>
                        </View>
                        <Text  style={[styles.languageName,{ color: theme.text}, selectedLanguage === 'en' && styles.selectedText]} >
                            English (US)
                        </Text>
                    </View>
                    {
                        selectedLanguage === 'en' && <Ionicons name="checkmark" size={28} color="#00A8FF" />
                    }
                </TouchableOpacity>
            </View>

            {/* Continue Button */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity onPress={()=>renderSection(2)} style={styles.continueButton} activeOpacity={0.8}>
                    <Text style={styles.continueText}>Continue</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
       
        paddingHorizontal: 10,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },

    // Illustration Section
    illustrationSection: {
        height: 250,
        marginTop: 80,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },

   
   

    // Title
    title: {
        fontSize: 15,
        fontWeight: '400',
        color: '#2C2C2C',
        textAlign: 'center',

    },

    // Language Container
    languageContainer: {
        gap: 12,
        paddingHorizontal: 15,
        marginTop: 20,
        backgroundColor: '#ffffff',
    },
    languageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingVertical: 10,
        paddingHorizontal: 10,
        backgroundColor: '#ffffff',
        borderRadius: 50,
        borderWidth: 2,
        borderColor: '#E8E8E8',
    },
    selectedCard: {
        borderColor: '#00A8FF',
       
    },
    languageContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    flagCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    flag: {
        fontSize: 30,
    },
    languageName: {
        fontSize: 18,
        fontWeight: '500',
        color: '#2C2C2C',
    },
    selectedText: {
        color: '#00A8FF',
        fontWeight: '600',
    },

    // Continue Button
    buttonContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: 50,
        paddingHorizontal: 15,
    },
    continueButton: {
        backgroundColor: '#00A8FF',
        paddingVertical: 18,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#00A8FF',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    continueText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
});
export default Wellcomescreen;