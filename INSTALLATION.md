# Installation Guide

## Prerequisites

Before you begin, ensure you have the following installed on your system:

1. **Node.js** (v14 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **npm** (comes with Node.js)
   - Verify installation: `npm --version`

3. **Expo CLI** (will be installed automatically)

4. **Expo Go App** (for testing on physical device)
   - iOS: Download from App Store
   - Android: Download from Google Play Store

## Installation Steps

### Step 1: Extract the Project
```bash
unzip whatsapp-ui.zip
cd whatsapp-ui
```

### Step 2: Install Dependencies
```bash
npm install
```

This will install all required packages including:
- expo
- react-native
- react-navigation
- vector-icons
- and all other dependencies

### Step 3: Start the Development Server
```bash
npx expo start
```

Or use:
```bash
npm start
```

### Step 4: Run the App

You will see a QR code in the terminal. You have several options:

#### Option A: Run on Physical Device
1. Install Expo Go app on your phone
2. Scan the QR code with:
   - **iOS**: Use the Camera app
   - **Android**: Use the Expo Go app
3. The app will load on your device

#### Option B: Run on Android Emulator
1. Make sure Android Studio is installed with an emulator
2. Press `a` in the terminal
3. The app will launch in the emulator

#### Option C: Run on iOS Simulator (Mac only)
1. Make sure Xcode is installed
2. Press `i` in the terminal
3. The app will launch in the simulator

#### Option D: Run in Web Browser
1. Press `w` in the terminal
2. The app will open in your default browser

## Troubleshooting

### Issue: "Cannot find module" error
**Solution**: 
```bash
rm -rf node_modules
npm install
```

### Issue: Metro bundler cache issues
**Solution**:
```bash
npx expo start --clear
```

### Issue: Port already in use
**Solution**:
```bash
npx expo start --port 8081
```

### Issue: iOS Simulator not opening
**Solution**: Make sure Xcode is installed and try:
```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

### Issue: Android Emulator not detected
**Solution**: 
1. Open Android Studio
2. Start an emulator from AVD Manager
3. Then run `npx expo start` again

## Development Tips

### Hot Reloading
- The app automatically reloads when you save changes
- Shake your device to open the developer menu
- In emulator: Cmd+D (iOS) or Cmd+M (Android)

### Debug Mode
- Open developer menu
- Enable "Debug Remote JS"
- Open Chrome DevTools at: http://localhost:8081/debugger-ui

### Viewing Console Logs
- Terminal will show console.log outputs
- Or use React Native Debugger for better debugging experience

## Building for Production

### Android APK
```bash
expo build:android
```

### iOS IPA
```bash
expo build:ios
```

Note: You'll need an Expo account for building. Sign up at https://expo.dev

## Project Structure Overview

```
whatsapp-ui/
├── App.js                      # Main entry point
├── app.json                    # Expo configuration
├── package.json                # Dependencies
├── babel.config.js             # Babel configuration
├── src/
│   ├── screens/               # All screen components
│   ├── navigation/            # Navigation setup
│   └── data/                  # Mock data
└── assets/                    # Images and icons
```

## Next Steps

After successful installation:

1. Explore the onboarding flow (swipe through 3 screens)
2. Navigate through all tabs: Chats, Updates, Communities, Calls, Settings
3. Click on any chat to open the conversation screen
4. Try the floating action buttons
5. Customize the mock data in `src/data/mockData.js`

## Resources

- Expo Documentation: https://docs.expo.dev/
- React Native Documentation: https://reactnative.dev/
- React Navigation: https://reactnavigation.org/

## Need Help?

If you encounter any issues:
1. Check the troubleshooting section above
2. Review the terminal output for error messages
3. Make sure all prerequisites are properly installed
4. Try clearing cache with `npx expo start --clear`

Happy coding! 🚀
