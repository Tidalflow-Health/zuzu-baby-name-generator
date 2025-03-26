import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../contexts/AuthContext';

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

export default function RootLayout() {
  const [loaded] = useFonts({
    // You can add any custom fonts here if needed
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider value={IOSTheme}>
          <Stack 
            screenOptions={{ 
              headerShown: false,
              // Remove animation completely
              animation: 'none',
              // Keep gesture navigation enabled for user experience
              gestureEnabled: true,
              presentation: 'card'
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="home" />
            <Stack.Screen name="names" />
            <Stack.Screen name="likes" />
            {/* <Stack.Screen name="test" /> */}
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
