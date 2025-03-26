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
const VERCEL_API_URL = 'https://backend-fyiajgvqe-tidalflow1.vercel.app';

/**
 * Generate baby names using OpenAI via Vercel API
 */
export async function generateNames(params: NameGenerationParams): Promise<GeneratedName[]> {
  try {
    console.log('Generating names with AI params:', params);
    
    const response = await fetch(VERCEL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `ZuzuApp/${Platform.OS}`,
      },
      body: JSON.stringify(params),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate names with AI: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`Generated ${data.names?.length || 0} names using AI`);
    
    return data.names || [];
  } catch (error) {
    console.error('Error generating names with AI:', error);
    throw error; // Rethrow the error to be handled by the caller
  }
}

/**
 * Provide mock names when in development or when the API fails
 */
function getMockNames(params: NameGenerationParams): GeneratedName[] {
  const { lastName = '', gender = 'any', count = 20 } = params;
  
  const nameOptions = [
    // Boy names
    { firstName: 'Oliver', meaning: 'Olive tree', origin: 'Latin', gender: 'boy' as const },
    { firstName: 'Liam', meaning: 'Strong-willed warrior', origin: 'Irish', gender: 'boy' as const },
    { firstName: 'Noah', meaning: 'Rest, comfort', origin: 'Hebrew', gender: 'boy' as const },
    { firstName: 'Ethan', meaning: 'Strong, enduring', origin: 'Hebrew', gender: 'boy' as const },
    { firstName: 'Lucas', meaning: 'Light', origin: 'Latin', gender: 'boy' as const },
    { firstName: 'Mason', meaning: 'Stone worker', origin: 'English', gender: 'boy' as const },
    
    // Girl names
    { firstName: 'Emma', meaning: 'Universal', origin: 'Germanic', gender: 'girl' as const },
    { firstName: 'Olivia', meaning: 'Olive tree', origin: 'Latin', gender: 'girl' as const },
    { firstName: 'Isabella', meaning: 'Pledged to God', origin: 'Hebrew', gender: 'girl' as const },
    { firstName: 'Sophia', meaning: 'Wisdom', origin: 'Greek', gender: 'girl' as const },
    { firstName: 'Charlotte', meaning: 'Free person', origin: 'French', gender: 'girl' as const },
    { firstName: 'Amelia', meaning: 'Work', origin: 'Germanic', gender: 'girl' as const },
    
    // Unisex names
    { firstName: 'Avery', meaning: 'Ruler of the elves', origin: 'English', gender: 'unisex' as const },
    { firstName: 'Jordan', meaning: 'Flowing down', origin: 'Hebrew', gender: 'unisex' as const },
    { firstName: 'Riley', meaning: 'Valiant', origin: 'Irish', gender: 'unisex' as const },
    { firstName: 'Morgan', meaning: 'Sea-born', origin: 'Welsh', gender: 'unisex' as const },
    { firstName: 'Taylor', meaning: 'Tailor', origin: 'English', gender: 'unisex' as const },
    { firstName: 'Alex', meaning: 'Defender', origin: 'Greek', gender: 'unisex' as const },
  ];

  // Filter names by gender if specified
  const filteredNames = gender === 'any' 
    ? nameOptions 
    : nameOptions.filter(name => name.gender === gender || name.gender === 'unisex');
    
  // Shuffle the filtered array to get random names
  const shuffled = [...filteredNames]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
  
  // Add lastName to each name if provided
  return shuffled.map(name => ({
    ...name,
    lastName: lastName || undefined,
  }));
} 