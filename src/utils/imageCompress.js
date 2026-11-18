import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

// Upload se pehle image ka size gharana — BACKGROUND me (koi UI/loader nahi; bubble original dikhata rehta hai).
//
//   size ≤ 300 KB          → koi badlav nahi
//   300 KB – 1 MB          → aadha (1/2)
//   1 MB – 2 MB            → chauthai (1/4), par kabhi 500 KB se upar nahi
//   > 2 MB                 → 500 KB
//
// Quality bachane ke liye pehle resolution thoda ghatate hain, quality (0.8) ~ahi rehti; target se bahut neeche gir jaye
// to resolution wapas badha kar dobara try (zyada se zyada 5 koshish). Fail ho to original hi upload hota hai — send kabhi nahi rukta.
const KB = 1024;
const MIN_WIDTH = 720;          // isse chhota karne par saaf nazar aane wali quality girti hai
const BASE_QUALITY = 0.8;
const MAX_TRIES = 5;

export const targetBytesFor = (size) => {
    if (!size || size <= 300 * KB) return null;
    if (size > 2048 * KB) return 500 * KB;
    if (size > 1024 * KB) return Math.min(500 * KB, Math.round(size / 4));
    return Math.round(size / 2);
};

const sizeOf = async (uri) => {
    try { const i = await FileSystem.getInfoAsync(uri); return i?.exists ? i.size || 0 : 0; } catch (e) { return 0; }
};
const dimsOf = (uri) => new Promise((resolve) => Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve(null)));

/**
 * @returns {Promise<{ uri, mimeType, fileName, size, changed }>}  hamesha ek valid jawab (fail par changed:false + original)
 */
export const compressImageForUpload = async (uri, mimeType = 'image/jpeg', fileName = '') => {
    const original = { uri, mimeType, fileName, size: 0, changed: false };
    try {
        if (!uri || /gif/i.test(mimeType) || /\.gif$/i.test(uri)) return original;   // gif ko chheda nahi (animation)
        const size = await sizeOf(uri);
        original.size = size;
        const target = targetBytesFor(size);
        if (!target) return original;

        const dims = await dimsOf(uri);
        if (!dims?.width) return original;
        const isPng = /png/i.test(mimeType) || /\.png$/i.test(uri);

        // Pehla andaza: bytes ≈ pixels, aur 0.8 quality par re-encode khud bhi chhota karta hai
        let width = Math.round(dims.width * Math.min(1, Math.max(MIN_WIDTH / dims.width, Math.sqrt(target / size) * 1.5)));
        let quality = BASE_QUALITY;
        let best = null;   // target ke andar sabse bada (= sabse achhi quality)
        let smallest = null;

        for (let i = 0; i < MAX_TRIES; i += 1) {
            width = Math.min(dims.width, Math.max(Math.min(MIN_WIDTH, dims.width), width));
            const res = await ImageManipulator.manipulateAsync(
                uri,
                width < dims.width ? [{ resize: { width } }] : [],
                { compress: quality, format: isPng ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG },
            );
            const out = await sizeOf(res.uri);
            if (!out) break;
            const cand = { uri: res.uri, size: out, width };
            if (!smallest || out < smallest.size) smallest = cand;
            if (out <= target && (!best || out > best.size)) best = cand;

            if (out > target) {                                   // abhi bhi bada: resolution ghatao (phir quality thodi)
                if (width <= MIN_WIDTH) quality = Math.max(0.6, quality - 0.1);
                width = Math.round(width * Math.max(0.5, Math.sqrt(target / out) * 0.95));
            } else if (out < target * 0.7 && width < dims.width) {  // zarurat se zyada ghata diya: quality bachao, resolution badhao
                width = Math.min(dims.width, Math.round(width * Math.min(1.5, Math.sqrt(target / out) * 0.95)));
                if (best && best.size >= target * 0.7) break;
            } else break;                                          // target ke paas — theek hai
        }

        const pick = best || smallest;
        if (!pick || pick.size >= size) return original;           // bada ho gaya ya fail — original
        const base = (fileName || uri.split('/').pop() || 'image').replace(/\.[^.]+$/, '');
        return {
            uri: pick.uri,
            mimeType: isPng ? 'image/png' : 'image/jpeg',
            fileName: `${base}.${isPng ? 'png' : 'jpg'}`,
            size: pick.size,
            changed: true,
        };
    } catch (e) {
        console.log('compressImageForUpload failed:', e?.message);
        return original;
    }
};
