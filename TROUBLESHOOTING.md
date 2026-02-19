# Troubleshooting Guide

## Error: "The required package `expo-asset` cannot be found"

This error occurs when some Expo dependencies are missing after installation.

### Quick Fix:

**Step 1:** Delete the existing node_modules and package-lock.json
```bash
rm -rf node_modules
rm package-lock.json
```

**Step 2:** Install dependencies again
```bash
npm install
```

**Step 3:** If the error persists, manually install the missing packages
```bash
npm install expo-asset expo-constants expo-file-system expo-font expo-splash-screen
```

**Step 4:** Start the project
```bash
npx expo start
```

### Alternative Solution:

If you're still having issues, try using Yarn instead of npm:

```bash
# Install Yarn (if not already installed)
npm install -g yarn

# Remove node_modules
rm -rf node_modules

# Install with Yarn
yarn install

# Start the project
yarn start
```

## Other Common Issues

### Issue: Metro bundler won't start
**Solution:**
```bash
npx expo start --clear
```

### Issue: "Unable to resolve module"
**Solution:**
```bash
watchman watch-del-all
rm -rf node_modules
npm install
npx expo start --clear
```

### Issue: iOS Simulator not opening
**Solution:**
Make sure Xcode is installed, then:
```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

### Issue: Android build fails
**Solution:**
1. Open Android Studio
2. Go to SDK Manager
3. Install Android SDK Platform 33 or higher
4. Set ANDROID_HOME environment variable

### Issue: Port already in use
**Solution:**
```bash
lsof -ti:8081 | xargs kill -9
npx expo start
```

## Verification Steps

After fixing issues, verify everything works:

1. **Check dependencies:**
   ```bash
   npm list expo expo-asset expo-constants
   ```

2. **Clear all caches:**
   ```bash
   npx expo start --clear
   ```

3. **Restart development server:**
   ```bash
   npx expo start
   ```

## Still Having Issues?

1. Make sure you're using Node.js v14 or higher:
   ```bash
   node --version
   ```

2. Update npm to the latest version:
   ```bash
   npm install -g npm@latest
   ```

3. Check Expo CLI version:
   ```bash
   npx expo --version
   ```

4. Try creating a fresh Expo project and compare package versions:
   ```bash
   npx create-expo-app test-project
   ```

## Contact & Support

If none of these solutions work:
- Check the Expo documentation: https://docs.expo.dev/
- Visit Expo forums: https://forums.expo.dev/
- Check React Native issues: https://github.com/facebook/react-native/issues

## Package Versions Reference

This project uses:
- Expo SDK: ~52.0.0
- React Native: 0.76.5
- React: 18.3.1
- React Navigation: ^6.1.9

Make sure all packages are compatible with these versions.
