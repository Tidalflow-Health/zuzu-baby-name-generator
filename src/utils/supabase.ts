import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anonymous Key');
}

// Default timeout values (ms)
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const RETRY_DELAY = 1000; // 1 second between retries

// Helper function to get a formatted timestamp
const getTimestamp = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  global: {
    headers: {
      'X-App-Name': 'Zuzu Baby Names',
    },
    fetch: (url, options) => {
      const timestamp = getTimestamp();
      // Truncate URL for logging to avoid excessively long logs
      const urlForLog = typeof url === 'string' 
        ? (url.length > 100 ? url.substring(0, 100) + '...' : url)
        : 'non-string-url';
      
      // DEBUG: console.log(`[${timestamp}] 🌐 SUPABASE: Fetch request to ${urlForLog}`);
      
      // Create a controller to handle timeouts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: Request to ${urlForLog} timed out after ${DEFAULT_TIMEOUT}ms`);
      }, DEFAULT_TIMEOUT);
      
      // Add the signal to the options
      const fetchOptions = {
        ...options,
        signal: controller.signal,
      };
      
      const startTime = Date.now();
      return fetch(url, fetchOptions)
        .then(response => {
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          // DEBUG: console.log(`[${timestamp}] ✅ SUPABASE: Response from ${urlForLog} received in ${duration}ms (status: ${response.status})`);
          return response;
        })
        .catch(error => {
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: Fetch error for ${urlForLog} after ${duration}ms:`, 
          //   error.name, error.message);
          throw error;
        });
    },
  },
});

// Types for our database
export type NameRecord = {
  id: string;
  user_id: string;
  name: string;
  last_name: string | null;
  meaning: string;
  origin: string;
  status: 'liked' | 'maybe' | 'disliked';
  search_context: Record<string, any>;
  created_at: string;
};

// Retry function for network operations
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  const timestamp = getTimestamp();
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // DEBUG: console.log(`[${timestamp}] 🔄 SUPABASE: Retry attempt ${attempt}/${maxRetries-1}`);
      }
      
      const result = await operation();
      
      if (attempt > 0) {
        // DEBUG: console.log(`[${timestamp}] ✅ SUPABASE: Operation succeeded after ${attempt} retries`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: Operation failed (attempt ${attempt+1}/${maxRetries}):`, 
      //   error instanceof Error ? `${error.name}: ${error.message}` : errorMessage);
      
      // Only retry on network errors
      if (error instanceof Error && 
         (error.message.includes('Network request failed') || 
          error.message.includes('Failed to fetch') ||
          error.message.includes('abort') ||
          error.message.includes('timeout'))) {
        // Wait before retrying
        const delay = RETRY_DELAY * Math.pow(2, attempt); // Exponential backoff
        // DEBUG: console.log(`[${timestamp}] 🔄 SUPABASE: Network error detected, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Don't retry for non-network errors
      // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: Non-network error, will not retry:`, 
      //   error instanceof Error ? error.name : typeof error);
      throw error;
    }
  }
  
  // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: All ${maxRetries} retry attempts failed`);
  throw lastError;
}

