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
      // Create a controller to handle timeouts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
      
      // Add the signal to the options
      const fetchOptions = {
        ...options,
        signal: controller.signal,
      };
      
      return fetch(url, fetchOptions)
        .then(response => {
          clearTimeout(timeoutId);
          return response;
        })
        .catch(error => {
          clearTimeout(timeoutId);
          console.error('Fetch error:', error);
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
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (error instanceof Error && 
         (error.message.includes('Network request failed') || 
          error.message.includes('Failed to fetch'))) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        continue;
      }
      // Don't retry for non-network errors
      throw error;
    }
  }
  throw lastError;
}

// Helper functions for name operations
export const nameOperations = {
  async createName(nameData: Omit<NameRecord, 'id' | 'created_at' | 'user_id'>) {
    return withRetry(async () => {
      // Get the current user ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found. User must be authenticated to create a name.');
      }

      const userId = session.user.id;
      
      // Insert with the user_id explicitly set
      const { data, error } = await supabase
        .from('name_records')
        .insert([{ ...nameData, user_id: userId }])
        .select()
        .single();
      
      if (error) {
        // Check specifically for RLS error
        if (error.code === '42501' && error.message.includes('policy')) {
          console.error('RLS policy violation. Make sure RLS policies are configured correctly in Supabase.');
        }
        throw error;
      }
      return data;
    });
  },

  async updateNameStatus(nameId: string, status: NameRecord['status']) {
    return withRetry(async () => {
      // Get the current user ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found. User must be authenticated to update a name.');
      }
      
      const { data, error } = await supabase
        .from('name_records')
        .update({ status, user_id: session.user.id })
        .eq('id', nameId)
        .select()
        .single();
      
      if (error) {
        // Check specifically for RLS error
        if (error.code === '42501' && error.message.includes('policy')) {
          console.error('RLS policy violation. Make sure RLS policies are configured correctly in Supabase.');
        }
        throw error;
      }
      return data;
    });
  },

  async getUserNames(status?: NameRecord['status']) {
    return withRetry(async () => {
      // Get the current user ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found. User must be authenticated to get names.');
      }
      
      const query = supabase
        .from('name_records')
        .select('*')
        .eq('user_id', session.user.id); // Filter by the current user's ID
      
      if (status) {
        query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) {
        // Check specifically for RLS error
        if (error.code === '42501' && error.message.includes('policy')) {
          console.error('RLS policy violation. Make sure RLS policies are configured correctly in Supabase.');
        }
        throw error;
      }
      return data;
    });
  },
};

// Auth helper functions
export const authOperations = {
  async signInAnonymously() {
    return withRetry(async () => {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      return data;
    });
  },

  async getSession() {
    return withRetry(async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    });
  },

  async signOut() {
    return withRetry(async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    });
  },
}; 