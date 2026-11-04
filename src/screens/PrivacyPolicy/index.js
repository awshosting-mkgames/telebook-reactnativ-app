import LegalPage from '../../components/LegalPage';

const PAGE_URL = 'https://telebookservices.com/privacy';

export default function PrivacyPolicyScreen({ navigation }) {
    // Server (system-config) ka content mile to wahi; warna yeh purana URL
    return <LegalPage navigation={navigation} kind="privacy" title="Privacy Policy" fallbackUrl={PAGE_URL} />;
}
