//local server url
//const Main_url ='http://192.168.1.126:4000/'; 
//npx expo start --dev-client
//npx expo run:android

// Main production url
const Main_url = 'https://api.telebookservices.com/'
const CHAT_URL = Main_url;
const BASE_URL = Main_url + 'api/';
const MEDIA_URL = Main_url + 'media/';// Change this to your API root

export default { Main_url, BASE_URL, MEDIA_URL, CHAT_URL };