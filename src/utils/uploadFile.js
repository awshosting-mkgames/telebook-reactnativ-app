// Native (Android / iOS) multipart upload helpers.
//
// React Native's FormData understands the `{ uri, name, type }` shape and the native networking
// layer streams the file off disk. See uploadFile.web.js for the browser equivalent.
import { Platform } from 'react-native';

/**
 * Appends a picked file (an expo-image-picker / expo-document-picker asset, or any
 * `{ uri, name, type }`) to a FormData under `field`.
 */
export const appendFile = async (formData, field, asset) => {
    const uri = asset?.uri ?? '';
    const name = asset?.name || asset?.fileName || `upload_${Date.now()}`;
    const type = asset?.type?.includes('/') ? asset.type : asset?.mimeType || 'application/octet-stream';

    formData.append(field, {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name,
        type,
    });
};

/**
 * Content-Type for a multipart request. React Native's networking layer rewrites this with the
 * generated boundary, so setting it by hand is safe here — on web it is not (see uploadFile.web.js).
 */
export const multipartHeaders = { 'Content-Type': 'multipart/form-data' };
