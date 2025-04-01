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

// Read Vercel API endpoint from environment variable
const VERCEL_API_URL = process.env.EXPO_PUBLIC_VERCEL_API_URL;

// Check if the environment variable is set
if (!VERCEL_API_URL) {
  console.error("FATAL ERROR: EXPO_PUBLIC_VERCEL_API_URL environment variable is not set.");
  // Optionally throw an error or provide a default (though default is not recommended for APIs)
  // throw new Error("EXPO_PUBLIC_VERCEL_API_URL is not set"); 
}

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
      
      clearTimeout(timeoutId);

      const requestDuration = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] ⏱️ NAME_GENERATION: API response status: ${response.status}`);

      // --- Get raw text response ---
      const rawText = await response.text();
      console.log(`[${new Date().toISOString()}] 📄 NAME_GENERATION: Raw API Response Text:\n--- START RAW RESPONSE ---\n${rawText}\n--- END RAW RESPONSE ---`); // Log the raw text clearly

      // --- Attempt to parse JSON ---
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseError: any) { // Catch parsing error specifically
        console.error(`[${new Date().toISOString()}] ❌ NAME_GENERATION: JSON Parse Error: ${parseError.message}`);
        lastError = parseError; // Store the parsing error

        // Retry logic if parse error occurs
        if (retries < MAX_RETRIES) {
          const backoffTime = Math.pow(2, retries) * 1000;
          console.log(`[${new Date().toISOString()}] 🔄 NAME_GENERATION: Retrying due to parse error in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          retries++;
          continue; // Continue to the next iteration of the while loop
        } else {
          // Exhausted retries after parse error
          throw new Error(`Failed to parse API response as JSON after ${MAX_RETRIES + 1} attempts. Last error: ${parseError.message}`);
        }
      }

      // --- Process potentially successful response ---
      if (!response.ok) {
        console.error(`[${new Date().toISOString()}] ❌ NAME_GENERATION: API Error Response (Status: ${response.status}):`, data);
        lastError = new Error(`API returned status ${response.status}`); // Store API status error

        // Retry logic if API returned an error status
        if (retries < MAX_RETRIES) {
          const backoffTime = Math.pow(2, retries) * 1000;
          console.log(`[${new Date().toISOString()}] 🔄 NAME_GENERATION: Retrying due to API status ${response.status} in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          retries++;
          continue; // Continue to the next iteration of the while loop
        } else {
           // Exhausted retries after API error status
          throw new Error(`API request failed with status ${response.status} after ${MAX_RETRIES + 1} attempts. Response: ${JSON.stringify(data)}`);
        }
      }

      // --- If response.ok and JSON parsed successfully ---
      const names = data.names;
      console.log(`[${new Date().toISOString()}] ✅ NAME_GENERATION: Successfully parsed ${names?.length || 0} names from API response.`);

      if (!names || names.length === 0) {
        // Handle case where API returns success but no names (might need retry or specific error)
        console.warn(`[${new Date().toISOString()}] ⚠️ NAME_GENERATION: API returned successfully but with an empty 'names' array.`);
         lastError = new Error("API returned an empty names array");
         // Consider retrying here as well if appropriate
         if (retries < MAX_RETRIES) {
             const backoffTime = Math.pow(2, retries) * 1000;
             console.log(`[${new Date().toISOString()}] 🔄 NAME_GENERATION: Retrying due to empty names array in ${backoffTime}ms...`);
             await new Promise(resolve => setTimeout(resolve, backoffTime));
             retries++;
             continue; // Continue to the next iteration of the while loop
         } else {
             throw new Error(`API consistently returned empty names array after ${MAX_RETRIES + 1} attempts.`);
         }
      }

      // If the response contains a warning, log it
      if (data.warning) {
        console.warn(`[${new Date().toISOString()}] ⚠️ NAME_GENERATION: Server warning: ${data.warning}`);
      }

      console.log(`[${new Date().toISOString()}] ✅ NAME_GENERATION: Returning ${names.length} names.`);
      return names; // Success! Return the parsed names

    } catch (error: any) { // Catch general errors from fetch, timeouts, or re-thrown errors
      // This catch block now primarily handles errors thrown after exhausting retries or network errors
      lastError = error;
      console.error(`[${new Date().toISOString()}] ❌ NAME_GENERATION: Error caught in main try block: ${error.message}`);

       // Check if it's an AbortError (timeout) specifically for retry logic
       if (error?.name === 'AbortError') {
          console.error(`[${new Date().toISOString()}] ⏱️ NAME_GENERATION: API request timed out after ${API_TIMEOUT}ms`);
           if (retries < MAX_RETRIES) {
              const backoffTime = Math.pow(2, retries) * 1000;
               console.log(`[${new Date().toISOString()}] 🔄 NAME_GENERATION: Retrying due to timeout in ${backoffTime}ms...`);
               await new Promise(resolve => setTimeout(resolve, backoffTime));
               retries++;
               continue; // Continue to the next iteration of the while loop
           } else {
               lastError = new Error(`Request timed out after ${MAX_RETRIES + 1} attempts.`);
           }
       }
       // If it wasn't a timeout and we haven't exhausted retries yet (e.g., network error)
       else if (retries < MAX_RETRIES) {
          const backoffTime = Math.pow(2, retries) * 1000;
          console.log(`[${new Date().toISOString()}] 🔄 NAME_GENERATION: Retrying due to error (${error.message}) in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          retries++;
          continue; // Continue to the next iteration of the while loop
       }
       
       // If we fall through here, retries are exhausted for this error type
       console.log(`[${new Date().toISOString()}] 🚫 NAME_GENERATION: Exhausted retries. Breaking loop.`);
       break; // Break the while loop after exhausting retries for this error
    }
  } // End of while loop

  // --- After loop ---
  // If we exited the loop, it means all retries failed. Throw the last recorded error.
  const finalError = lastError || new Error('Unknown error after retries');
  console.error(`[${new Date().toISOString()}] ❌ NAME_GENERATION: All retry attempts failed. Last error: ${finalError.message}`);
  throw finalError;
}
