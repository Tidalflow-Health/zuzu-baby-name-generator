/**
 * Application configuration settings
 */

// Debug flags - set to true to force certain behaviors for testing
export const DEBUG_CONFIG = {
  // Force the app to behave as if it's offline 
  FORCE_OFFLINE_MODE: false,
  
  // Log network requests
  LOG_NETWORK_REQUESTS: true,
  
  // Timeout for network requests in milliseconds
  NETWORK_TIMEOUT: 10000,
  
  // Number of retry attempts for network operations
  MAX_RETRIES: 3,
  
  // Delay between retry attempts in milliseconds
  RETRY_DELAY: 1000,
  
  // Use mock AI data instead of actual API calls
  USE_MOCK_AI: true,
};

// Feature flags
export const FEATURES = {
  // Enable offline functionality
  OFFLINE_SUPPORT: true,
  
  // Enable name suggestion features
  NAME_SUGGESTIONS: true,
  
  // Enable AI-powered name generation
  AI_NAME_GENERATION: false,
}; 