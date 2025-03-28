import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, authOperations } from '../utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { DEBUG_CONFIG } from '../utils/appConfig';
import { checkConnectivity, retryWithBackoff, isNetworkError } from '../utils/network';
import { captureError, captureMessage } from '../utils/sentry';

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  isOnline: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  checkNetworkStatus: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Key for storing the anonymous ID in AsyncStorage
const ANONYMOUS_ID_KEY = 'zuzu_anonymous_id';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Start with online status as true unless debug flag forces offline mode
  const [isOnline, setIsOnline] = useState(!DEBUG_CONFIG.FORCE_OFFLINE_MODE);
  
  useEffect(() => {
    // Check for existing session
    checkSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      try {
        setSession(session);
        if (session) {
          saveAnonymousId(session.user.id);
          captureMessage('User authenticated successfully');
        }
        setIsLoading(false);
      } catch (error) {
        captureError(error as Error, { context: 'auth_state_change' });
        setIsLoading(false);
      }
    });
    
    // Initial connectivity check
    checkNetworkStatus();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Save anonymous ID to AsyncStorage
  const saveAnonymousId = async (id: string) => {
    try {
      await AsyncStorage.setItem(ANONYMOUS_ID_KEY, id);
    } catch (error) {
      captureError(error as Error, { context: 'save_anonymous_id' });
    }
  };

  // Get anonymous ID from AsyncStorage
  const getAnonymousId = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(ANONYMOUS_ID_KEY);
    } catch (error) {
      captureError(error as Error, { context: 'get_anonymous_id' });
      return null;
    }
  };

  // Check network connectivity status
  const checkNetworkStatus = async (): Promise<boolean> => {
    try {
      const isConnected = await checkConnectivity();
      setIsOnline(isConnected);
      if (!isConnected) {
        captureMessage('Device is offline', 'warning');
      }
      return isConnected;
    } catch (error) {
      captureError(error as Error, { context: 'check_network_status' });
      setIsOnline(false);
      return false;
    }
  };

  // Creates a fake session for offline mode
  const createOfflineSession = async (): Promise<Session> => {
    try {
      // Try to get an existing ID first
      const savedId = await getAnonymousId();
      const randomId = savedId || 'offline_' + Math.random().toString(36).substring(2, 15);
      
      if (!savedId) {
        await saveAnonymousId(randomId);
      }
      
      captureMessage('Created offline session', 'info');
      
      return {
        access_token: 'offline_mode',
        refresh_token: '',
        expires_in: 0,
        expires_at: 0,
        user: {
          id: randomId,
          app_metadata: {},
          user_metadata: {},
        }
      };
    } catch (error) {
      captureError(error as Error, { context: 'create_offline_session' });
      throw error;
    }
  };

  const checkSession = async () => {
    try {
      // If debug mode forces offline, don't even try to get a session
      if (DEBUG_CONFIG.FORCE_OFFLINE_MODE) {
        setIsOnline(false);
        const offlineSession = await createOfflineSession();
        setSession(offlineSession);
        setIsLoading(false);
        return;
      }

      // Check network connectivity first
      const isConnected = await checkNetworkStatus();
      
      // If we're not online, use offline mode
      if (!isConnected) {
        const offlineSession = await createOfflineSession();
        setSession(offlineSession);
        setIsLoading(false);
        return;
      }

      // Otherwise, try to get the session from Supabase
      try {
        const session = await retryWithBackoff(async () => await authOperations.getSession());
        setSession(session);
        if (session) {
          saveAnonymousId(session.user.id);
        }
      } catch (error) {
        console.error('Failed to get session after retries:', error);
        // Fall back to offline mode if we can't get the session
        setIsOnline(false);
        const offlineSession = await createOfflineSession();
        setSession(offlineSession);
      }
    } catch (error) {
      console.error('Error in checkSession:', error);
      // Mark as offline if anything fails
      setIsOnline(false);
      
      // Create a fake session for offline mode
      const offlineSession = await createOfflineSession();
      setSession(offlineSession);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async () => {
    setIsLoading(true);
    let errorAlreadyShown = false;
    
    try {
      // If debug mode forces offline, use offline mode directly
      if (DEBUG_CONFIG.FORCE_OFFLINE_MODE) {
        setIsOnline(false);
        const offlineSession = await createOfflineSession();
        setSession(offlineSession);
        setIsLoading(false);
        return;
      }

      // Check if we already have an anonymous ID saved
      const savedId = await getAnonymousId();
      
      // Check network connectivity first
      const isConnected = await checkNetworkStatus();
      
      // If we're not online but have a saved ID, use offline mode
      if (!isConnected && savedId) {
        const offlineSession = await createOfflineSession();
        setSession(offlineSession);
        setIsLoading(false);
        return;
      }
      
      // If we're online, try to sign in with Supabase
      if (isConnected) {
        try {
          const { session } = await retryWithBackoff(async () => await authOperations.signInAnonymously());
          setSession(session);
          if (session) {
            saveAnonymousId(session.user.id);
          }
          return;
        } catch (error) {
          console.error('Failed to sign in after retries:', error);
          
          // Check specifically for "Anonymous sign-ins are disabled" error
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Anonymous sign-ins are disabled')) {
            // Show detailed error message in development
            if (Platform.OS !== 'web') {
              Alert.alert(
                "Supabase Configuration Error",
                "Anonymous sign-ins are disabled in your Supabase project. Please enable them in the Supabase dashboard:\n\n" +
                "1. Go to Authentication > Providers\n" +
                "2. Find 'Anonymous Sign-in'\n" +
                "3. Toggle it to 'Enabled'\n\n" +
                "Using offline mode for now.",
                [{ text: "OK" }]
              );
              errorAlreadyShown = true;
            }
            console.warn('IMPORTANT: Anonymous sign-ins are disabled in Supabase. Enable them in Authentication > Providers.');
          }
          
          // Fall back to offline mode
          setIsOnline(false);
        }
      }
      
      // If online sign-in failed or we're offline without a saved ID, create a new offline session
      const offlineSession = await createOfflineSession();
      setSession(offlineSession);
      
      if (Platform.OS !== 'web') {
        Alert.alert(
          "Network Error",
          "Could not connect to the server. Working in offline mode.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('Error signing in:', error);
      // Final fallback to offline mode
      setIsOnline(false);
      const offlineSession = await createOfflineSession();
      setSession(offlineSession);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Only try to sign out with Supabase if we're online
      if (isOnline && !DEBUG_CONFIG.FORCE_OFFLINE_MODE) {
        try {
          await retryWithBackoff(async () => await authOperations.signOut());
        } catch (error) {
          console.error('Error signing out with Supabase:', error);
          // Just continue with local sign out
        }
      }
      
      // Always clear session and local storage
      setSession(null);
      await AsyncStorage.removeItem(ANONYMOUS_ID_KEY);
    } catch (error) {
      console.error('Error signing out:', error);
      
      // Force sign out even if anything else fails
      setSession(null);
      await AsyncStorage.removeItem(ANONYMOUS_ID_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isOnline,
        signIn,
        signOut,
        checkNetworkStatus,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 