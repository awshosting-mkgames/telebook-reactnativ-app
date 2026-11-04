import LegalPage from '../../components/LegalPage';

const PAGE_URL = 'https://telebookservices.com/terms';

export default function TermsConditionsScreen({ navigation }) {
    // Server (system-config) ka content mile to wahi; warna yeh purana URL
    return <LegalPage navigation={navigation} kind="terms" title="Terms & Conditions" fallbackUrl={PAGE_URL} />;
}
