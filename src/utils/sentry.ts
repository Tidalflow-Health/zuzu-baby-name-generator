import * as Sentry from '@sentry/react-native';
import { DEBUG_CONFIG } from './appConfig';

// Initialize Sentry
export const initSentry = () => {
  if (DEBUG_CONFIG.FORCE_OFFLINE_MODE) {
    return; // Don't initialize Sentry in offline mode
  }

  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    // Performance Monitoring
    tracesSampleRate: 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Enable native crash handling
    enableNative: true,
    // Enable native symbol upload
    enableNativeCrashHandling: true,
    // Enable native frames tracking
    enableNativeFramesTracking: true,
    // Enable native stack traces
    enableNativeStackTraces: true,
    // Enable native symbol upload
    enableNativeSymbolUpload: true,
    // Enable native symbol upload for iOS
    enableNativeSymbolUploadIOS: true,
    // Enable native symbol upload for Android
    enableNativeSymbolUploadAndroid: true,
  });
};

// Helper function to capture errors
export const captureError = (error: Error, context?: Record<string, any>) => {
  if (DEBUG_CONFIG.FORCE_OFFLINE_MODE) {
    console.error('Error in offline mode:', error);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
};

// Helper function to capture messages
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  if (DEBUG_CONFIG.FORCE_OFFLINE_MODE) {
    console.log(`Message in offline mode: ${message}`);
    return;
  }

  Sentry.captureMessage(message, {
    level,
  });
}; 