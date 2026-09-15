import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Save any data to AsyncStorage with a key
 * @param key - The key to store the data under
 * @param value - The value to store (will be stringified if not a string)
 * @returns Promise that resolves when the data is saved
 */
export const saveData = async <T>(key: string, value: T): Promise<void> => {
    try {
   
        const jsonValue = JSON.stringify(value);
        await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
        console.error(`Error saving data for key ${key}:`, error);
        throw error;
    }
};

/**
 * Get data from AsyncStorage by key
 * @param key - The key to retrieve the data for
 * @returns Promise that resolves with the data (parsed if JSON) or null if not found
 */
export const getData = async <T>(key: string): Promise<T | null> => {
    try {
        const jsonValue = await AsyncStorage.getItem(key);
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
        console.error(`Error getting data for key ${key}:`, error);
        throw error;
    }
};

/**
 * Remove data from AsyncStorage by key
 * @param key - The key to remove
 * @returns Promise that resolves when the data is removed
 */
export const removeData = async (key: string): Promise<void> => {
    try {
        await AsyncStorage.removeItem(key);
    } catch (error) {
        console.error(`Error removing data for key ${key}:`, error);
        throw error;
    }
};

/**
 * Clear all data from AsyncStorage
 * @returns Promise that resolves when all data is cleared
 */
export const clearAllData = async (): Promise<void> => {
    try {
        await AsyncStorage.clear();
    } catch (error) {
        console.error('Error clearing all data:', error);
        throw error;
    }
};

/**
 * Get all keys from AsyncStorage
 * @returns Promise that resolves with an array of all keys
 */
export const getAllKeys = async (): Promise<readonly string[]> => {
    try {
        return await AsyncStorage.getAllKeys();
    } catch (error) {
        console.error('Error getting all keys:', error);
        throw error;
    }
};

/**
 * Check if a key exists in AsyncStorage
 * @param key - The key to check
 * @returns Promise that resolves with true if the key exists, false otherwise
 */
export const keyExists = async (key: string): Promise<boolean> => {
    try {
        const keys = await AsyncStorage.getAllKeys();
        return keys.includes(key);
    } catch (error) {
        console.error(`Error checking if key ${key} exists:`, error);
        throw error;
    }
}; 