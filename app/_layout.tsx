import React from 'react';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../contexts/AuthContext';
import * as Sentry from '@sentry/react-native';
import { initSentry } from '../utils/sentry';
import { View, Text } from 'react-native';

// Initialize Sentry
initSentry();

// Log the update URL
console.log('EXPO_PUBLIC_UPDATE_URL:', process.env.EXPO_PUBLIC_UPDATE_URL);

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Create a custom theme based on DefaultTheme for iOS
const IOSTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: '#FF5BA1',
    background: '#F9D976',
    card: 'white',
    text: '#333',
    border: '#eee',
    notification: '#FF5BA1'
  }
};

// Error boundary component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#FF5BA1', fontSize: 16 }}>
            Something went wrong. Please restart the app.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function RootLayout() {
  // We'll use system font for now
  const [fontsLoaded] = useFonts({});

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <ThemeProvider value={IOSTheme}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="names" options={{ headerShown: false }} />
              <Stack.Screen name="likes" options={{ headerShown: false }} />
              <Stack.Screen name="matches" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="dark" />
          </ThemeProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
