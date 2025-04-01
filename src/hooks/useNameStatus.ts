import { useState, useEffect, useCallback, useRef } from 'react';
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

// Helper function to get a formatted timestamp
const getTimestamp = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

// Define loading states
export type LoadingState = 'idle' | 'loading' | 'ready' | 'error';

// Define NameMap type if not already defined in scope (adjust if needed)
type NameMap = { [key: string]: { status: NameStatus; lastName?: string | null } };

// Type for the result of the wrapped promise
type PromiseResult =
  | { status: 'fulfilled'; value: NameRecord; nameInput: NameInfo }
  | { status: 'rejected'; reason: any; nameInput: NameInfo };

type NameStatus = NameRecord['status'];
type NameInfo = Omit<NameRecord, 'id' | 'created_at' | 'user_id'>;

export function useNameStatus() {
  const [likedNames, setLikedNames] = useState<NameType[]>([]);
  const [maybeNames, setMaybeNames] = useState<NameType[]>([]);
  const [dislikedNames, setDislikedNames] = useState<NameType[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle'); 
  const isInitializingRef = useRef(false); // Prevent concurrent runs of initialize()
  const hasInitializedEver = useRef(false); // Prevent running initialize more than once per lifecycle
  const isSyncScheduledOrRunning = useRef(false); // Prevent concurrent/rapid sync calls
  const { session, isOnline } = useAuth();
  const { fetchNames, createName, updateNameStatus } = useNames();

  // Enhanced load from AsyncStorage with better error handling and validation
  // THIS FUNCTION NOW ONLY *RETURNS* DATA, IT DOES NOT SET STATE.
  const loadNamesFromStorage = useCallback(async () => {
    const timestamp = getTimestamp();
    // DEBUG: console.log(`[${timestamp}] 📋 NAME_STATUS: Attempting to load names from AsyncStorage`);
    
    const result = {
      liked: [] as NameType[],
      maybe: [] as NameType[],
      disliked: [] as NameType[]
    };

    try {
      // Load liked names
      try {
        const likedNamesJSON = await AsyncStorage.getItem(LIKED_NAMES_KEY);
        if (likedNamesJSON) {
          try {
            const parsed = JSON.parse(likedNamesJSON);
            if (Array.isArray(parsed)) {
              result.liked = parsed; // Store in result
              // DEBUG: console.log(`[${timestamp}] 📋 NAME_STATUS: Loaded ${parsed.length} liked names from storage`);
            } else {
              console.error(`[${timestamp}] ❌ NAME_STATUS: Liked names JSON is not an array:`, typeof parsed);
            }
          } catch (parseError) {
            console.error(`[${timestamp}] ❌ NAME_STATUS: Failed to parse liked names JSON:`, parseError);
          }
        } else {
          // DEBUG: console.log(`[${timestamp}] 📋 NAME_STATUS: No liked names found in storage`);
        }
      } catch (storageError) {
        console.error(`[${timestamp}] ❌ NAME_STATUS: Failed to load liked names from AsyncStorage:`, storageError);
      }
      
      // Load maybe names
      try {
        const maybeNamesJSON = await AsyncStorage.getItem(MAYBE_NAMES_KEY);
        if (maybeNamesJSON) {
          try {
            const parsed = JSON.parse(maybeNamesJSON);
            if (Array.isArray(parsed)) {
              result.maybe = parsed; // Store in result
              // DEBUG: console.log(`[${timestamp}] 📋 NAME_STATUS: Loaded ${parsed.length} maybe names from storage`);
            } else {
              console.error(`[${timestamp}] ❌ NAME_STATUS: Maybe names JSON is not an array:`, typeof parsed);
            }
          } catch (parseError) {
            console.error(`[${timestamp}] ❌ NAME_STATUS: Failed to parse maybe names JSON:`, parseError);
          }
        } else {
          // DEBUG: console.log(`[${timestamp}] 📋 NAME_STATUS: No maybe names found in storage`);
        }
      } catch (storageError) {
        console.error(`[${timestamp}] ❌ NAME_STATUS: Failed to load maybe names from AsyncStorage:`, storageError);
      }
      
      // Load disliked names
      try {
        const dislikedNamesJSON = await AsyncStorage.getItem(DISLIKED_NAMES_KEY);
        if (dislikedNamesJSON) {
          try {
            const parsed = JSON.parse(dislikedNamesJSON);
            if (Array.isArray(parsed)) {
              result.disliked = parsed; // Store in result
              // DEBUG: console.log(`[${timestamp}] 📋 NAME_STATUS: Loaded ${parsed.length} disliked names from storage`);
            } else {
              console.error(`[${timestamp}] ❌ NAME_STATUS: Disliked names JSON is not an array:`, typeof parsed);
            }
          } catch (parseError) {
            console.error(`[${timestamp}] ❌ NAME_STATUS: Failed to parse disliked names JSON:`, parseError);
          }
        } else {
          // DEBUG: console.log(`[${timestamp}] 📋 NAME_STATUS: No disliked names found in storage`);
        }
      } catch (storageError) {
        console.error(`[${timestamp}] ❌ NAME_STATUS: Failed to load disliked names from AsyncStorage:`, storageError);
      }
      
      // Return the loaded data object
      return result;
    } catch (error) {
      console.error(`[${timestamp}] ❌ NAME_STATUS: Failed to load names from storage (general error):`, error);
      return result; // Return empty arrays on general error
    }
  }, []);

  // Enhanced save to AsyncStorage with better error handling and validation
  const saveNamesToStorage = useCallback(async (
    liked: NameType[], 
    maybe: NameType[], 
    disliked: NameType[]
  ) => {
    const timestamp = getTimestamp();
    try {
      // Validate input
      if (!Array.isArray(liked) || !Array.isArray(maybe) || !Array.isArray(disliked)) {
        throw new Error("Invalid array data provided to saveNamesToStorage");
      }

      // Convert to JSON and log sizes for debugging
      const likedJSON = JSON.stringify(liked);
      const maybeJSON = JSON.stringify(maybe);
      const dislikedJSON = JSON.stringify(disliked);

      // DEBUG: console.log(`[${timestamp}] 💾 NAME_STATUS: Saving to AsyncStorage - sizes: liked=${likedJSON.length}, maybe=${maybeJSON.length}, disliked=${dislikedJSON.length}`);

      // Store in AsyncStorage with proper error handling for each operation
      try {
        await AsyncStorage.setItem(LIKED_NAMES_KEY, likedJSON);
      } catch (error) {
        console.error(`[${timestamp}] ❌ NAME_STATUS: Failed to save liked names to AsyncStorage:`, error);
        throw error; // Rethrow to be caught by the outer try/catch
      }

      try {
        await AsyncStorage.setItem(MAYBE_NAMES_KEY, maybeJSON);
      } catch (error) {
        console.error(`[${timestamp}] ❌ NAME_STATUS: Failed to save maybe names to AsyncStorage:`, error);
        throw error;
      }

      try {
        await AsyncStorage.setItem(DISLIKED_NAMES_KEY, dislikedJSON);
      } catch (error) {
        console.error(`[${timestamp}] ❌ NAME_STATUS: Failed to save disliked names to AsyncStorage:`, error);
        throw error;
      }

      // DEBUG: console.log(`[${timestamp}] ✅ NAME_STATUS: Successfully saved to storage: ${liked.length} liked, ${maybe.length} maybe, ${disliked.length} disliked names`);
      
      // Log first few names for debugging
      // if (liked.length > 0) {
      //   console.log(`[${timestamp}] 📋 NAME_STATUS: Sample liked names: ${liked.slice(0, 3).map(n => n.firstName).join(', ')}...`);
      // }
      // if (maybe.length > 0) {
      //   console.log(`[${timestamp}] 📋 NAME_STATUS: Sample maybe names: ${maybe.slice(0, 3).map(n => n.firstName).join(', ')}...`);
      // }
      // if (disliked.length > 0) {
      //   console.log(`[${timestamp}] 📋 NAME_STATUS: Sample disliked names: ${disliked.slice(0, 3).map(n => n.firstName).join(', ')}...`);
      // }

      return true; // Return success
    } catch (error) {
      console.error(`[${timestamp}] ❌ NAME_STATUS: Failed to save names to storage (general error):`, error);
      return false; // Return failure
    }
  }, []);

  // Convert Supabase record to NameType
  function convertToNameType(record: NameRecord): NameType {
    return {
      firstName: record.name,
      lastName: record.last_name || undefined,
      meaning: record.meaning || '',
      origin: record.origin || '',
      gender: (record.search_context?.gender as NameType['gender']) || 'any',
    };
  }

  // Sync with Supabase: Fetch Supabase data, MERGE with local, update state, save to storage.
  const syncWithSupabase = useCallback(async () => {
    const timestamp = getTimestamp();
    
    // Debounce: Check if sync is already scheduled or running
    if (isSyncScheduledOrRunning.current) {
       console.log(`[${timestamp}] 🔄 NAME_STATUS: Sync already in progress or scheduled. Skipping.`);
       return false; // Indicate skipped sync
    }
    
    if (!session || !isOnline) {
      // DEBUG: console.log(`[${timestamp}] ℹ️ NAME_STATUS: Skipping Supabase sync (Session: ${!!session}, Online: ${isOnline})`);
      return false;
    }

    isSyncScheduledOrRunning.current = true; // Set flag: Sync starting
    console.log(`[${timestamp}] 🔄 NAME_STATUS: Starting Supabase MERGE sync...`);
    const startTime = Date.now();
    let success = true;
    let stateDidChange = false;

    try {
      // --- Step 1: Fetch names from Supabase ---
      const supabaseNames = await fetchNames();
      // DEBUG: console.log(`[${timestamp}] ☁️ NAME_STATUS: Fetched ${supabaseNames.length} names from Supabase`);

      // --- Step 2: Process Supabase names into maps for efficient lookup ---
      const supabaseLikedMap = new Map<string, NameType>();
      const supabaseMaybeMap = new Map<string, NameType>();
      const supabaseDislikedMap = new Map<string, NameType>();
      const allSupabaseIds = new Set<string>();

      supabaseNames.forEach((sName: NameRecord) => {
        const nameObj = convertToNameType(sName);
        const nameId = `${nameObj.firstName.toLowerCase()}-${(nameObj.lastName || '').toLowerCase()}`;
        allSupabaseIds.add(nameId);
        if (sName.status === 'liked') supabaseLikedMap.set(nameId, nameObj);
        else if (sName.status === 'maybe') supabaseMaybeMap.set(nameId, nameObj);
        else if (sName.status === 'disliked') supabaseDislikedMap.set(nameId, nameObj);
      });
      // DEBUG: console.log(`[${timestamp}] 🔄 NAME_STATUS: Processed Supabase data (liked=${supabaseLikedMap.size}, maybe=${supabaseMaybeMap.size}, disliked=${supabaseDislikedMap.size})`);

      // --- Step 3: Identify Local-Only Names ---
      // Access current state directly here before any potential async operations
      const currentLocalLiked = likedNames;
      const currentLocalMaybe = maybeNames;
      const currentLocalDisliked = dislikedNames; 
      
      const localOnlyLiked = currentLocalLiked.filter(n => !allSupabaseIds.has(`${n.firstName.toLowerCase()}-${(n.lastName || '').toLowerCase()}`));
      const localOnlyMaybe = currentLocalMaybe.filter(n => !allSupabaseIds.has(`${n.firstName.toLowerCase()}-${(n.lastName || '').toLowerCase()}`));
      const localOnlyDisliked = currentLocalDisliked.filter(n => !allSupabaseIds.has(`${n.firstName.toLowerCase()}-${(n.lastName || '').toLowerCase()}`));
      
      // Combine local-only names into a list for upload, initially allowing duplicates
      const allLocalOnly: { name: NameType; status: NameStatus }[] = [
        ...localOnlyLiked.map(n => ({ name: n, status: 'liked' as NameStatus })),
        ...localOnlyMaybe.map(n => ({ name: n, status: 'maybe' as NameStatus })),
        ...localOnlyDisliked.map(n => ({ name: n, status: 'disliked' as NameStatus })),
      ];

      // De-duplicate namesToUpload based on priority: Liked > Maybe > Disliked
      const uniqueNamesToUploadMap = new Map<string, { name: NameType; status: NameStatus }>();
      const getPriority = (status: NameStatus): number => {
        if (status === 'liked') return 3;
        if (status === 'maybe') return 2;
        if (status === 'disliked') return 1;
        return 0;
      };

      allLocalOnly.forEach(item => {
        const nameId = `${item.name.firstName.toLowerCase()}-${(item.name.lastName || '').toLowerCase()}`;
        const existing = uniqueNamesToUploadMap.get(nameId);
        if (!existing || getPriority(item.status) > getPriority(existing.status)) {
          uniqueNamesToUploadMap.set(nameId, item);
        }
      });

      // Final list to upload contains only unique names with highest priority status
      const namesToUpload = Array.from(uniqueNamesToUploadMap.values());
      
      // DEBUG: console.log(`[${timestamp}] 🔄 NAME_STATUS: Found ${allLocalOnly.length} raw local-only names. Uploading ${namesToUpload.length} unique names after prioritization.`);

      let uploadsAttempted = namesToUpload.length;
      let successfulUploadsCount = 0;
      let uploadedNamesMap: NameMap = {};

      // --- Step 4: Upload Local-Only Names ---
      if (namesToUpload.length > 0) {
        // INFO: Log only when starting upload batch
        console.log(`[${timestamp}] 📤 NAME_STATUS: Uploading ${namesToUpload.length} local-only names...`);

        // Use Promise.all with wrapped promises
        const uploadPromises = namesToUpload.map((nameInfo: { name: NameType; status: NameStatus }) => {
          // Construct the single object argument for createName
          const nameData: NameInfo = {
            name: nameInfo.name.firstName,
            last_name: nameInfo.name.lastName || null,
            meaning: nameInfo.name.meaning || '',
            origin: nameInfo.name.origin || '',
            status: nameInfo.status,
            search_context: { gender: nameInfo.name.gender },
          };
          return createName(nameData) // Pass the single object
            .then(createdRecord => {
              // Check if createdRecord is actually returned (should always be on success)
              if (createdRecord) {
                 return {
                   status: 'fulfilled' as const,
                   value: createdRecord, // This is the created NameRecord
                   nameInput: nameData // Pass input data for reference on failure/success
                 };
              } else {
                // Should not happen if createName throws on failure, but handle defensively
                 console.error(`[${getTimestamp()}] ❌ NAME_STATUS: createName returned null/undefined for ${nameData.name}, treating as rejection.`);
                 return {
                     status: 'rejected' as const,
                     reason: new Error('createName returned null or undefined'),
                     nameInput: nameData // Pass input data for reference
                 };
              }
            })
            .catch(reason => ({
              status: 'rejected' as const,
              reason: reason,
              nameInput: nameData // Pass input data for reference
            }));
        });

        // Wait for all wrapped promises to resolve
        const uploadResults: PromiseResult[] = await Promise.all(uploadPromises);

        uploadResults.forEach((result: PromiseResult) => {
          const inputName = result.nameInput.name; // Get name from the input data
          if (result.status === 'fulfilled' && result.value) {
            // Successfully uploaded, add to our map for merging later
            const createdRecord = result.value; // The full NameRecord returned by createName
            // Use the name from the *created record* as the key
            const nameKey = `${createdRecord.name.toLowerCase()}-${(createdRecord.last_name || '').toLowerCase()}`;
            uploadedNamesMap[nameKey] = { status: createdRecord.status, lastName: createdRecord.last_name };
            successfulUploadsCount++;
            // DEBUG: console.log(`[${timestamp}] ✅ NAME_STATUS: Upload fulfilled for name: ${inputName}`);
          } else if (result.status === 'rejected') {
            // Upload failed
            success = false; // Mark overall sync as potentially failed
            console.error(
              `[${timestamp}] ❌ NAME_STATUS: Upload rejected for name: ${inputName}. Reason: ${result.reason}`
            );
          } else {
            // Handle unexpected cases
             // DEBUG: console.warn(`[${timestamp}] ⚠️ NAME_STATUS: Unexpected result status for name ${inputName}: ${JSON.stringify(result)}`);
          }
        });
        // INFO: Log only summary after batch completes
        console.log(`[${timestamp}] 📤 NAME_STATUS: Upload process completed. ${successfulUploadsCount}/${uploadsAttempted} successful.`);
      }

      // --- Step 5: Merge Supabase data and successfully uploaded local data ---
      const finalLikedMap = new Map(supabaseLikedMap);
      const finalMaybeMap = new Map(supabaseMaybeMap);
      const finalDislikedMap = new Map(supabaseDislikedMap);

      Object.entries(uploadedNamesMap).forEach(([nameKey, { status, lastName }]) => {
        // Find the original NameType data used for upload to populate the map fully
        // This assumes nameKey uniquely identifies the uploaded name
        const originalUpload = namesToUpload.find(nu => `${nu.name.firstName.toLowerCase()}-${(nu.name.lastName || '').toLowerCase()}` === nameKey);
        if (originalUpload) {
           const nameObj = originalUpload.name; // Use the original NameType
            if (status === 'liked') {
              finalLikedMap.set(nameKey, nameObj);
            } else if (status === 'maybe') {
              finalMaybeMap.set(nameKey, nameObj);
            } else if (status === 'disliked') {
              finalDislikedMap.set(nameKey, nameObj);
            }
        } else {
            console.warn(`[${timestamp}] ⚠️ NAME_STATUS: Could not find original upload data for uploaded name key: ${nameKey}`);
        }
      });
      // DEBUG: console.log(`[${timestamp}] 🏁 NAME_STATUS: Final merged maps created (liked=${finalLikedMap.size}, maybe=${finalMaybeMap.size}, disliked=${finalDislikedMap.size})`);

      // --- Step 6: Compare and Update State/Storage ---
      stateDidChange = false; // Reset flag before comparison
      
      setLikedNames(currentLiked => {
         if (currentLiked.length !== finalLikedMap.size || 
             currentLiked.some(n => !finalLikedMap.has(`${n.firstName.toLowerCase()}-${(n.lastName || '').toLowerCase()}`)))
         {
             // DEBUG: console.log(`[${timestamp}] ⚠️ NAME_STATUS: Liked names differ after merge. Updating state.`);
             stateDidChange = true;
             return Array.from(finalLikedMap.values());
         }
         return currentLiked; // No change needed
      });
      setMaybeNames(currentMaybe => {
         if (currentMaybe.length !== finalMaybeMap.size || 
             currentMaybe.some(n => !finalMaybeMap.has(`${n.firstName.toLowerCase()}-${(n.lastName || '').toLowerCase()}`)))
         {
             // DEBUG: console.log(`[${timestamp}] ⚠️ NAME_STATUS: Maybe names differ after merge. Updating state.`);
             stateDidChange = true;
             return Array.from(finalMaybeMap.values());
         }
         return currentMaybe; // No change needed
      });
       setDislikedNames(currentDisliked => {
         if (currentDisliked.length !== finalDislikedMap.size || 
             currentDisliked.some(n => !finalDislikedMap.has(`${n.firstName.toLowerCase()}-${(n.lastName || '').toLowerCase()}`)))
         {
             // DEBUG: console.log(`[${timestamp}] ⚠️ NAME_STATUS: Disliked names differ after merge. Updating state.`);
             stateDidChange = true;
             return Array.from(finalDislikedMap.values());
         }
         return currentDisliked; // No change needed
      });

      // Save back to AsyncStorage ONLY if the state actually changed during the merge/comparison
      if (stateDidChange) {
          const finalLiked = Array.from(finalLikedMap.values());
          const finalMaybe = Array.from(finalMaybeMap.values());
          const finalDisliked = Array.from(finalDislikedMap.values());
          await saveNamesToStorage(finalLiked, finalMaybe, finalDisliked);
          // DEBUG: console.log(`[${timestamp}] ✅ NAME_STATUS: Merged state saved back to local storage.`);
      } else {
          // DEBUG: console.log(`[${timestamp}] ℹ️ NAME_STATUS: No state changes needed after merge. Local storage not updated.`);
      }

      const duration = Date.now() - startTime;
      console.log(`[${timestamp}] ✅ NAME_STATUS: Supabase MERGE sync completed in ${duration}ms (Success: ${success}, StateChanged: ${stateDidChange})`);

    } catch (error) {
      success = false;
      const duration = Date.now() - startTime;
      console.error(`[${timestamp}] ❌ NAME_STATUS: Supabase MERGE sync failed after ${duration}ms:`, error);
    } finally {
        isSyncScheduledOrRunning.current = false; // Reset flag: Sync finished or failed
        console.log(`[${timestamp}] 🏁 NAME_STATUS: Sync flag reset.`);
    }
    
    return success;
  }, [session, isOnline, fetchNames, createName, saveNamesToStorage, likedNames, maybeNames, dislikedNames]); // Added createName and state arrays as dependencies

  // Helper function to check if two names are the same
  const isSameName = useCallback((a: NameType, b: NameType) => {
    return a.firstName.toLowerCase() === b.firstName.toLowerCase() && 
      ((!a.lastName && !b.lastName) || (a.lastName?.toLowerCase() === b.lastName?.toLowerCase()));
  }, []);

  // Save a single name's status locally and sync with Supabase
  const saveNameStatus = useCallback(async (name: NameType, status: 'liked' | 'maybe' | 'disliked'): Promise<boolean> => {
    const timestamp = getTimestamp();
    console.log(`[${timestamp}] 💾 SAVE_STATUS V3: Starting save for "${name.firstName}" with status: ${status}`);
    const overallStartTime = Date.now();
    let stateActuallyChanged = false; // Flag to track if any state setter modified the list

    try {
      // --- State Update Logic --- 
      // We call all three setters. Each one calculates its *own* next state based on the *current* state it receives.
      
      if (status === 'liked') {
        setLikedNames(currentLiked => {
          const alreadyExists = currentLiked.some(n => isSameName(n, name));
          if (alreadyExists) {
            console.log(`[${timestamp}] 💾 SAVE_STATUS V3 (liked): "${name.firstName}" already liked. No change to liked.`);
            return currentLiked; // No change
          }
          stateActuallyChanged = true; // Mark that *some* state update will happen
          console.log(`[${timestamp}] 💾 SAVE_STATUS V3 (liked): Adding "${name.firstName}" to liked. Prev length: ${currentLiked.length}`);
          return [...currentLiked, name];
        });
        setMaybeNames(currentMaybe => {
          const initialLength = currentMaybe.length;
          const filtered = currentMaybe.filter(n => !isSameName(n, name));
          if (filtered.length !== initialLength) {
             console.log(`[${timestamp}] 💾 SAVE_STATUS V3 (liked): Removing "${name.firstName}" from maybe. Prev length: ${initialLength}`);
             return filtered;
          }
          return currentMaybe; // No change
        });
        setDislikedNames(currentDisliked => {
           const initialLength = currentDisliked.length;
           const filtered = currentDisliked.filter(n => !isSameName(n, name));
           if (filtered.length !== initialLength) {
               console.log(`[${timestamp}] 💾 SAVE_STATUS V3 (liked): Removing "${name.firstName}" from disliked. Prev length: ${initialLength}`);
               return filtered;
           }
           return currentDisliked; // No change
        });
      } else if (status === 'maybe') {
        setMaybeNames(currentMaybe => {
          const alreadyExists = currentMaybe.some(n => isSameName(n, name));
          if (alreadyExists) {
            console.log(`[${timestamp}] 💾 SAVE_STATUS V3 (maybe): "${name.firstName}" already maybe. No change to maybe.`);
            return currentMaybe;
          }
          stateActuallyChanged = true;
          console.log(`[${timestamp}] 💾 SAVE_STATUS V3 (maybe): Adding "${name.firstName}" to maybe. Prev length: ${currentMaybe.length}`);
          return [...currentMaybe, name];
        });
        setLikedNames(currentLiked => {
          const initialLength = currentLiked.length;
          const filtered = currentLiked.filter(n => !isSameName(n, name));
          if (filtered.length !== initialLength) {
             console.log(`[${timestamp}] 💾 SAVE_STATUS V3 (maybe): Removing "${name.firstName}" from liked. Prev length: ${initialLength}`);
             return filtered;
          }
          return currentLiked;
        });
        setDislikedNames(currentDisliked => {
           const initialLength = currentDisliked.length;
           const filtered = currentDisliked.filter(n => !isSameName(n, name));
           if (filtered.length !== initialLength) {
              console.log(`[${timestamp}] 💾 SAVE_STATUS V3 (maybe): Removing "${name.firstName}" from disliked. Prev length: ${initialLength}`);
              return filtered;
           }
           return currentDisliked;
        });
      } else { // disliked
        setDislikedNames(currentDisliked => {
          const alreadyExists = currentDisliked.some(n => isSameName(n, name));
          if (alreadyExists) {
             console.log(`[${timestamp}] 💾 SAVE_STATUS V3 (disliked): "${name.firstName}" already disliked. No change to disliked.`);
            return currentDisliked;
          }
          stateActuallyChanged = true;
          console.log(`[${timestamp}] 💾 SAVE_STATUS V3 (disliked): Adding "${name.firstName}" to disliked. Prev length: ${currentDisliked.length}`);
          return [...currentDisliked, name];
        });
        setLikedNames(currentLiked => {
          const initialLength = currentLiked.length;
          const filtered = currentLiked.filter(n => !isSameName(n, name));
          if (filtered.length !== initialLength) {
             console.log(`[${timestamp}] 💾 SAVE_STATUS V3 (disliked): Removing "${name.firstName}" from liked. Prev length: ${initialLength}`);
             return filtered;
          }
          return currentLiked;
        });
        setMaybeNames(currentMaybe => {
           const initialLength = currentMaybe.length;
           const filtered = currentMaybe.filter(n => !isSameName(n, name));
           if (filtered.length !== initialLength) {
              console.log(`[${timestamp}] 💾 SAVE_STATUS V3 (disliked): Removing "${name.firstName}" from maybe. Prev length: ${initialLength}`);
              return filtered;
           }
           return currentMaybe;
        });
      }

      // --- Persistence Logic --- 
      // IMPORTANT: Await state updates is not directly possible. 
      // We trigger saves *after* calling the setters, assuming React batches efficiently.
      // For robustness, ideally save/sync logic would be triggered by a useEffect watching the state arrays.
      // However, let's try immediate saving first as it's simpler.
      
      // Use a brief timeout to slightly increase chance of state being updated before read.
      // This is a HACK, useEffect is better but more complex to implement here.
      await new Promise(resolve => setTimeout(resolve, 0)); 

      // Read the LATEST state values AFTER the setters have likely processed.
      // Note: Use refs or another mechanism if direct state read proves unreliable.
      const latestLiked = likedNamesRef.current; 
      const latestMaybe = maybeNamesRef.current; 
      const latestDisliked = dislikedNamesRef.current;

      // Save updated lists to AsyncStorage
      const storageStartTime = Date.now();
      const saveResult = await saveNamesToStorage(latestLiked, latestMaybe, latestDisliked);
      const storageDuration = Date.now() - storageStartTime;
      if (!saveResult) {
        console.error(`[${timestamp}] ❌ NAME_STATUS V3: Failed to save "${name.firstName}" to AsyncStorage after ${storageDuration}ms`);
      } else {
        // DEBUG: console.log(`[${timestamp}] 💾 NAME_STATUS V3: Saved state to AsyncStorage in ${storageDuration}ms`);
      }
      
      // Call Supabase update/create if online and session exists
      if (session && isOnline) {
        try {
          const nameInfo: NameInfo = {
            name: name.firstName,
            last_name: name.lastName ?? null, 
            status: status,
            meaning: name.meaning,
            origin: name.origin,
            search_context: { gender: name.gender }
          };
          await createName(nameInfo); 
          // DEBUG: console.log(`[${timestamp}] ☁️ NAME_STATUS V3: Successfully called createName for "${name.firstName}" (${status})`);
        } catch (supabaseError) {
          console.error(`[${timestamp}] ❌ NAME_STATUS V3: Failed to create/update "${name.firstName}" (${status}) via createName:`, supabaseError);
        }
      }
      
      const totalDuration = Date.now() - overallStartTime;
      console.log(`[${timestamp}] ✅💾 SAVE_STATUS V3: Processed "${name.firstName}" (${status}) successfully in ${totalDuration}ms.`);
      return true; // Return success

    } catch (error) {
      const totalDuration = Date.now() - overallStartTime;
      console.error(`[${timestamp}] ❌ NAME_STATUS V3: Critical error saving "${name.firstName}" status after ${totalDuration}ms:`, error);
      // Do not revert state here, as the functional updates should be correct.
      // The issue would be in the async saving/syncing part if it fails.
      throw error; // Rethrow the error to be handled by the caller
    }
  }, [isSameName, saveNamesToStorage, createName, session, isOnline]); // Removed state arrays from deps

  // Add refs to hold the latest state for saving
  const likedNamesRef = useRef(likedNames);
  const maybeNamesRef = useRef(maybeNames);
  const dislikedNamesRef = useRef(dislikedNames);

  useEffect(() => { likedNamesRef.current = likedNames; }, [likedNames]);
  useEffect(() => { maybeNamesRef.current = maybeNames; }, [maybeNames]);
  useEffect(() => { dislikedNamesRef.current = dislikedNames; }, [dislikedNames]);
  
  // Initialize data: Load from storage, set state, then trigger background sync
  const initialize = useCallback(async () => {
    // Prevent re-initialization if already loading/ready or initializing or already done once
    if (loadingState !== 'idle' || isInitializingRef.current || hasInitializedEver.current) {
      // DEBUG: console.log(`🔄 NAME_STATUS: Skipping initialization (State: ${loadingState}, Initializing: ${isInitializingRef.current}, InitializedOnce: ${hasInitializedEver.current})`);
      return;
    }
    if (!session) {
      console.log('⚠️ NAME_STATUS: User not authenticated, cannot initialize.');
      setLoadingState('error'); // Set error state if no session
      return; 
    }
    
    isInitializingRef.current = true; // Set flag
    // INFO: console.log('🚀 NAME_STATUS: Initializing - Loading from local storage...');
    setLoadingState('loading'); // Set state to loading
    const startTime = Date.now();
    let success = false;

    try {
      // Step 1: Load from storage
      const userId = session.user.id;
      // DEBUG: console.log(`[${getTimestamp()}] 💾 NAME_STATUS: Calling loadNamesFromStorage for user ${userId.substring(0, 8)}...`);
      const loadedData = await loadNamesFromStorage();
      // RE-ADD TEMP LOG: Check what was loaded
      // console.log(`[${getTimestamp()}] TEMP_DEBUG: Loaded from storage - Liked: ${loadedData.liked?.length ?? 'null/undef'}, Maybe: ${loadedData.maybe?.length ?? 'null/undef'}`);

      // Step 2: Update state with loaded data
      // RE-ADD TEMP LOG: Confirm state setters are called
      // console.log(`[${getTimestamp()}] TEMP_DEBUG: Calling setLikedNames with ${loadedData.liked?.length ?? 'null/undef'} items.`);
      setLikedNames(loadedData.liked);
      // console.log(`[${getTimestamp()}] TEMP_DEBUG: Calling setMaybeNames with ${loadedData.maybe?.length ?? 'null/undef'} items.`);
      setMaybeNames(loadedData.maybe);
      // console.log(`[${getTimestamp()}] TEMP_DEBUG: Calling setDislikedNames with ${loadedData.disliked?.length ?? 'null/undef'} items.`);
      setDislikedNames(loadedData.disliked);
      // DEBUG: console.log(`[${getTimestamp()}] ✅ NAME_STATUS: State updated with local data.`);

      // Step 3: Mark as ready *immediately* after setting local state
      setLoadingState('ready'); 
      const loadDuration = Date.now() - startTime;
      console.log(`[${getTimestamp()}] ✅🚀 NAME_STATUS: Initialized state from storage in ${loadDuration}ms.`);
      
      success = true;

      // Step 4: Start background sync with a delay, only if not already scheduled/running
      if (!isSyncScheduledOrRunning.current) {
          isSyncScheduledOrRunning.current = true; // Set flag: Sync scheduled
          console.log(`[${getTimestamp()}] 🔄 NAME_STATUS: Scheduling background sync with Supabase after 500ms delay...`);
          setTimeout(() => {
              // DEBUG: console.log(`[${getTimestamp()}] 🔄 NAME_STATUS: Executing delayed background sync...`);
              syncWithSupabase().catch(syncError => {
                // Catch errors from the promise returned by async syncWithSupabase
                 console.error(`[${getTimestamp()}] ❌ NAME_STATUS: Background sync encountered an unhandled error:`, syncError);
              }); // syncWithSupabase will reset the flag in its finally block
          }, 500); // Add 500ms delay
      } else {
          console.log(`[${getTimestamp()}] 🔄 NAME_STATUS: Background sync already scheduled/running. Skipping reschedule.`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[${getTimestamp()}] ❌ NAME_STATUS: Error during local loading phase after ${duration}ms:`, error);
      setLoadingState('error'); // Set error state
      success = false;
    } finally {
       if (success) {
           hasInitializedEver.current = true; // Mark that initialization completed successfully once
           // DEBUG: console.log(`[${getTimestamp()}] ✅ NAME_STATUS: Marked hasInitializedEver = true`);
       }
       isInitializingRef.current = false; // Reset flag in finally block
       // DEBUG: console.log(`[${getTimestamp()}]🏁 NAME_STATUS: Initialization function finished (Success: ${success}).`);
    }
  }, [session, loadNamesFromStorage, syncWithSupabase, loadingState]); // Depend on session and loadingState
  
  // Effect to run initialization ONLY ONCE when session becomes available
  useEffect(() => {
    // Trigger initialize only if we have a session, state is idle, not currently initializing, AND haven't initialized before
    if (session && loadingState === 'idle' && !isInitializingRef.current && !hasInitializedEver.current) {
       // DEBUG: console.log(`[${getTimestamp()}] ✨ NAME_STATUS: Session available, state idle, never initialized. Triggering initialize().`);
       initialize();
    } else if (!session && loadingState !== 'idle') {
        // Reset state if user logs out
        // INFO: console.log(`[${getTimestamp()}] ⏪ NAME_STATUS: Session lost. Resetting state.`);
        setLikedNames([]);
        setMaybeNames([]);
        setDislikedNames([]);
        setLoadingState('idle');
        isInitializingRef.current = false; // Ensure flag is reset on logout
        hasInitializedEver.current = false; // Reset the main init flag too
    }
  }, [session, loadingState, initialize]);


  // Effect to re-sync when network status changes (if ready and *after* initial setup)
  useEffect(() => {
    // Only sync if online, ready, has session, AND the initial setup has finished
    if (isOnline && loadingState === 'ready' && session && hasInitializedEver.current) {
      const timestamp = getTimestamp();
      // DEBUG: console.log(`[${timestamp}] 🔄 NAME_STATUS: Network status changed to online while ready. Triggering sync.`);
      // syncWithSupabase includes its own debounce check now
      syncWithSupabase();
    }
  }, [isOnline, loadingState, session, syncWithSupabase]);
  

  return {
    likedNames,
    maybeNames,
    dislikedNames,
    saveNameStatus,
    loadingState, // Export the new loading state
  };
} 