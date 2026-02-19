# WhatsApp UI Clone - React Native Expo

A complete WhatsApp UI clone built with React Native and Expo, featuring all main screens and functionality.

## Features

### Onboarding Screens
- Beautiful onboarding flow with 3 screens
- Smooth animations and transitions
- Terms & Privacy Policy screen
- Get Started functionality

### Main Screens
1. **Chats Screen**
   - List of conversations with avatars
   - Unread message badges
   - Online status indicators
   - Search functionality
   - Floating action button for new chat

2. **Individual Chat Screen**
   - Message bubbles (sent/received)
   - Timestamps
   - Input field with emoji, attach, and camera buttons
   - Send/Voice message button
   - Video call and voice call buttons in header

3. **Updates/Status Screen**
   - My Status section
   - Status updates from contacts
   - Viewed/Unviewed status indicators

4. **Communities Screen**
   - Empty state with illustration
   - "Start your community" button

5. **Calls Screen**
   - Recent calls list
   - Incoming/Outgoing/Missed call indicators
   - Call button for quick redial
   - Create call link feature

6. **Settings Screen**
   - User profile section
   - Settings options list
   - Account, Privacy, Notifications, etc.

## Installation

1. Install dependencies:
```bash
npm install
```

**Note:** If you get an error about `expo-asset` not found, run:
```bash
npm install expo-asset expo-constants expo-file-system expo-font expo-splash-screen
```

2. Start the development server:
```bash
npx expo start
```

3. Run on your device:
   - Scan the QR code with Expo Go app (Android/iOS)
   - Press 'a' for Android emulator
   - Press 'i' for iOS simulator
   - Press 'w' for web browser

## Project Structure

```
whatsapp-ui/
├── App.js                          # Main app entry point
├── src/
│   ├── screens/
│   │   ├── OnboardingScreen.js    # Onboarding flow
│   │   ├── ChatsScreen.js         # Main chats list
│   │   ├── ChatScreen.js          # Individual chat
│   │   ├── StatusScreen.js        # Status/Updates
│   │   ├── CallsScreen.js         # Calls list
│   │   ├── CommunitiesScreen.js   # Communities
│   │   └── SettingsScreen.js      # Settings
│   ├── navigation/
│   │   └── MainTabs.js            # Bottom tab navigation
│   └── data/
│       └── mockData.js            # Mock chat/call/status data
├── assets/                         # Images and assets
├── package.json
└── README.md
```

## Technologies Used

- **React Native**: Mobile app framework
- **Expo**: Development platform
- **React Navigation**: Navigation library
  - Stack Navigator
  - Bottom Tabs Navigator
- **@expo/vector-icons**: Icon library (Ionicons)

## Customization

### Colors
The main WhatsApp colors used:
- Primary Green: `#25D366`
- Secondary Green: `#128C7E`
- Light Green (sent messages): `#DCF8C6`
- Background: `#E5DDD5`

### Mock Data
Edit `src/data/mockData.js` to customize:
- Chat conversations
- Status updates
- Call history
- Messages in chat

### Screens
Each screen is a separate component in `src/screens/` and can be customized independently.

## Features to Add (Future Enhancements)

- [ ] Real-time messaging with backend
- [ ] Image/Video sharing
- [ ] Voice messages recording
- [ ] Group chat creation
- [ ] Profile editing
- [ ] Dark mode
- [ ] Push notifications
- [ ] End-to-end encryption indicators

## Screenshots

The app includes:
- ✅ Onboarding screens with smooth transitions
- ✅ Chat list with unread badges
- ✅ Individual chat screen with messages
- ✅ Status/Updates screen
- ✅ Calls history
- ✅ Communities screen
- ✅ Settings screen

## Notes

This is a UI-only implementation. Backend functionality, real-time messaging, and data persistence would need to be added for a production app.

## License

MIT License - Feel free to use this project for learning and development purposes.

## Support

For issues or questions, please create an issue in the repository.

---

Made with ❤️ using React Native & Expo