// Helper functions for name operations
export const nameOperations = {
  async createName(nameData: Omit<NameRecord, 'id' | 'created_at' | 'user_id'>) {
    const timestamp = getTimestamp();
    // INFO: console.log(`[${timestamp}] 📝 SUPABASE: Creating name "${nameData.name}" with status "${nameData.status}"`);
    
    return withRetry(async () => {
      // Get the current user ID
      const sessionStart = Date.now();
      const { data: { session } } = await supabase.auth.getSession();
      const sessionDuration = Date.now() - sessionStart;
      
      if (!session) {
        // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: No session found. Authentication required to create a name.`);
        throw new Error('No session found. User must be authenticated to create a name.');
      }

      // DEBUG: console.log(`[${timestamp}] 🔑 SUPABASE: Got session in ${sessionDuration}ms for user ${session.user.id.substring(0, 8)}...`);
      const userId = session.user.id;
      
      // Insert with the user_id explicitly set
      const insertStart = Date.now();
      const { data, error } = await supabase
        .from('name_records')
        .insert([{ ...nameData, user_id: userId }])
        .select()
        .single();
      
      const insertDuration = Date.now() - insertStart;
      
      if (error) {
        // Check specifically for RLS error
        if (error.code === '42501' && error.message.includes('policy')) {
          // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: RLS policy violation. Make sure RLS policies are configured correctly in Supabase.`);
        }
        // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: Failed to create name "${nameData.name}" - ${error.code}: ${error.message}`);
        throw error;
      }
      
      // INFO: console.log(`[${timestamp}] ✅ SUPABASE: Successfully created name "${nameData.name}" in ${insertDuration}ms, ID: ${data.id}`);
      return data;
    });
  },

  async updateNameStatus(nameId: string, status: NameRecord['status']) {
    const timestamp = getTimestamp();
    // INFO: console.log(`[${timestamp}] 📝 SUPABASE: Updating name status for ID "${nameId.substring(0, 8)}..." to "${status}"`);
    
    return withRetry(async () => {
      // Get the current user ID
      const sessionStart = Date.now();
      const { data: { session } } = await supabase.auth.getSession();
      const sessionDuration = Date.now() - sessionStart;
      
      if (!session) {
        // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: No session found. Authentication required to update name status.`);
        throw new Error('No session found. User must be authenticated to update a name.');
      }
      
      // DEBUG: console.log(`[${timestamp}] 🔑 SUPABASE: Got session in ${sessionDuration}ms for user ${session.user.id.substring(0, 8)}...`);
      
      const updateStart = Date.now();
      const { data, error } = await supabase
        .from('name_records')
        .update({ status, user_id: session.user.id })
        .eq('id', nameId)
        .select()
        .single();
      
      const updateDuration = Date.now() - updateStart;
      
      if (error) {
        // Check specifically for RLS error
        if (error.code === '42501' && error.message.includes('policy')) {
          // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: RLS policy violation. Make sure RLS policies are configured correctly in Supabase.`);
        }
        // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: Failed to update name status for ID "${nameId.substring(0, 8)}..." - ${error.code}: ${error.message}`);
        throw error;
      }
      
      // INFO: console.log(`[${timestamp}] ✅ SUPABASE: Successfully updated name "${data.name}" to status "${status}" in ${updateDuration}ms`);
      return data;
    });
  },

  async getUserNames(status?: NameRecord['status']) {
    const timestamp = getTimestamp();
    // INFO: console.log(`[${timestamp}] 📋 SUPABASE: Fetching names${status ? ` with status "${status}"` : ''}`);
    
    return withRetry(async () => {
      // Get the current user ID
      const sessionStart = Date.now();
      const { data: { session } } = await supabase.auth.getSession();
      const sessionDuration = Date.now() - sessionStart;
      
      if (!session) {
        // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: No session found. Authentication required to get names.`);
        throw new Error('No session found. User must be authenticated to get names.');
      }
      
      // DEBUG: console.log(`[${timestamp}] 🔑 SUPABASE: Got session in ${sessionDuration}ms for user ${session.user.id.substring(0, 8)}...`);
      
      const queryStart = Date.now();
      const query = supabase
        .from('name_records')
        .select('*')
        .eq('user_id', session.user.id); // Filter by the current user's ID
      
      if (status) {
        query.eq('status', status);
      }
      
      const { data, error } = await query;
      const queryDuration = Date.now() - queryStart;
      
      if (error) {
        // Check specifically for RLS error
        if (error.code === '42501' && error.message.includes('policy')) {
          // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: RLS policy violation. Make sure RLS policies are configured correctly in Supabase.`);
        }
        // DEBUG: console.error(`[${timestamp}] ❌ SUPABASE: Failed to fetch names - ${error.code}: ${error.message}`);
        throw error;
      }
      
      // INFO: console.log(`[${timestamp}] ✅ SUPABASE: Successfully fetched ${data.length} names in ${queryDuration}ms`);
      return data;
    });
  },
};

// Auth helper functions
export const authOperations = {
  async signInAnonymously() {
    const timestamp = getTimestamp();
    console.log(`[${timestamp}] 🔑 SUPABASE: Attempting anonymous sign-in`);
    
    return withRetry(async () => {
      const startTime = Date.now();
      const { data, error } = await supabase.auth.signInAnonymously();
      const duration = Date.now() - startTime;
      
      if (error) {
        console.error(`[${timestamp}] ❌ SUPABASE: Anonymous sign-in failed after ${duration}ms - ${error.name}: ${error.message}`);
        throw error;
      }
      
      if (data.session) {
        console.log(`[${timestamp}] ✅ SUPABASE: Anonymous sign-in successful in ${duration}ms. User ID: ${data.session.user.id.substring(0, 8)}...`);
      } else {
        console.log(`[${timestamp}] ⚠️ SUPABASE: Anonymous sign-in completed in ${duration}ms but no session was returned`);
      }
      
      return data;
    });
  },

  async getSession() {
    const timestamp = getTimestamp();
    // DEBUG: console.log(`[${timestamp}] 🔑 SUPABASE: Getting current session`);
    
    return withRetry(async () => {
      const startTime = Date.now();
      const { data: { session }, error } = await supabase.auth.getSession();
      const duration = Date.now() - startTime;
      
      if (error) {
        console.error(`[${timestamp}] ❌ SUPABASE: Failed to get session after ${duration}ms - ${error.name}: ${error.message}`);
        throw error;
      }
      
      if (session) {
        // DEBUG: console.log(`[${timestamp}] ✅ SUPABASE: Successfully retrieved session in ${duration}ms. User ID: ${session.user.id.substring(0, 8)}...`);
      } else {
        // DEBUG: console.log(`[${timestamp}] ℹ️ SUPABASE: No active session found (${duration}ms)`);
      }
      
      return session;
    });
  },

  async signOut() {
    const timestamp = getTimestamp();
    console.log(`[${timestamp}] 🔑 SUPABASE: Signing out user`);
    
    return withRetry(async () => {
      const startTime = Date.now();
      const { error } = await supabase.auth.signOut();
      const duration = Date.now() - startTime;
      
      if (error) {
        console.error(`[${timestamp}] ❌ SUPABASE: Sign-out failed after ${duration}ms - ${error.name}: ${error.message}`);
        throw error;
      }
      
      console.log(`[${timestamp}] ✅ SUPABASE: Successfully signed out in ${duration}ms`);
    });
  },
}; 