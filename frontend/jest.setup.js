// jest.setup.js

// Mock reanimated
jest.mock('react-native-reanimated', () => {
  const { View, Text, Image, ScrollView, FlatList } = require('react-native');
  return {
    default: {
      call: jest.fn(),
    },
    useSharedValue: jest.fn((v) => ({ value: v })),
    useAnimatedStyle: jest.fn(() => ({})),
    useDerivedValue: jest.fn((fn) => ({ value: fn() })),
    withTiming: jest.fn((v) => v),
    withSpring: jest.fn((v) => v),
    withDelay: jest.fn((d, v) => v),
    withSequence: jest.fn((...args) => args[0]),
    withRepeat: jest.fn((v) => v),
    runOnJS: jest.fn((fn) => fn),
    runOnUI: jest.fn((fn) => fn),
    makeMutable: jest.fn((v) => ({ value: v })),
    createAnimatedComponent: jest.fn((c) => c),
    View: View,
    Text: Text,
    Image: Image,
    ScrollView: ScrollView,
    FlatList: FlatList,
    interpolate: jest.fn(),
    Extrapolate: { CLAMP: 'clamp', IDENTITY: 'identity', EXTEND: 'extend' },
    FadeIn: { duration: jest.fn(() => ({})) },
    FadeOut: { duration: jest.fn(() => ({})) },
    SlideInDown: { duration: jest.fn(() => ({})) },
    SlideOutDown: { duration: jest.fn(() => ({})) },
  };
});

// Mock gesture handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureHandlerRootView: View,
    PanGestureHandler: View,
    TapGestureHandler: View,
    State: {},
    Gesture: {
      Pan: () => ({
        onStart: () => ({ onUpdate: () => ({ onEnd: () => ({}) }) }),
      }),
      Tap: () => ({
        onStart: () => ({ onEnd: () => ({}) }),
      }),
    },
    GestureDetector: View,
  };
});

// Mock Modal
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props) => {
      return props.visible ? React.createElement(View, { testID: props.testID }, props.children) : null;
    },
  };
});

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Circle: View,
    Line: View,
    Rect: View,
    Path: View,
    G: View,
    Text: View,
    Defs: View,
    LinearGradient: View,
    Stop: View,
  };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const mockContext = React.createContext(inset);
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => inset,
    SafeAreaContext: mockContext,
    SafeAreaConsumer: mockContext.Consumer,
  };
});

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: View,
    Polyline: View,
    Circle: View,
  };
});

// Mock navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: jest.fn().mockReturnValue({
      navigate: jest.fn(),
      dispatch: jest.fn(),
      goBack: jest.fn(),
    }),
    useRoute: jest.fn().mockReturnValue({
      params: {},
    }),
    useIsFocused: jest.fn().mockReturnValue(true),
  };
});

// Mock AppContext
jest.mock('./src/context/AppContext', () => ({
  useApp: jest.fn().mockReturnValue({
    role: 'rider',
    switchRole: jest.fn(),
    setRole: jest.fn(),
    finishSignIn: jest.fn().mockResolvedValue('profile'),
    isDarkMode: false,
    c: { surface: '#fff', primaryDark: '#000', text: '#000', textSec: '#666', border: '#eee', bg: '#f9f9f9', primaryLight: '#eee', primary: '#000', success: '#0f0' },
  }),
  AppProvider: ({ children }) => children,
}));

// Mock worklets
jest.mock('react-native-worklets', () => ({
  __esModule: true,
  Worklets: {
    createContext: jest.fn(),
    createRunInContext: jest.fn(),
    createSharedValue: jest.fn(),
  },
  createSerializable: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Firebase
jest.mock('@react-native-firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('@react-native-firebase/app', () => ({}));

// Mock Google Signin
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn(),
    isSignedIn: jest.fn(),
    getTokens: jest.fn(),
  },
}));

// Mock @env
jest.mock('@env', () => ({
  GOOGLE_WEB_CLIENT_ID: 'mock-client-id',
  API_URL: 'https://api.example.com',
}), { virtual: true });

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: {
      latitude: 12.9352,
      longitude: 77.6245,
    },
  }),
  installWebGeolocationPolyfill: jest.fn(),
  Accuracy: {
    Balanced: 3,
    High: 4,
  },
}));

// Mock react-native-paper
jest.mock('react-native-paper', () => ({
  Provider: ({ children }) => children,
  PaperProvider: ({ children }) => children,
  DefaultTheme: {},
  MD3LightTheme: {},
  MD3DarkTheme: {},
  useTheme: () => ({ colors: {} }),
}));

// Robust Animated mock
const { Animated } = require('react-native');
const mockAnim = (value, config) => ({
  start: (callback) => {
    if (value && config && config.toValue !== undefined) value.setValue(config.toValue);
    callback && callback({ finished: true });
  },
  stop: () => {},
  reset: () => {},
});

Animated.timing = mockAnim;
Animated.spring = mockAnim;
Animated.sequence = (anims) => ({
  start: (callback) => callback && callback({ finished: true }),
  stop: () => {},
  reset: () => {},
});
Animated.loop = (anim) => ({
  start: (callback) => callback && callback({ finished: true }),
  stop: () => {},
  reset: () => {},
});

console.warn = jest.fn();

// Mock Razorpay native checkout
jest.mock('react-native-razorpay', () => ({
  __esModule: true,
  default: { open: jest.fn() },
}));

// Mock Sentry native SDK
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));
