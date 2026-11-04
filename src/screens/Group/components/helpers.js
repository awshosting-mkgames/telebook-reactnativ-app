import Config from '../../../services/config';
// Server files /media/<key> par chalti hain (Chat / Profile jaisa) — pehle Main_url lagta tha, isliye Group Info me
// group icon, members ki photo aur media thumbnails load nahi hote the.
export const BASE_URL = Config.MEDIA_URL;

export const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return BASE_URL + path;
};

export const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
};
