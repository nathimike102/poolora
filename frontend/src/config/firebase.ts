/**
 * config/firebase.ts
 *
 * Firebase configuration and initialization.
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project (or use an existing one)
 * 3. Enable "Phone" sign-in under Authentication → Sign-in method
 * 4. Add your Android app (package name from app.json)
 *    → Download google-services.json → place in project root
 * 5. Add your iOS app (bundle ID from app.json)
 *    → Download GoogleService-Info.plist → place in project root
 * 6. For Expo, add the Firebase config plugin in app.json:
 *
 *    "plugins": [
 *      "@react-native-firebase/app",
 *      "@react-native-firebase/auth"
 *    ]
 *
 * 7. Run `npx expo prebuild` to generate native projects
 * 8. Run `npx expo run:android` or `npx expo run:ios`
 *
 * NOTE: Firebase phone auth does NOT work with Expo Go.
 *       You must use a development build (expo-dev-client).
 */

import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';

// @react-native-firebase auto-initializes from google-services.json (Android)
// and GoogleService-Info.plist (iOS), so no manual initializeApp() is needed.

export { firebase, auth };
export default auth;
