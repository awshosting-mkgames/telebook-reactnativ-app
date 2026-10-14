import WebPageScreen from '../../components/WebPageScreen';

const PAGE_URL = 'https://telebookservices.com/terms';

export default function TermsConditionsScreen({ navigation }) {
    return <WebPageScreen navigation={navigation} title="Terms & Conditions" url={PAGE_URL} />;
}
