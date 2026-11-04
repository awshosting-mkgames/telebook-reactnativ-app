import LegalPage from '../../components/LegalPage';

const PAGE_URL = 'https://telebookservices.com/about';

export default function Aboutus({ navigation }) {
    // Server (system-config) ka content mile to wahi; warna yeh purana URL
    return <LegalPage navigation={navigation} kind="about" title="About us" fallbackUrl={PAGE_URL} />;
}
