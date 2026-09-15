// Web media saving. Metro picks this file over mediaSave.js for the web bundle, which keeps
// `expo-media-library` (and its missing ExpoMediaLibraryNext native module) out of web entirely.
// There is no photo gallery in a browser, so "saving" means handing the file to the browser.

/**
 * Downloads a remote file through the browser. Returns true once handled so callers can skip
 * the native FileSystem / MediaLibrary flow.
 */
export const saveRemoteFileToDevice = async (uri, fileName) => {
    const name = fileName || uri.split('/').pop().split('?')[0] || `download_${Date.now()}`;
    let objectUrl;
    try {
        // Fetch first so the download works for cross-origin URLs, where the `download`
        // attribute is ignored and the browser would navigate away instead.
        const response = await fetch(uri);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        objectUrl = URL.createObjectURL(await response.blob());
    } catch {
        objectUrl = undefined;
    }

    const link = document.createElement('a');
    link.href = objectUrl || uri;
    link.download = name;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    return true;
};

export const requestLibraryPermission = async () => false;

export const saveToLibrary = async () => {
    throw new Error('Saving to the media library is not supported on web');
};
