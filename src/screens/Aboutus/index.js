import WebPageScreen from '../../components/WebPageScreen';

const PAGE_URL = 'https://telebookservices.com/about';

export default function Aboutus({ navigation }) {
    return <WebPageScreen navigation={navigation} title="About us" url={PAGE_URL} />;
}
