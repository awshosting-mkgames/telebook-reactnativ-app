import axiosInstance from './axiosInstance';
import { getData } from './staticStorage';
import { multipartHeaders } from '../utils/uploadFile';

const apiService = async ({
    method = 'GET',
    endpoint = '',
    data = null,
    params = null,
    isMultipart = false,
    navigation = null,
    onUploadProgress = null,
    timeout = null,
}) => {
    try {
        const token = await getData('token');
       
       const headers = {
            Accept: 'application/json',
            'Accept-Encoding': 'identity',
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        // Content-Type sirf NON-GET aur NON-DELETE methods ke liye.
        // Multipart par web ko khud boundary set karne dena hota hai, isliye
        // multipartHeaders platform ke hisaab se aata hai (web par khaali).
        // DELETE with body (jaise messageIds) ko bhi JSON header chahiye.
        if (method !== 'GET' && (method !== 'DELETE' || data)) {
            if (isMultipart) {
                Object.assign(headers, multipartHeaders);
            } else {
                headers['Content-Type'] = 'application/json';
            }
        }
       
        console.log("token___________",token)
        const response = await axiosInstance({
            method,
            url: endpoint,
            data: method === 'GET' ? undefined : data,
            params,
            headers,
            // Multipart uploads (photos/videos) ko default 30s se zyada chahiye
            // ho sakta hai dheeli network par — explicit timeout isko override karta hai.
            timeout: timeout ?? (isMultipart ? 120000 : undefined),
            ...(onUploadProgress ? { onUploadProgress } : {}),
        });

        return { success: true, data: response.data };
    } catch (error) {
          console.log('error responce',error);
        if (error.response) {
            const status = error.response.status;
            return { success: false, error: error.response.data };
        }
        return { success: false, error: error.message || 'Something went wrong' };
    }
};

export default apiService;