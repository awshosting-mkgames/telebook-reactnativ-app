// Native (Android / iOS) media saving.
//
// The default `expo-media-library` entry point is the new class-based API: it calls
// requireNativeModule('ExpoMediaLibraryNext') at import time (which has no web build, so the
// import itself crashes on web) and its `saveToLibraryAsync` / `requestPermissionsAsync`
// re-exports are deprecated stubs that throw. The working legacy functions live in
// `expo-media-library/legacy`, so we use those here. See mediaSave.web.js for the web build.
import * as MediaLibrary from 'expo-media-library/legacy';

/**
 * Web-only hook: triggers a browser download for a remote file.
 * Always false on native so callers fall through to their FileSystem / MediaLibrary flow.
 */
export const saveRemoteFileToDevice = async () => false;

export const requestLibraryPermission = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
};

export const saveToLibrary = async (localUri) => MediaLibrary.saveToLibraryAsync(localUri);
