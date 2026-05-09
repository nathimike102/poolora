# RidePool — React Native (Expo + TypeScript + React Native Paper)

Converted from React TSX (web) to a production-grade React Native application.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start Expo dev server
npx expo start

# 3. Run on device/simulator
# iOS:     press i
# Android: press a
# Expo Go: scan QR code
```

---

## 📁 Project Structure

```
ridepool-rn/
├── App.tsx                         ← Root: GestureHandler → SafeArea → Paper → AppProvider → Navigator
├── src/
│   ├── context/
│   │   └── AppContext.tsx          ← Global state: role, user, dark mode
│   ├── navigation/
│   │   ├── AppNavigator.tsx        ← NavigationContainer + NativeStackNavigator
│   │   └── types.ts                ← Typed RootStackParamList + convenience re-exports
│   ├── theme/
│   │   └── index.ts                ← Colours, Typography, Spacing, Radius, Shadow scales
│   ├── screens/
│   │   ├── SplashScreen.tsx        ← ✅ Fully converted
│   │   ├── LoginScreen.tsx         ← ✅ Fully converted
│   │   ├── OTPScreen.tsx           ← ✅ Fully converted
│   │   ├── OnboardingScreen.tsx    ← ✅ Fully converted
│   │   ├── RoleSelectionScreen.tsx ← ✅ Fully converted
│   │   ├── rider/                  ← 🔧 Stubs — implement following patterns above
│   │   ├── driver/                 ← 🔧 Stubs
│   │   ├── parcel/                 ← 🔧 Stubs
│   │   ├── trip/                   ← 🔧 Stubs
│   │   └── shared/                 ← 🔧 Stubs
│   ├── components/
│   │   ├── GradientButton.tsx      ← Reusable animated CTA button
│   │   ├── BackButton.tsx          ← Back navigation button
│   │   ├── ScreenWrapper.tsx       ← SafeAreaView + optional ScrollView wrapper
│   │   ├── RidePoolLogo.tsx        ← SVG logo (react-native-svg)
│   │   └── AnimatedDot.tsx         ← Pulsing loading dot
│   └── utils/
│       ├── dimensions.ts           ← wp(), hp(), normalize() replacing vw/vh
│       └── formatters.ts           ← Currency, phone, distance, time formatting
```

---

## 🔄 Major Web → Native Architectural Changes

### 1. Styling System
| Web | React Native |
|-----|-------------|
| CSS files (`.css`) | `StyleSheet.create({})` |
| Tailwind classes (`className`) | Style props (`style={styles.x}`) |
| `px`, `rem`, `vw`, `vh` | Plain numbers (dp) |
| `linear-gradient()` CSS | `expo-linear-gradient` native module |
| `box-shadow` | `elevation` (Android) + `shadow*` props (iOS) |
| `overflow: hidden` | Same — `overflow: 'hidden'` |
| CSS variables | TypeScript theme object |

### 2. HTML → RN Components
| Web | React Native |
|-----|-------------|
| `<div>` | `<View>` |
| `<span>`, `<p>`, `<h1>` | `<Text>` |
| `<img src="...">` | `<Image source={{ uri: '...' }}>` |
| `<input type="tel">` | `<TextInput keyboardType="phone-pad">` |
| `<button>` | `<TouchableOpacity>` or Paper `<Button>` |
| `<svg>` | `<Svg>` from `react-native-svg` |
| Inline SVG `<path>` | `<Path>` from `react-native-svg` |

### 3. Navigation
| Web | React Native |
|-----|-------------|
| Custom `navigate(string)` from Context | `useNavigation<NativeStackNavigationProp<...>>()` |
| `goBack()` in Context | `navigation.goBack()` |
| String route names | Typed `RootStackParamList` |
| History-based back | Native stack + gesture-based swipe-back (iOS) |
| `navigate('otp')` | `navigation.navigate('OTP', { phone })` with typed params |

### 4. Animation
| Web (framer-motion) | React Native (Animated API) |
|---------------------|----------------------------|
| `motion.div initial/animate` | `Animated.Value` + `Animated.timing/spring` |
| `whileTap={{ scale: 0.97 }}` | `Animated.spring` on press in/out |
| `AnimatePresence` | Manual sequence + `Animated.timing` opacity |
| `animate={{ width: active ? 28 : 8 }}` | `Animated.timing` with `useNativeDriver: false` |
| `repeat: Infinity` | `Animated.loop()` |
| `transition={{ delay: 1.2 }}` | `delay` param in `Animated.timing` |

### 5. Layout
| Web | React Native |
|-----|-------------|
| `overflow-y: auto` | `<ScrollView>` component |
| `flex-1` + `overflow-y: scroll` | `<ScrollView contentContainerStyle={{ flexGrow: 1 }}>` |
| `margin-top: auto` (push to bottom) | `<View style={{ flex: 1 }}>` spacer |
| `position: relative` (default) | `position: 'relative'` (also default in RN) |
| `position: absolute` | Same |

### 6. Keyboard Handling
| Web | React Native |
|-----|-------------|
| Browser auto-scrolls on input focus | `<KeyboardAvoidingView behavior="padding">` |
| `document.getElementById('x').focus()` | `ref.current?.focus()` |
| `onKeyDown` | `onKeyPress` |

---

## 📦 Key Dependencies

```json
{
  "expo": "~51.0.0",
  "react-native-paper": "^5.12.3",        // UI components (replaces shadcn/ui)
  "@react-navigation/native": "^6.1.17",  // Navigation
  "@react-navigation/native-stack": "^6.9.26",
  "react-native-svg": "15.2.0",           // SVG rendering
  "react-native-reanimated": "~3.10.1",   // Advanced animations (optional upgrade)
  "react-native-gesture-handler": "~2.16.1",
  "react-native-safe-area-context": "4.10.5"
}
```

---

## 🎨 Theming

The theme is defined in `src/theme/index.ts` and provides:

- `LightColors` / `DarkColors` — app colour tokens
- `PaperLightTheme` / `PaperDarkTheme` — MD3 theme for Paper components  
- `Typography` — font sizes and weights
- `Spacing` — consistent spacing scale
- `Radius` — border radius scale
- `Shadow` — cross-platform shadow objects

Toggle dark mode via `useApp().toggleDarkMode()`.

---

## 🔧 Implementing Stub Screens

All screens in `rider/`, `driver/`, `parcel/`, `trip/`, `shared/` are stubs.
To implement them, follow the patterns in the converted screens:

1. Use `StyleSheet.create()` — no inline style objects
2. Use `useNavigation<NativeStackNavigationProp<RootStackParamList>>()` for navigation
3. Use `useApp()` for colours: `const { c } = useApp()`
4. Replace `<div>` with `<View>`, `<p>/<h1>` with `<Text>`
5. Use React Native Paper components for UI: `<Appbar>`, `<Card>`, `<Button>`, etc.
6. Use `GradientButton` for primary CTAs
7. Use `ScreenWrapper` for consistent screen padding + safe area

---

## 📋 Next Steps

1. Run `npm install` and `npx expo start`
2. Test the 5 converted auth/onboarding screens
3. Implement remaining screens one by one using stub templates
4. Add `expo-linear-gradient` for true gradient backgrounds
5. Integrate real OTP API (replace the setTimeout mock)
6. Add `expo-image` for optimised image caching
7. Configure deep linking in `AppNavigator.tsx`
