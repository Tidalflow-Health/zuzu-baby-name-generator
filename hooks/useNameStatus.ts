import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useNames } from './useNames';
import { NameRecord } from '../utils/supabase';

// Storage keys
const LIKED_NAMES_KEY = 'zuzu_liked_names';
const MAYBE_NAMES_KEY = 'zuzu_maybe_names';
const DISLIKED_NAMES_KEY = 'zuzu_disliked_names';

type NameType = {
  firstName: string;
  lastName?: string;
  meaning: string;
  origin: string;
  gender: 'boy' | 'girl' | 'unisex' | 'any';
};

export function useNameStatus() {
  const [likedNames, setLikedNames] = useState<NameType[]>([]);
  const [maybeNames, setMaybeNames] = useState<NameType[]>([]);
  const [dislikedNames, setDislikedNames] = useState<NameType[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const { session, isOnline } = useAuth();
  const { fetchNames, createName, updateNameStatus } = useNames();

  // Enhanced load from AsyncStorage with better error handling and validation
  const loadNamesFromStorage = useCallback(async () => {
    console.log('Attempting to load names from AsyncStorage');
    
    const result = {
      liked: [] as NameType[],
      maybe: [] as NameType[],
      disliked: [] as NameType[]
    };

    try {
      // Load liked names with detailed error handling
      try {
        const likedNamesJSON = await AsyncStorage.getItem(LIKED_NAMES_KEY);
        
        if (likedNamesJSON) {
          try {
            const parsed = JSON.parse(likedNamesJSON);
            
            if (Array.isArray(parsed)) {
              result.liked = parsed;
              console.log(`Loaded ${parsed.length} liked names from storage`);
              
              // Log first few names for debugging
              if (parsed.length > 0) {
                console.log(`Sample liked names: ${parsed.slice(0, 3).map(n => n.firstName).join(', ')}...`);
              }
              
              setLikedNames(parsed);
            } else {
              console.error('Liked names JSON is not an array:', typeof parsed);
            }
          } catch (parseError) {
            console.error('Failed to parse liked names JSON:', parseError, 'JSON was:', likedNamesJSON.substring(0, 100) + '...');
          }
        } else {
          console.log('No liked names found in storage');
        }
      } catch (storageError) {
        console.error('Failed to load liked names from AsyncStorage:', storageError);
      }
      
      // Load maybe names with detailed error handling
      try {
        const maybeNamesJSON = await AsyncStorage.getItem(MAYBE_NAMES_KEY);
        
        if (maybeNamesJSON) {
          try {
            const parsed = JSON.parse(maybeNamesJSON);
            
            if (Array.isArray(parsed)) {
              result.maybe = parsed;
              console.log(`Loaded ${parsed.length} maybe names from storage`);
              
              // Log first few names for debugging
              if (parsed.length > 0) {
                console.log(`Sample maybe names: ${parsed.slice(0, 3).map(n => n.firstName).join(', ')}...`);
              }
              
              setMaybeNames(parsed);
            } else {
              console.error('Maybe names JSON is not an array:', typeof parsed);
            }
          } catch (parseError) {
            console.error('Failed to parse maybe names JSON:', parseError, 'JSON was:', maybeNamesJSON.substring(0, 100) + '...');
          }
        } else {
          console.log('No maybe names found in storage');
        }
      } catch (storageError) {
        console.error('Failed to load maybe names from AsyncStorage:', storageError);
      }
      
      // Load disliked names with detailed error handling
      try {
        const dislikedNamesJSON = await AsyncStorage.getItem(DISLIKED_NAMES_KEY);
        
        if (dislikedNamesJSON) {
          try {
            const parsed = JSON.parse(dislikedNamesJSON);
            
            if (Array.isArray(parsed)) {
              result.disliked = parsed;
              console.log(`Loaded ${parsed.length} disliked names from storage`);
              
              // Log first few names for debugging
              if (parsed.length > 0) {
                console.log(`Sample disliked names: ${parsed.slice(0, 3).map(n => n.firstName).join(', ')}...`);
              }
              
              setDislikedNames(parsed);
            } else {
              console.error('Disliked names JSON is not an array:', typeof parsed);
            }
          } catch (parseError) {
            console.error('Failed to parse disliked names JSON:', parseError, 'JSON was:', dislikedNamesJSON.substring(0, 100) + '...');
          }
        } else {
          console.log('No disliked names found in storage');
        }
      } catch (storageError) {
        console.error('Failed to load disliked names from AsyncStorage:', storageError);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to load names from storage (general error):', error);
      return result; // Return empty arrays
    }
  }, []);

  // Enhanced save to AsyncStorage with better error handling and validation
  const saveNamesToStorage = useCallback(async (
    liked: NameType[], 
    maybe: NameType[], 
    disliked: NameType[]
  ) => {
    try {
      // Validate input
      if (!Array.isArray(liked) || !Array.isArray(maybe) || !Array.isArray(disliked)) {
        throw new Error("Invalid array data provided to saveNamesToStorage");
      }

      // Convert to JSON and log sizes for debugging
      const likedJSON = JSON.stringify(liked);
      const maybeJSON = JSON.stringify(maybe);
      const dislikedJSON = JSON.stringify(disliked);

      console.log(`Saving to AsyncStorage - sizes: liked=${likedJSON.length}, maybe=${maybeJSON.length}, disliked=${dislikedJSON.length}`);

      // Store in AsyncStorage with proper error handling for each operation
      try {
        await AsyncStorage.setItem(LIKED_NAMES_KEY, likedJSON);
      } catch (error) {
        console.error('Failed to save liked names to AsyncStorage:', error);
        throw error; // Rethrow to be caught by the outer try/catch
      }

      try {
        await AsyncStorage.setItem(MAYBE_NAMES_KEY, maybeJSON);
      } catch (error) {
        console.error('Failed to save maybe names to AsyncStorage:', error);
        throw error;
      }

      try {
        await AsyncStorage.setItem(DISLIKED_NAMES_KEY, dislikedJSON);
      } catch (error) {
        console.error('Failed to save disliked names to AsyncStorage:', error);
        throw error;
      }

      console.log(`Successfully saved to storage: ${liked.length} liked, ${maybe.length} maybe, ${disliked.length} disliked names`);
      
      // Log first few names for debugging
      if (liked.length > 0) {
        console.log(`Sample liked names: ${liked.slice(0, 3).map(n => n.firstName).join(', ')}...`);
      }
      if (maybe.length > 0) {
        console.log(`Sample maybe names: ${maybe.slice(0, 3).map(n => n.firstName).join(', ')}...`);
      }
      if (disliked.length > 0) {
        console.log(`Sample disliked names: ${disliked.slice(0, 3).map(n => n.firstName).join(', ')}...`);
      }

      return true; // Return success
    } catch (error) {
      console.error('Failed to save names to storage (general error):', error);
      return false; // Return failure
    }
  }, []);

  // Sync with Supabase if possible, otherwise just load from local storage
  const syncWithSupabase = useCallback(async () => {
    if (!session || !isOnline) {
      // If not authenticated or not online, just load from local storage
      await loadNamesFromStorage();
      return;
    }
    
    try {
      console.log('Syncing names with Supabase');
      // Fetch names from Supabase
      const supabaseNames = await fetchNames();
      
      // Group by status
      const liked = supabaseNames
        .filter((n: NameRecord) => n.status === 'liked')
        .map(convertToNameType);
      
      const maybe = supabaseNames
        .filter((n: NameRecord) => n.status === 'maybe')
        .map(convertToNameType);
      
      const disliked = supabaseNames
        .filter((n: NameRecord) => n.status === 'disliked')
        .map(convertToNameType);
      
      console.log(`Synced from Supabase: ${liked.length} liked, ${maybe.length} maybe, ${disliked.length} disliked names`);
      
      // Load local names too - we'll merge them
      const localNames = await loadNamesFromStorage();
      
      // Merge Supabase names with local names (keeping all unique names)
      const mergedLiked = mergeNameArrays(liked, localNames.liked);
      const mergedMaybe = mergeNameArrays(maybe, localNames.maybe);
      const mergedDisliked = mergeNameArrays(disliked, localNames.disliked);
      
      // Update state
      setLikedNames(mergedLiked);
      setMaybeNames(mergedMaybe);
      setDislikedNames(mergedDisliked);
      
      // Update local storage with merged lists
      await saveNamesToStorage(mergedLiked, mergedMaybe, mergedDisliked);
    } catch (error) {
      console.error('Failed to sync with Supabase:', error);
      // Fall back to local storage only
      await loadNamesFromStorage();
    }
  }, [fetchNames, loadNamesFromStorage, saveNamesToStorage, session, isOnline]);

  // Helper to merge name arrays and remove duplicates
  const mergeNameArrays = (arr1: NameType[], arr2: NameType[]): NameType[] => {
    const combined = [...arr1];
    
    for (const name of arr2) {
      // Check if name already exists in array using case-insensitive comparison
      // and proper handling of null/undefined lastName
      const exists = combined.some(n => 
        n.firstName.toLowerCase() === name.firstName.toLowerCase() && 
        ((!n.lastName && !name.lastName) || 
         (n.lastName?.toLowerCase() === name.lastName?.toLowerCase()))
      );
      
      if (!exists) {
        combined.push(name);
      }
    }
    
    return combined;
  };

  const saveNameStatus = useCallback(async (name: NameType, status: 'liked' | 'maybe' | 'disliked') => {
    // Validate input
    if (!name || !name.firstName) {
      console.error(`saveNameStatus called with invalid name object:`, name);
      throw new Error("Invalid name object provided to saveNameStatus");
    }

    // Log detailed name info
    console.log(`saveNameStatus called for name: "${name.firstName}${name.lastName ? ' ' + name.lastName : ''}" (${name.gender}) with status: ${status}`);
    
    let updatedLikedNames = [...likedNames];
    let updatedMaybeNames = [...maybeNames];
    let updatedDislikedNames = [...dislikedNames];
    
    // Helper function to check if two names are the same
    const isSameName = (a: NameType, b: NameType) => {
      return a.firstName.toLowerCase() === b.firstName.toLowerCase() && 
        ((!a.lastName && !b.lastName) || (a.lastName?.toLowerCase() === b.lastName?.toLowerCase()));
    };
    
    // Check if the name already exists in any lists
    const existsInLiked = updatedLikedNames.some(n => isSameName(n, name));
    const existsInMaybe = updatedMaybeNames.some(n => isSameName(n, name));
    const existsInDisliked = updatedDislikedNames.some(n => isSameName(n, name));
    
    if (existsInLiked || existsInMaybe || existsInDisliked) {
      console.log(`Name "${name.firstName}" already exists in lists: ${existsInLiked ? 'liked ' : ''}${existsInMaybe ? 'maybe ' : ''}${existsInDisliked ? 'disliked' : ''}`);
    }
    
    // Remove from all lists to prevent duplicates
    updatedLikedNames = updatedLikedNames.filter(n => !isSameName(n, name));
    updatedMaybeNames = updatedMaybeNames.filter(n => !isSameName(n, name));
    updatedDislikedNames = updatedDislikedNames.filter(n => !isSameName(n, name));
    
    // Add to appropriate list
    if (status === 'liked') {
      updatedLikedNames.push(name);
      console.log(`Added "${name.firstName}" to liked list. New count: ${updatedLikedNames.length}`);
    } else if (status === 'maybe') {
      updatedMaybeNames.push(name);
      console.log(`Added "${name.firstName}" to maybe list. New count: ${updatedMaybeNames.length}`);
    } else if (status === 'disliked') {
      updatedDislikedNames.push(name);
      console.log(`Added "${name.firstName}" to disliked list. New count: ${updatedDislikedNames.length}`);
    }
    
    // Update state immediately
    setLikedNames(updatedLikedNames);
    setMaybeNames(updatedMaybeNames);
    setDislikedNames(updatedDislikedNames);
    
    try {
      // Save to AsyncStorage right away
      const saveResult = await saveNamesToStorage(updatedLikedNames, updatedMaybeNames, updatedDislikedNames);
      
      if (!saveResult) {
        console.error(`Failed to save name "${name.firstName}" to AsyncStorage`);
      }
      
      // If authenticated and online, sync with Supabase
      if (session && isOnline) {
        try {
          console.log(`Attempting to sync "${name.firstName}" with Supabase...`);
          
          // Check if name already exists in Supabase
          const allNames = await fetchNames();
          
          // Find by first name and last name (if present)
          const existingName = allNames.find(
            (n: NameRecord) => 
              n.name.toLowerCase() === name.firstName.toLowerCase() && 
              ((n.last_name === null && !name.lastName) || 
               (n.last_name !== null && name.lastName && n.last_name.toLowerCase() === name.lastName.toLowerCase()))
          );
          
          if (existingName) {
            // Update existing name
            console.log(`Updating existing name "${name.firstName}" in Supabase to status: ${status}`);
            await updateNameStatus(existingName.id, status);
          } else {
            // Create new name
            console.log(`Creating new name "${name.firstName}" in Supabase with status: ${status}`);
            await createName({
              name: name.firstName,
              last_name: name.lastName || null,
              meaning: name.meaning,
              origin: name.origin,
              status,
              search_context: { gender: name.gender },
            });
          }
          console.log(`Successfully synced "${name.firstName}" with Supabase`);
        } catch (error) {
          // If Supabase sync fails, that's okay - we already saved to local storage
          console.error(`Failed to sync "${name.firstName}" with Supabase, but saved locally:`, error);
        }
      } else {
        console.log(`Device ${isOnline ? 'online' : 'offline'}, session ${session ? 'active' : 'inactive'} - saved "${name.firstName}" to local storage only`);
      }
      
      return true; // Return success
    } catch (error) {
      console.error(`Critical error saving name "${name.firstName}" status:`, error);
      throw error; // Rethrow to be caught by the caller
    }
  }, [likedNames, maybeNames, dislikedNames, session, isOnline, fetchNames, updateNameStatus, createName, saveNamesToStorage]);
  
  // Initialize data on mount and when session changes
  useEffect(() => {
    const initialize = async () => {
      console.log('Initializing name status data');
      await syncWithSupabase();
      setIsInitialized(true);
    };
    
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, syncWithSupabase]);
  
  // Re-sync when online status changes (if we were offline and came back online)
  useEffect(() => {
    if (isOnline && isInitialized && session) {
      syncWithSupabase();
    }
  }, [isOnline, isInitialized, session, syncWithSupabase]);
  
  // Convert Supabase record to NameType
  function convertToNameType(record: NameRecord): NameType {
    return {
      firstName: record.name,
      lastName: record.last_name || undefined,
      meaning: record.meaning,
      origin: record.origin,
      gender: (record.search_context?.gender as 'boy' | 'girl' | 'unisex' | 'any') || 'any',
    };
  }

  return {
    likedNames,
    maybeNames,
    dislikedNames,
    saveNameStatus,
    isInitialized,
  };
} 