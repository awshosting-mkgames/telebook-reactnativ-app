import Constants from 'expo-constants';

// Server ko batata hai ki yeh plan-system wala NAYA build hai. Is header ke bina
// backend app ko purani APK maanta hai aur plans lagata hi nahi (sab khula) —
// isliye har backend request me jaana zaroori hai.
//
// Value = android versionCode (app.json). Padh na paye to bhi 1 bhejte hain:
// header ka hona hi "naya build" ka nishaan hai, number sirf minAppBuild se
// tulna ke liye hai.
const build = Number(Constants?.expoConfig?.android?.versionCode) || 1;

export const APP_BUILD = build;
export const APP_BUILD_HEADERS = { 'X-App-Build': String(build) };
