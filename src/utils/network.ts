/**
 * Network utilities for handling connectivity checks and network operations
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEBUG_CONFIG } from './appConfig';
import { captureError, captureMessage } from './sentry';

// Network status cache
const NETWORK_STATUS_KEY = 'zuzu_network_status';
let cachedNetworkStatus = {
  isConnected: !DEBUG_CONFIG.FORCE_OFFLINE_MODE,
  lastChecked: Date.now()
};

// Load the cached network status
const loadCachedNetworkStatus = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(NETWORK_STATUS_KEY);
    if (jsonValue) {
      const parsed = JSON.parse(jsonValue);
      cachedNetworkStatus = {
        ...parsed,
        // If we're forcing offline mode, always override the cached status
        isConnected: DEBUG_CONFIG.FORCE_OFFLINE_MODE ? false : parsed.isConnected
      };
    }
  } catch (e) {
    captureError(e as Error, { context: 'load_cached_network_status' });
  }
};

// Initialize by loading cached status
loadCachedNetworkStatus();

// Check if the device is connected to the internet
export const checkConnectivity = async (
  targetUrl = 'https://www.google.com', 
  timeout = DEBUG_CONFIG.NETWORK_TIMEOUT
): Promise<boolean> => {
  // If debugging with forced offline mode, always return false
  if (DEBUG_CONFIG.FORCE_OFFLINE_MODE) {
    captureMessage('Forced offline mode enabled', 'info');
    return false;
  }
  
  // Check if we've checked recently (in the last 30 seconds)
  const CACHE_DURATION = 30 * 1000; // 30 seconds
  if (Date.now() - cachedNetworkStatus.lastChecked < CACHE_DURATION) {
    return cachedNetworkStatus.isConnected;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(targetUrl, {
      method: 'HEAD',
      signal: controller.signal,
      // We don't care about the response body, just if it's reachable
      cache: 'no-store',
      headers: {
        // Prevent caching
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    clearTimeout(timeoutId);
    
    // Update the cached status
    cachedNetworkStatus = {
      isConnected: response.ok,
      lastChecked: Date.now()
    };
    
    // Save to AsyncStorage
    await AsyncStorage.setItem(
      NETWORK_STATUS_KEY, 
      JSON.stringify(cachedNetworkStatus)
    );
    
    if (!response.ok) {
      captureMessage('Network check failed', 'warning');
    }
    
    return response.ok;
  } catch (error) {
    captureError(error as Error, { 
      context: 'check_connectivity',
      targetUrl,
      timeout
    });
    
    // Update the cached status
    cachedNetworkStatus = {
      isConnected: false,
      lastChecked: Date.now()
    };
    
    // Save to AsyncStorage
    await AsyncStorage.setItem(
      NETWORK_STATUS_KEY, 
      JSON.stringify(cachedNetworkStatus)
    );
    
    return false;
  }
};

// Retry a function with exponential backoff
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = DEBUG_CONFIG.MAX_RETRIES,
  initialDelay = DEBUG_CONFIG.RETRY_DELAY
): Promise<T> => {
  let attempt = 0;
  let delay = initialDelay;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (DEBUG_CONFIG.LOG_NETWORK_REQUESTS) {
        console.error(`Attempt ${attempt + 1} failed:`, error);
      }
      
      // If we're out of retries, throw the error
      if (attempt >= maxRetries - 1) {
        throw error;
      }
      
      // Wait before the next retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increase delay for next attempt (exponential backoff with jitter)
      delay = Math.min(delay * 2, 30000) * (0.9 + Math.random() * 0.2);
      attempt++;
    }
  }

  // This should never happen due to the throw above, but TypeScript requires it
  throw new Error('Max retries exceeded');
};

// Helper to determine if an error is a network error
export const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  
  // Check error message patterns that indicate network issues
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('connection') ||
      msg.includes('internet') ||
      msg.includes('offline') ||
      msg.includes('timeout') ||
      msg.includes('abort') ||
      msg.includes('fetch')
    );
  }
  
  return false;
}; 