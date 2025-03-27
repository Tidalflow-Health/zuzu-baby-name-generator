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
    console.log("=== Starting AI Name Generation ===");
    console.log("Request parameters:", {
      lastName,
      gender,
      searchQuery,
      count,
      excludeNamesCount: excludeNames.length,
      excludeNames
    });

    setIsLoading(true);
    setError(null);

    try {
      const names = await generateNames({
        lastName,
        gender,
        searchQuery,
        count,
        excludeNames,
      });

      console.log(`Successfully generated ${names.length} names`);
      console.log("Generated names:", names.map(n => n.firstName));
      console.log("=== AI Name Generation Complete ===");

      return names;
    } catch (err) {
      console.error("Error in AI name generation:", err);
      setError(err instanceof Error ? err.message : 'Failed to generate names');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return { fetchNames, isLoading, error };
} 