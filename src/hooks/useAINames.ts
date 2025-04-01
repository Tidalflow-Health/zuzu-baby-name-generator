import { useState } from 'react';
import { generateNames, NameGenerationParams, GeneratedName } from '../utils/openai';
import { useNameStatus } from './useNameStatus';

// Define the NameType interface
interface NameType {
  firstName: string;
  lastName?: string;
  meaning: string;
  origin: string;
  gender: 'boy' | 'girl' | 'unisex' | 'any';
}

/**
 * Hook for generating baby names using AI via Vercel
 */
interface AINamesParams {
  lastName: string;
  gender: 'boy' | 'girl' | 'any';
  searchQuery: string;
  count: number;
  excludeNames?: string[];
}

export function useAINames() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedNames, setGeneratedNames] = useState<GeneratedName[]>([]);
  const { likedNames, maybeNames, dislikedNames } = useNameStatus();

  /**
   * Generate baby names using AI
   */
  const fetchNames = async ({ lastName, gender, searchQuery, count, excludeNames = [] }: AINamesParams): Promise<NameType[]> => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 🚀 AI_NAMES: Starting name generation process`);
    console.log(`[${timestamp}] 📊 AI_NAMES: Request parameters:`, {
      lastName: lastName || '(none)',
      gender,
      searchQuery: searchQuery || '(none)',
      count,
      excludeNames: excludeNames.length > 0 ? excludeNames.slice(0, 5).concat(excludeNames.length > 5 ? [`... and ${excludeNames.length - 5} more`] : []) : '(none)',
      excludeNamesCount: excludeNames.length
    });

    setIsLoading(true);
    setError(null);

    try {
      const startTime = Date.now();
      console.log(`[${new Date().toISOString()}] ⏱️ AI_NAMES: Sending request to OpenAI service`);
      
      const names = await generateNames({
        lastName,
        gender,
        searchQuery,
        count,
        excludeNames,
      });

      const requestDuration = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] ✅ AI_NAMES: Successfully generated ${names.length} names in ${requestDuration}ms`);
      
      if (names.length > 0) {
        console.log(`[${new Date().toISOString()}] 📋 AI_NAMES: Sample names generated:`, 
          names.slice(0, 5).map(n => n.firstName).join(', ') + 
          (names.length > 5 ? ` and ${names.length - 5} more...` : '')
        );
      } else {
        console.log(`[${new Date().toISOString()}] ⚠️ AI_NAMES: No names were returned, but no error was thrown`);
      }

      setGeneratedNames(names);
      return names;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(`[${new Date().toISOString()}] ❌ AI_NAMES: Name generation failed:`, errorMessage);
      
      // Add more detailed diagnostics about the failure
      console.error(`[${new Date().toISOString()}] 🔍 AI_NAMES: Error details:`, {
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        message: errorMessage,
        stack: err instanceof Error ? err.stack : 'No stack trace available'
      });
      
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
      console.log(`[${new Date().toISOString()}] 🏁 AI_NAMES: Name generation process completed (success=${!error})`);
    }
  };

  return { fetchNames, isLoading, error, generatedNames };
} 