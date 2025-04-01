import { useState, useCallback, useEffect } from 'react';
import { nameOperations, NameRecord } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_OPERATIONS_KEY = 'zuzu_pending_operations';
const CACHED_NAMES_KEY = 'zuzu_cached_names';

type PendingOperation = {
  type: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
};

export function useNames() {
  const [names, setNames] = useState<NameRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  const { session, isOnline } = useAuth();

  // Load pending operations from AsyncStorage
  useEffect(() => {
    const loadPendingOperations = async () => {
      try {
        const pendingOpsJson = await AsyncStorage.getItem(PENDING_OPERATIONS_KEY);
        if (pendingOpsJson) {
          setPendingOperations(JSON.parse(pendingOpsJson));
        }
      } catch (err) {
        console.error('Failed to load pending operations:', err);
      }
    };

    loadPendingOperations();
  }, []);

  // Save pending operations to AsyncStorage
  const savePendingOperations = useCallback(async (operations: PendingOperation[]) => {
    try {
      await AsyncStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(operations));
    } catch (err) {
      console.error('Failed to save pending operations:', err);
    }
  }, []);

  // Sync pending operations when we come online
  useEffect(() => {
    if (isOnline && session && pendingOperations.length > 0) {
      syncPendingOperations();
    }
  }, [isOnline, session, pendingOperations]);

  const syncPendingOperations = useCallback(async () => {
    if (!isOnline || !session || pendingOperations.length === 0) return;
    
    setIsLoading(true);
    let updatedOps = [...pendingOperations];
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < updatedOps.length; i++) {
      const op = updatedOps[i];
      try {
        if (op.type === 'create') {
          // Make sure user_id is set correctly
          const dataWithUserId = {
            ...op.data,
            user_id: session.user.id
          };
          await nameOperations.createName(dataWithUserId);
          successCount++;
        } else if (op.type === 'update') {
          await nameOperations.updateNameStatus(op.data.id, op.data.status);
          successCount++;
        }
        // Remove the operation once successful
        updatedOps = updatedOps.filter((_, index) => index !== i);
        i--; // Adjust index after removal
      } catch (err) {
        failureCount++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Failed to sync ${op.type} operation:`, err);
        
        // If this is an RLS error, we might need to skip this operation
        if (errorMessage.includes('violates row-level security policy')) {
          console.warn(`Skipping operation due to RLS policy violation. Operation: ${op.type}, Data:`, op.data);
          // Skip this operation for now - we'll need to fix RLS policies in Supabase
          updatedOps = updatedOps.filter((_, index) => index !== i);
          i--; // Adjust index after removal
        }
        // Other errors - Keep the operation in the queue to retry later
      }
    }
    
    setPendingOperations(updatedOps);
    await savePendingOperations(updatedOps);
    
    // Only fetch names if we had some successful operations
    if (successCount > 0) {
      await fetchNames(); // Refresh list after sync
    }
    
    setIsLoading(false);
    
    return { successCount, failureCount, remainingOperations: updatedOps.length };
  }, [isOnline, session, pendingOperations, savePendingOperations]);

  const fetchNames = useCallback(async (status?: NameRecord['status']): Promise<NameRecord[]> => {
    if (!session) return [];
    
    try {
      setIsLoading(true);
      setError(null);
      
      // If online, fetch from Supabase
      if (isOnline) {
        try {
          const data = await nameOperations.getUserNames(status);
          
          // Cache the results
          const cachedNamesJson = await AsyncStorage.getItem(CACHED_NAMES_KEY);
          let existingCache: NameRecord[] = cachedNamesJson ? JSON.parse(cachedNamesJson) : [];
          
          // Merge with existing cache, avoiding duplicates
          const combinedData = [...existingCache];
          for (const newName of data) {
            const existingIndex = combinedData.findIndex(item => item.id === newName.id);
            if (existingIndex >= 0) {
              combinedData[existingIndex] = newName; // Update existing record
            } else {
              combinedData.push(newName); // Add new record
            }
          }
          
          await AsyncStorage.setItem(CACHED_NAMES_KEY, JSON.stringify(combinedData));
          
          // Filter by status if needed
          const filteredData = status 
            ? data.filter(name => name.status === status)
            : data;
            
          setNames(filteredData);
          return filteredData;
        } catch (err) {
          console.error('Error fetching from Supabase, falling back to cache:', err);
          // If Supabase fetch fails, gracefully fall back to cache
          return fetchFromCache(status);
        }
      }
      
      // If offline, use cache
      return fetchFromCache(status);
      
    } catch (err) {
      console.error('Error fetching names:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch names'));
      
      // Always try to use cached data as fallback
      return fetchFromCache(status);
    } finally {
      setIsLoading(false);
    }
  }, [session, isOnline]);
  
  // Helper function to fetch from cache
  const fetchFromCache = async (status?: NameRecord['status']): Promise<NameRecord[]> => {
    const cachedNamesJson = await AsyncStorage.getItem(CACHED_NAMES_KEY);
    let cachedNames: NameRecord[] = [];
    
    if (cachedNamesJson) {
      cachedNames = JSON.parse(cachedNamesJson);
      if (status) {
        cachedNames = cachedNames.filter(name => name.status === status);
      }
    }
    
    setNames(cachedNames);
    return cachedNames;
  };

  const createName = useCallback(async (nameData: Omit<NameRecord, 'id' | 'created_at' | 'user_id'>): Promise<NameRecord | null> => {
    if (!session) return null;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Generate a temporary ID for offline mode
      const tempId = 'temp_' + Math.random().toString(36).substring(2, 15);
      const timestamp = Date.now();
      
      // Create a temporary record
      const tempRecord: NameRecord = {
        id: tempId,
        user_id: session.user.id,
        name: nameData.name,
        last_name: nameData.last_name,
        meaning: nameData.meaning,
        origin: nameData.origin,
        status: nameData.status,
        search_context: nameData.search_context || {},
        created_at: new Date(timestamp).toISOString(),
      };
      
      // If online, create directly in Supabase
      if (isOnline) {
        try {
          const data = await nameOperations.createName(nameData);
          
          // Update cache
          const cachedNamesJson = await AsyncStorage.getItem(CACHED_NAMES_KEY);
          let cachedNames: NameRecord[] = cachedNamesJson ? JSON.parse(cachedNamesJson) : [];
          cachedNames.push(data);
          await AsyncStorage.setItem(CACHED_NAMES_KEY, JSON.stringify(cachedNames));
          
          setNames(prev => [...prev, data]);
          return data;
        } catch (err) {
          console.error('Error creating name in Supabase, falling back to offline mode:', err);
          // If Supabase operation fails, fall back to offline mode
        }
      }
      
      // If offline or Supabase operation failed, store in local cache and add to pending operations
      const cachedNamesJson = await AsyncStorage.getItem(CACHED_NAMES_KEY);
      let cachedNames: NameRecord[] = cachedNamesJson ? JSON.parse(cachedNamesJson) : [];
      cachedNames.push(tempRecord);
      await AsyncStorage.setItem(CACHED_NAMES_KEY, JSON.stringify(cachedNames));
      
      // Add to pending operations
      const newOp: PendingOperation = {
        type: 'create',
        data: nameData,
        timestamp,
      };
      
      const updatedOps = [...pendingOperations, newOp];
      setPendingOperations(updatedOps);
      await savePendingOperations(updatedOps);
      
      setNames(prev => [...prev, tempRecord]);
      return tempRecord;
    } catch (err) {
      console.error('Failed to create name:', err);
      setError(err instanceof Error ? err : new Error('Failed to create name'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session, isOnline, pendingOperations, savePendingOperations]);

  const updateNameStatus = useCallback(async (nameId: string, status: NameRecord['status']): Promise<NameRecord | null> => {
    if (!session) return null;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // If online and not a temporary record, update directly in Supabase
      if (isOnline && !nameId.startsWith('temp_')) {
        try {
          const updatedName = await nameOperations.updateNameStatus(nameId, status);
          
          // Update cache
          const cachedNamesJson = await AsyncStorage.getItem(CACHED_NAMES_KEY);
          let cachedNames: NameRecord[] = cachedNamesJson ? JSON.parse(cachedNamesJson) : [];
          cachedNames = cachedNames.map(name => name.id === nameId ? updatedName : name);
          await AsyncStorage.setItem(CACHED_NAMES_KEY, JSON.stringify(cachedNames));
          
          setNames(prev => prev.map(name => name.id === nameId ? updatedName : name));
          return updatedName;
        } catch (err) {
          console.error('Error updating name in Supabase, falling back to offline mode:', err);
          // If Supabase operation fails, fall back to offline mode
        }
      }
      
      // If offline or it's a temporary record or Supabase operation failed, update locally
      const cachedNamesJson = await AsyncStorage.getItem(CACHED_NAMES_KEY);
      let cachedNames: NameRecord[] = cachedNamesJson ? JSON.parse(cachedNamesJson) : [];
      
      // Find the name to update
      const nameToUpdate = cachedNames.find(name => name.id === nameId);
      if (!nameToUpdate) return null;
      
      // Update the name
      const updatedName = { ...nameToUpdate, status };
      cachedNames = cachedNames.map(name => name.id === nameId ? updatedName : name);
      await AsyncStorage.setItem(CACHED_NAMES_KEY, JSON.stringify(cachedNames));
      
      // Add to pending operations if not a temporary record
      if (!nameId.startsWith('temp_')) {
        const newOp: PendingOperation = {
          type: 'update',
          data: { id: nameId, status },
          timestamp: Date.now(),
        };
        
        const updatedOps = [...pendingOperations, newOp];
        setPendingOperations(updatedOps);
        await savePendingOperations(updatedOps);
      }
      
      setNames(prev => prev.map(name => name.id === nameId ? updatedName : name));
      return updatedName;
    } catch (err) {
      console.error('Failed to update name status:', err);
      setError(err instanceof Error ? err : new Error('Failed to update name status'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session, isOnline, pendingOperations, savePendingOperations]);

  return {
    names,
    isLoading,
    error,
    fetchNames,
    createName,
    updateNameStatus,
    pendingOperations,
    syncPendingOperations,
  };
} 