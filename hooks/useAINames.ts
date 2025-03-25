import { useState, useCallback } from 'react';
import { generateNames, NameGenerationParams, GeneratedName } from '../utils/openai';
import { FEATURES } from '../utils/appConfig';
import { useNameStatus } from './useNameStatus';

/**
 * Hook for generating baby names using AI via Vercel
 */
export function useAINames() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [generatedNames, setGeneratedNames] = useState<GeneratedName[]>([]);
  const { likedNames, maybeNames, dislikedNames } = useNameStatus();

  /**
   * Generate baby names using AI
   */
  const fetchNames = useCallback(async (params: NameGenerationParams) => {
    if (!FEATURES.AI_NAME_GENERATION) {
      console.log('AI name generation is disabled in feature flags');
      return [];
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get existing names to exclude
      const existingNames = [
        ...likedNames.map(n => n.firstName),
        ...maybeNames.map(n => n.firstName),
        ...dislikedNames.map(n => n.firstName),
      ];
      
      // Add excluded names to params
      const searchParams = {
        ...params,
        excludeNames: [...(params.excludeNames || []), ...existingNames],
      };
      
      // Generate names
      const names = await generateNames(searchParams);
      setGeneratedNames(names);
      return names;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error generating names');
      setError(error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [likedNames, maybeNames, dislikedNames]);

  return {
    fetchNames,
    generatedNames,
    isLoading,
    error,
    clearError: () => setError(null),
  };
} 