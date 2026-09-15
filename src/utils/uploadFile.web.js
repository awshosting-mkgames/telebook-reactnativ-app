// Web multipart upload helpers. Metro picks this file over uploadFile.js for the web bundle.
//
// The browser's FormData has no idea what a `{ uri, name, type }` object is — it stringifies it to
// "[object Object]" and the file silently never arrives. It needs a real Blob/File instead.

/**
 * Appends a picked file (an expo-image-picker / expo-document-picker asset, or any
 * `{ uri, name, type }`) to a FormData under `field`.
 */
export const appendFile = async (formData, field, asset) => {
    const name = asset?.name || asset?.fileName || asset?.file?.name || `upload_${Date.now()}`;

    // Both web pickers hand back the original File; fall back to re-reading the
    // blob:/data: uri for values that were stored as a bare uri string.
    let blob = asset?.file;
    if (!(blob instanceof Blob)) {
        const response = await fetch(asset?.uri);
        if (!response.ok) throw new Error(`Could not read the selected file (HTTP ${response.status})`);
        blob = await response.blob();
    }

    const type = (asset?.type?.includes('/') && asset.type) || asset?.mimeType || blob.type || 'application/octet-stream';
    formData.append(field, new File([blob], name, { type }), name);
};

/**
 * Empty on purpose: only the browser can generate the multipart boundary, and it does so only when
 * Content-Type is left unset. Setting "multipart/form-data" by hand produces a boundary-less header
 * that the server cannot parse.
 */
export const multipartHeaders = {};
