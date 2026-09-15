import axios from 'axios';
import Config from './config';


const axiosInstance = axios.create({
    baseURL: Config.BASE_URL,
    timeout: 30000,
});

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