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

// Helper function to get a formatted timestamp
const getTimestamp = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Start with online status as true unless debug flag forces offline mode
  const [isOnline, setIsOnline] = useState(!DEBUG_CONFIG.FORCE_OFFLINE_MODE);
  
  useEffect(() => {
    // Check for existing session
    const timestamp = getTimestamp();
    // INFO: console.log(`[${timestamp}] 🔑 AUTH: Initializing authentication context`);
    checkSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      try {
        const timestamp = getTimestamp();
        // DEBUG: console.log(`[${timestamp}] 🔑 AUTH: Auth state changed, session: ${session ? 'active' : 'none'}`);
        setSession(session);
        if (session) {
          saveAnonymousId(session.user.id);
          // INFO: console.log(`[${timestamp}] 🔑 AUTH: User authenticated successfully with ID: ${session.user.id.substring(0, 8)}...`);
          captureMessage('User authenticated successfully');
        }
        setIsLoading(false);
      } catch (error) {
        const timestamp = getTimestamp();
        console.error(`[${timestamp}] ❌ AUTH: Error handling auth state change:`, error);
        captureError(error as Error, { context: 'auth_state_change' });
        setIsLoading(false);
      }
    });
    
    // Initial connectivity check
    checkNetworkStatus();

    return () => {
      const timestamp = getTimestamp();
      // DEBUG: console.log(`[${timestamp}] 🔑 AUTH: Unsubscribing from auth state changes`);
      subscription.unsubscribe();
    };
  }, []);

  // Save anonymous ID to AsyncStorage
  const saveAnonymousId = async (id: string) => {
    const timestamp = getTimestamp();
    try {
      // DEBUG: console.log(`[${timestamp}] 🔑 AUTH: Saving anonymous ID: ${id.substring(0, 8)}...`);
      await AsyncStorage.setItem(ANONYMOUS_ID_KEY, id);
      // DEBUG: console.log(`[${timestamp}] ✅ AUTH: Anonymous ID saved successfully`);
    } catch (error) {
      console.error(`[${timestamp}] ❌ AUTH: Failed to save anonymous ID:`, error);
      captureError(error as Error, { context: 'save_anonymous_id' });
    }
  };

  // Get anonymous ID from AsyncStorage
  const getAnonymousId = async (): Promise<string | null> => {
    const timestamp = getTimestamp();
    try {
      // DEBUG: console.log(`[${timestamp}] 🔑 AUTH: Retrieving anonymous ID from storage`);
      const id = await AsyncStorage.getItem(ANONYMOUS_ID_KEY);
      if (id) {
        // DEBUG: console.log(`[${timestamp}] ✅ AUTH: Retrieved anonymous ID: ${id.substring(0, 8)}...`);
      } else {
        // DEBUG: console.log(`[${timestamp}] ℹ️ AUTH: No anonymous ID found in storage`);
      }
      return id;
    } catch (error) {
      console.error(`[${timestamp}] ❌ AUTH: Failed to retrieve anonymous ID:`, error);
      captureError(error as Error, { context: 'get_anonymous_id' });
      return null;
    }
  };

  // Check network connectivity status
  const checkNetworkStatus = async (): Promise<boolean> => {
    const timestamp = getTimestamp();
    // DEBUG: console.log(`[${timestamp}] 🌐 AUTH: Checking network connectivity`);
    
    try {
      const isConnected = await checkConnectivity();
      setIsOnline(isConnected);
      if (!isConnected) {
        // INFO: console.log(`[${timestamp}] ℹ️ AUTH: Device is offline`);
        captureMessage('Device is offline', 'warning');
      } else {
        // DEBUG: console.log(`[${timestamp}] ✅ AUTH: Device is online`);
      }
      return isConnected;
    } catch (error) {
      console.error(`[${timestamp}] ❌ AUTH: Network check failed:`, error);
      captureError(error as Error, { context: 'check_network_status' });
      setIsOnline(false);
      return false;
    }
  };

  // Creates a fake session for offline mode
  const createOfflineSession = async (): Promise<Session> => {
    const timestamp = getTimestamp();
    // INFO: console.log(`[${timestamp}] 🔑 AUTH: Creating offline session`);
    
    try {
      // Try to get an existing ID first
      const savedId = await getAnonymousId();
      const randomId = savedId || 'offline_' + Math.random().toString(36).substring(2, 15);
      
      if (!savedId) {
        // DEBUG: console.log(`[${timestamp}] 🔑 AUTH: No existing ID found, generating new offline ID: ${randomId.substring(0, 8)}...`);
        await saveAnonymousId(randomId);
      } else {
        // DEBUG: console.log(`[${timestamp}] 🔑 AUTH: Using existing offline ID: ${savedId.substring(0, 8)}...`);
      }
      
      captureMessage('Created offline session', 'info');
      // DEBUG: console.log(`[${timestamp}] ✅ AUTH: Offline session created successfully`);
      
      return {
        access_token: 'offline_mode',
        refresh_token: '',
        token_type: 'bearer',
        expires_in: 0,
        expires_at: 0,
        user: {
          id: randomId,
          app_metadata: {},
          user_metadata: {},
          aud: 'offline',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email: undefined,
          phone: undefined,
          confirmed_at: undefined,
          email_confirmed_at: undefined,
          phone_confirmed_at: undefined,
          last_sign_in_at: new Date().toISOString(),
          role: undefined,
          identities: [],
        }
      };
    } catch (error) {
      console.error(`[${timestamp}] ❌ AUTH: Failed to create offline session:`, error);
      captureError(error as Error, { context: 'create_offline_session' });
      throw error;
    }
  };

  const checkSession = async () => {
    const timestamp = getTimestamp();
    // INFO: console.log(`[${timestamp}] �� AUTH: Checking for existing session`);
    
    try {
      // If debug mode forces offline, don't even try to get a session
      if (DEBUG_CONFIG.FORCE_OFFLINE_MODE) {
        // INFO: console.log(`[${timestamp}] ℹ️ AUTH: Debug config is forcing offline mode`);
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
        // INFO: console.log(`[${timestamp}] ℹ️ AUTH: Device is offline, using offline session`);
        const offlineSession = await createOfflineSession();
        setSession(offlineSession);
        setIsLoading(false);
        return;
      }

      // Otherwise, try to get the session from Supabase
      // DEBUG: console.log(`[${timestamp}] 🔑 AUTH: Device is online, attempting to get Supabase session`);
      try {
        const startTime = Date.now();
        const session = await retryWithBackoff(async () => await authOperations.getSession());
        const duration = Date.now() - startTime;
        
        if (session) {
          // INFO: console.log(`[${timestamp}] ✅ AUTH: Retrieved valid session in ${duration}ms for user ID: ${session.user.id.substring(0, 8)}...`);
          setSession(session);
          saveAnonymousId(session.user.id);
        } else {
          // INFO: console.log(`[${timestamp}] ℹ️ AUTH: No active session found in Supabase (${duration}ms)`);
        }
      } catch (error) {
        console.error(`[${timestamp}] ❌ AUTH: Failed to get session after retries:`, error);
        // Fall back to offline mode if we can't get the session
        // WARN: console.log(`[${timestamp}] 🔄 AUTH: Falling back to offline mode due to session retrieval failure`);
        setIsOnline(false);
        const offlineSession = await createOfflineSession();
        setSession(offlineSession);
      }
    } catch (error) {
      console.error(`[${timestamp}] ❌ AUTH: Error in checkSession:`, error);
      // Mark as offline if anything fails
      setIsOnline(false);
      
      // Create a fake session for offline mode
      // WARN: console.log(`[${timestamp}] 🔄 AUTH: Creating fallback offline session due to error`);
      const offlineSession = await createOfflineSession();
      setSession(offlineSession);
    } finally {
      setIsLoading(false);
      // DEBUG: console.log(`[${timestamp}] ✅ AUTH: Session check completed, loading state set to false`);
    }
  };

  const signIn = async () => {
    const timestamp = getTimestamp();
    // INFO: console.log(`[${timestamp}] 🔑 AUTH: Signing in user`);
    setIsLoading(true);
    let errorAlreadyShown = false;
    
    try {
      // If debug mode forces offline, use offline mode directly
      if (DEBUG_CONFIG.FORCE_OFFLINE_MODE) {
        // INFO: console.log(`[${timestamp}] ℹ️ AUTH: Debug config is forcing offline mode for sign-in`);
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
        // INFO: console.log(`[${timestamp}] ℹ️ AUTH: Device offline but has saved ID, using offline session`);
        const offlineSession = await createOfflineSession();
        setSession(offlineSession);
        setIsLoading(false);
        return;
      }
      
      // If we're online, try to sign in with Supabase
      if (isConnected) {
        // DEBUG: console.log(`[${timestamp}] 🔑 AUTH: Device online, attempting anonymous sign-in with Supabase`);
        try {
          const startTime = Date.now();
          const { session } = await retryWithBackoff(async () => await authOperations.signInAnonymously());
          const duration = Date.now() - startTime;
          
          if (session) {
            // INFO: console.log(`[${timestamp}] ✅ AUTH: Anonymous sign-in successful in ${duration}ms. User ID: ${session.user.id.substring(0, 8)}...`);
            setSession(session);
            saveAnonymousId(session.user.id);
          } else {
            // ERROR: console.log(`[${timestamp}] ❌ AUTH: Anonymous sign-in returned no session after ${duration}ms`);
          }
          return;
        } catch (error) {
          console.error(`[${timestamp}] ❌ AUTH: Failed to sign in after retries:`, error);
          
          // Check specifically for "Anonymous sign-ins are disabled" error
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Anonymous sign-ins are disabled')) {
            console.error(`[${timestamp}] ❌ AUTH: Supabase configuration error - Anonymous sign-ins are disabled`);
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
          // WARN: console.log(`[${timestamp}] 🔄 AUTH: Falling back to offline mode due to sign-in failure`);
          setIsOnline(false);
        }
      }
      
      // If online sign-in failed or we're offline without a saved ID, create a new offline session
      // INFO: console.log(`[${timestamp}] 🔑 AUTH: Creating offline session as fallback`);
      const offlineSession = await createOfflineSession();
      setSession(offlineSession);
      
      if (!errorAlreadyShown && Platform.OS !== 'web') {
        Alert.alert(
          "Network Error",
          "Could not connect to the server. Working in offline mode.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error(`[${timestamp}] ❌ AUTH: Error signing in:`, error);
      // Final fallback to offline mode
      // ERROR: console.log(`[${timestamp}] 🔄 AUTH: Creating emergency offline session due to sign-in error`);
      setIsOnline(false);
      const offlineSession = await createOfflineSession();
      setSession(offlineSession);
    } finally {
      setIsLoading(false);
      // DEBUG: console.log(`[${timestamp}] ✅ AUTH: Sign-in process completed, loading state set to false`);
    }
  };

  const signOut = async () => {
    const timestamp = getTimestamp();
    // INFO: console.log(`[${timestamp}] 🔑 AUTH: Signing out user`);
    
    try {
      setIsLoading(true);
      
      // Only try to sign out with Supabase if we're online
      if (isOnline && !DEBUG_CONFIG.FORCE_OFFLINE_MODE) {
        // DEBUG: console.log(`[${timestamp}] 🔑 AUTH: Device online, attempting to sign out with Supabase`);
        try {
          const startTime = Date.now();
          await retryWithBackoff(async () => await authOperations.signOut());
          const duration = Date.now() - startTime;
          // INFO: console.log(`[${timestamp}] ✅ AUTH: Supabase sign-out successful in ${duration}ms`);
        } catch (error) {
          console.error(`[${timestamp}] ❌ AUTH: Error signing out with Supabase:`, error);
          // WARN: console.log(`[${timestamp}] 🔄 AUTH: Continuing with local sign-out only`);
          // Just continue with local sign out
        }
      } else {
        // DEBUG: console.log(`[${timestamp}] ℹ️ AUTH: Skipping Supabase sign-out (${isOnline ? 'online' : 'offline'}, force offline: ${DEBUG_CONFIG.FORCE_OFFLINE_MODE})`);
      }
      
      // Always clear session and local storage
      // DEBUG: console.log(`[${timestamp}] 🔑 AUTH: Clearing session and local storage`);
      setSession(null);
      await AsyncStorage.removeItem(ANONYMOUS_ID_KEY);
      // DEBUG: console.log(`[${timestamp}] ✅ AUTH: Session cleared and anonymous ID removed from storage`);
    } catch (error) {
      console.error(`[${timestamp}] ❌ AUTH: Error signing out:`, error);
      
      // Force sign out even if anything else fails
      // WARN: console.log(`[${timestamp}] 🔄 AUTH: Forcing session clear due to sign-out error`);
      setSession(null);
      await AsyncStorage.removeItem(ANONYMOUS_ID_KEY);
    } finally {
      setIsLoading(false);
      // DEBUG: console.log(`[${timestamp}] ✅ AUTH: Sign-out process completed, loading state set to false`);
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