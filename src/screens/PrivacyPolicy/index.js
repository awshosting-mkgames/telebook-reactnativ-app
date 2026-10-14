import WebPageScreen from '../../components/WebPageScreen';

const PAGE_URL = 'https://telebookservices.com/privacy';

export default function PrivacyPolicyScreen({ navigation }) {
    return <WebPageScreen navigation={navigation} title="Privacy Policy" url={PAGE_URL} />;
}
