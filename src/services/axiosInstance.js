import axios from 'axios';
import Config from './config';
import { APP_BUILD_HEADERS } from './appBuild';


const axiosInstance = axios.create({
    baseURL: Config.BASE_URL,
    timeout: 30000,
    // Har request me X-App-Build — dekhein appBuild.js
    headers: { ...APP_BUILD_HEADERS },
});

// Loop guard: logoutUser khud `auth/logout` call karta hai jo dobara 401
// DEVICE_LOGGED_OUT de sakta hai — flag se cleanup sirf ek baar chalta hai.
let deviceLogoutInProgress = false;
function handleDeviceLoggedOut() {
    if (deviceLogoutInProgress) return;
    deviceLogoutInProgress = true;
    try {
        // Lazy require: Logoutcall -> apiService -> axiosInstance ka circular import avoid karne ke liye.
        const { logoutUser } = require('./Logoutcall');
        const { store } = require('../redex/store');
        // isLogin=false hote hi root navigator khud auth stack dikha deta hai.
        Promise.resolve(logoutUser(null, store.dispatch))
            .catch((e) => console.log('DEVICE_LOGGED_OUT cleanup error:', e))
            .finally(() => setTimeout(() => { deviceLogoutInProgress = false; }, 5000));
    } catch (e) {
        console.log('DEVICE_LOGGED_OUT handler error:', e);
        deviceLogoutInProgress = false;
    }
}

axiosInstance.interceptors.request.use(
    config => {
        config.metadata = { startTime: new Date() };
        return config;
    },
    error => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    response => {
        const duration = new Date() - response.config.metadata.startTime;
        if (duration > 5000) {
            console.warn(`⚠️ SLOW API: ${response.config.url} - ${duration}ms`);
        }
        return response;
    },
    async error => {
        const config = error.config || {};
        const duration = config.metadata ? new Date() - config.metadata.startTime : 0;
        try {
            if (error.response) {
                const status = error.response.status;
                console.log("error______status________",status)
                // Dusre device se logout (Linked Devices) ho chuka token: 401 DEVICE_LOGGED_OUT
                if (status === 401 && error.response.data?.code === 'DEVICE_LOGGED_OUT') {
                    handleDeviceLoggedOut();
                }
            } else if (error.request) {
                console.log("error______error.request________",error.request)
            }
        } catch (crashError) {
            console.log("error______error.request________",crashError)
            console.log('Crashlytics logging failed:', crashError);
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;