import { Platform } from 'react-native';
import { DEBUG_CONFIG } from './appConfig';

// Types for name generation
export interface NameGenerationParams {
  lastName?: string;
  gender?: 'boy' | 'girl' | 'unisex' | 'any';
  count?: number;
  searchQuery?: string;
  excludeNames?: string[];
}

export interface GeneratedName {
  firstName: string;
  lastName?: string;
  meaning: string;
  origin: string;
  gender: 'boy' | 'girl' | 'unisex' | 'any';
}

// Vercel API endpoint for OpenAI
const VERCEL_API_URL = 'https://backend-mjsg65b16-tidalflow1.vercel.app';
const API_TIMEOUT = 20000; // 20 seconds timeout (increased from 15)
const MAX_RETRIES = 2; // Maximum number of retry attempts

/**
 * Generate baby names using OpenAI via Vercel API
 */
export async function generateNames(params: NameGenerationParams): Promise<GeneratedName[]> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🚀 NAME_GENERATION: Starting OpenAI name generation request`);
  console.log(`[${timestamp}] 📊 NAME_GENERATION: Request parameters:`, {
    gender: params.gender,
    lastName: params.lastName || '(empty)',
    searchQuery: params.searchQuery || '(empty)',
    count: params.count,
    excludeNamesCount: params.excludeNames?.length || 0
  });
  
  let retries = 0;
  let lastError: Error | null = null;

  while (retries <= MAX_RETRIES) {
    try {
      const startTime = Date.now();
      console.log(`[${new Date().toISOString()}] 🔄 NAME_GENERATION: Attempt ${retries + 1}/${MAX_RETRIES + 1}`);
      
      // Create an AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      const response = await fetch(`${VERCEL_API_URL}/api/generate-names`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `ZuzuApp/${Platform.OS}`,
        },
        body: JSON.stringify({
          searchQuery: params.searchQuery || '',
          gender: params.gender || 'any',
          lastName: params.lastName || '',
          count: params.count || 35,
          excludeNames: params.excludeNames || []
        }),
        signal: controller.signal
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      const requestDuration = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] ⏱️ NAME_GENERATION: API response received in ${requestDuration}ms`);
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error(`[${new Date().toISOString()}] ❌ NAME_GENERATION: API Error Response:`, {
          status: response.status,
          statusText: response.statusText,
          body: JSON.stringify(data)
        });
        
        if (retries < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const backoffTime = Math.pow(2, retries) * 1000;
          console.log(`[${new Date().toISOString()}] 🔄 NAME_GENERATION: Retrying in ${backoffTime}ms (attempt ${retries + 1} of ${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          retries++;
          continue;
        }
        
        const errorMessage = `Failed to generate names with AI: ${response.status} - ${JSON.stringify(data)}`;
        console.error(`[${new Date().toISOString()}] ❌ NAME_GENERATION: ${errorMessage}`);
        throw new Error(errorMessage);
      }
      
      // Check if names array exists in the response
      const names = data.names;
      console.log(`[${new Date().toISOString()}] ✅ NAME_GENERATION: API Response: Generated ${names?.length || 0} names`);
      
      if (!names || names.length === 0) {
        if (retries < MAX_RETRIES) {
          console.log(`[${new Date().toISOString()}] 🔄 NAME_GENERATION: API returned empty names array. Retrying (attempt ${retries + 1} of ${MAX_RETRIES})...`);
          retries++;
          continue;
        } else {
          const errorMessage = "API consistently returned empty names array after multiple attempts";
          console.error(`[${new Date().toISOString()}] ❌ NAME_GENERATION: ${errorMessage}`);
          throw new Error(errorMessage);
        }
      }
      
      // If the response contains a warning, log it but still return the names
      if (data.warning) {
        console.warn(`[${new Date().toISOString()}] ⚠️ NAME_GENERATION: Server warning: ${data.warning}`);
      }
      
      // Use the names directly from the backend response
      const finalNames = names; 
      
      console.log(`[${new Date().toISOString()}] 📋 NAME_GENERATION: Using ${finalNames.length} names from backend:`, finalNames.map((n: GeneratedName) => n.firstName).join(', '));
      console.log(`[${new Date().toISOString()}] ✅ NAME_GENERATION: Successfully completed name generation`);
      
      return finalNames; // Return the unmodified list from backend
    } catch (error) {
      lastError = error as Error;
      
      // Handle abort errors (timeouts)
      if (lastError?.name === 'AbortError') { 
        console.error(`[${new Date().toISOString()}] ⏱️ NAME_GENERATION: API request timed out after ${API_TIMEOUT}ms`);
        
        if (retries < MAX_RETRIES) {
          console.log(`[${new Date().toISOString()}] 🔄 NAME_GENERATION: Request timed out. Retrying (attempt ${retries + 1} of ${MAX_RETRIES})...`);
          retries++;
          continue;
        }
      } else {
        console.error(`[${new Date().toISOString()}] ❌ NAME_GENERATION: Error in name generation:`, error);
        
        if (retries < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const backoffTime = Math.pow(2, retries) * 1000;
          console.log(`[${new Date().toISOString()}] 🔄 NAME_GENERATION: Retrying in ${backoffTime}ms (attempt ${retries + 1} of ${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          retries++;
          continue;
        }
      }
    }
  }

  // If we've exhausted retries, throw an error with details
  const finalError = lastError?.message || 'Unknown error';
  console.error(`[${new Date().toISOString()}] ❌ NAME_GENERATION: All retry attempts failed. Last error: ${finalError}`);
  throw new Error(`Failed to generate names after ${MAX_RETRIES + 1} attempts: ${finalError}`);
}

