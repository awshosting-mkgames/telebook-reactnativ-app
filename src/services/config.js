//local server url
//const Main_url ='http://192.168.1.126:4000/'; 
//npx expo start --dev-client
//npx expo run:android

// Main production url
const Main_url = 'https://api.telebookservices.com/'
const CHAT_URL = Main_url;
const BASE_URL = Main_url + 'api/';
const MEDIA_URL = Main_url + 'media/';// Change this to your API root

// App ID public hai, client mein rakhna safe hai — isse koi token nahi bana
// sakta. Har call ke response mein server `agora.appId` yahi bhejta hai
// (callService ussi ko use karta hai); yeh constant sirf reference/fallback
// ke liye hai. Agora ka Primary/App CERTIFICATE isme KABHI nahi daalna —
// woh ek secret hai jo sirf backend ke env var AGORA_APP_CERTIFICATE mein
// rehna chahiye (token generate karne ke liye), app bundle mein nahi.
const AGORA_APP_ID = 'd98092d435584600b6d707d361889f3d';

export default { Main_url, BASE_URL, MEDIA_URL, CHAT_URL, AGORA_APP_ID };