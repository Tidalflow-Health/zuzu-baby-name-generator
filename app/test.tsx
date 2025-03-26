/*
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';
import { useNames } from '../hooks/useNames';
import { useNameStatus } from '../hooks/useNameStatus';
import Colors from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEBUG_CONFIG } from '../utils/appConfig';
import { checkConnectivity } from '../utils/network';

export default function TestScreen() {
  const { session, isLoading: authLoading, signIn, signOut, isOnline, checkNetworkStatus } = useAuth();
  const { 
    names, 
    isLoading: namesLoading, 
    error, 
    fetchNames, 
    pendingOperations, 
    syncPendingOperations,
    createName,
    updateNameStatus
  } = useNames();
  const { likedNames, maybeNames, dislikedNames, saveNameStatus } = useNameStatus();
  const [testResult, setTestResult] = useState<string>('');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [networkStatus, setNetworkStatus] = useState<{ type: string | null, isConnected: boolean }>({
    type: 'wifi',
    isConnected: true
  });
  const [forceOffline, setForceOffline] = useState(DEBUG_CONFIG.FORCE_OFFLINE_MODE);

  useEffect(() => {
    if (session) {
      fetchNames();
    }
  }, [session, fetchNames]);

  // Sync network status with AuthContext
  useEffect(() => {
    setNetworkStatus({
      type: isOnline ? 'wifi' : 'none',
      isConnected: isOnline
    });
  }, [isOnline]);

  const runTests = async () => {
    setTestStatus('loading');
    setTestResult('Running tests...\n\n');

    try {
      // Test 1: Auth
      let result = '1. Authentication Test:\n';
      if (session) {
        result += `✅ User authenticated (ID: ${session.user.id})\n`;
        result += `✅ Online status: ${isOnline ? 'Online' : 'Offline'}\n`;
        result += `✅ Force offline: ${forceOffline ? 'Yes' : 'No'}\n`;
        result += `✅ Network type: ${networkStatus.type || 'unknown'}\n`;
      } else {
        result += '❌ No active session\n';
      }
      setTestResult(prev => prev + result + '\n');

      // Test 2: Fetch names
      result = '2. Fetch Names Test:\n';
      if (namesLoading) {
        result += '⏳ Loading names...\n';
      } else if (error) {
        result += `❌ Error fetching names: ${error.message}\n`;
      } else {
        result += `✅ Found ${names.length} names in database\n`;
      }
      setTestResult(prev => prev + result + '\n');

      // Test 3: Local Storage
      result = '3. Local Storage Test:\n';
      result += `✅ Found ${likedNames.length} liked names\n`;
      result += `✅ Found ${maybeNames.length} maybe names\n`;
      result += `✅ Found ${dislikedNames.length} disliked names\n`;
      
      // Check cached names
      const cachedNamesJson = await AsyncStorage.getItem('zuzu_cached_names');
      const cachedNamesCount = cachedNamesJson ? JSON.parse(cachedNamesJson).length : 0;
      result += `✅ Found ${cachedNamesCount} cached names\n`;
      
      // Check pending operations
      result += `✅ Found ${pendingOperations.length} pending operations\n`;
      
      setTestResult(prev => prev + result + '\n');

      // Test 4: Create/Update Name
      result = '4. Create Name Test:\n';
      try {
        const testName = {
          name: 'Test Name',
          last_name: null,
          meaning: 'For testing purposes',
          origin: 'Test',
          status: 'maybe' as const,
          search_context: { test: true }
        };
        
        await createName(testName);
        result += '✅ Successfully created test name\n';
      } catch (error) {
        result += `❌ Error creating test name: ${error instanceof Error ? error.message : String(error)}\n`;
      }
      setTestResult(prev => prev + result + '\n');

      // Test 5: Sync Operations
      result = '5. Sync Operations Test:\n';
      try {
        await syncPendingOperations();
        result += '✅ Successfully synced pending operations\n';
      } catch (error) {
        result += `❌ Error syncing operations: ${error instanceof Error ? error.message : String(error)}\n`;
      }
      setTestResult(prev => prev + result + '\n');

      setTestStatus('success');
    } catch (err) {
      setTestResult(prev => prev + `\n❌ Error running tests: ${err instanceof Error ? err.message : String(err)}`);
      setTestStatus('error');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setTestResult('Successfully signed out');
    } catch (err) {
      setTestResult(`Error signing out: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSignIn = async () => {
    try {
      await signIn();
      setTestResult('Successfully signed in');
    } catch (err) {
      setTestResult(`Error signing in: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const clearCache = async () => {
    try {
      await AsyncStorage.removeItem('zuzu_cached_names');
      await AsyncStorage.removeItem('zuzu_pending_operations');
      setTestResult('Cache cleared successfully.');
    } catch (err) {
      setTestResult(`Error clearing cache: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const checkConnectivity = async () => {
    try {
      setTestResult('Checking connectivity...');
      
      // Use the new network utility for checking connectivity
      const isConnected = await checkNetworkStatus();
      
      setNetworkStatus({
        type: isConnected ? 'wifi' : 'none',
        isConnected
      });
      
      setTestResult(`Network status: ${isConnected ? 'Connected' : 'Disconnected'}, Type: ${isConnected ? 'wifi/cellular' : 'none'}`);
    } catch (err) {
      console.error('Error checking connectivity:', err);
      setTestResult(`Error checking connectivity: ${err instanceof Error ? err.message : String(err)}`);
      setNetworkStatus({
        type: 'none',
        isConnected: false
      });
    }
  };

  const toggleOfflineMode = async () => {
    // Toggle the force offline flag in the app config
    const newValue = !forceOffline;
    setForceOffline(newValue);
    
    // Store the setting in the app config
    DEBUG_CONFIG.FORCE_OFFLINE_MODE = newValue;
    
    setTestResult(`Offline Mode: ${newValue ? 'Enabled' : 'Disabled'}. Restart the app to apply changes.`);
  };

  const testSupabaseConnection = async () => {
    try {
      setTestResult('Testing Supabase connection...');
      
      // Sign out and then sign in to test the full auth flow
      await signOut();
      await signIn();
      
      setTestResult(`Supabase connection test: ${session ? 'Success' : 'Failed'}`);
    } catch (err) {
      setTestResult(`Supabase connection error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const testRlsPolicies = async () => {
    try {
      setTestResult('Testing RLS policies...\n');
      
      // First, check if we have a valid session
      if (!session) {
        setTestResult('No active session. Please sign in first.');
        return;
      }
      
      setTestResult(prev => prev + `Using user ID: ${session.user.id}\n\n`);
      
      // 1. Try to create a test record
      setTestResult(prev => prev + '1. Testing CREATE operation...\n');
      try {
        const testName = {
          name: 'RLS Test Name',
          last_name: null,
          meaning: 'For testing RLS policies',
          origin: 'Test',
          status: 'maybe' as const,
          search_context: { test: true }
        };
        
        await createName(testName);
        setTestResult(prev => prev + '✅ CREATE operation successful\n\n');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setTestResult(prev => prev + `❌ CREATE operation failed: ${errorMsg}\n\n`);
        
        if (errorMsg.includes('policy')) {
          setTestResult(prev => prev + 'RLS POLICY ISSUE DETECTED\n');
          setTestResult(prev => prev + 'To fix this issue, go to your Supabase dashboard:\n');
          setTestResult(prev => prev + '1. Go to Authentication > Policies\n');
          setTestResult(prev => prev + '2. Find the name_records table\n');
          setTestResult(prev => prev + '3. Add a policy that allows INSERT with this condition:\n');
          setTestResult(prev => prev + '   (auth.uid() = user_id)\n\n');
        }
      }
      
      // 2. Test fetching records
      setTestResult(prev => prev + '2. Testing READ operation...\n');
      try {
        await fetchNames();
        setTestResult(prev => prev + '✅ READ operation successful\n\n');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setTestResult(prev => prev + `❌ READ operation failed: ${errorMsg}\n\n`);
        
        if (errorMsg.includes('policy')) {
          setTestResult(prev => prev + 'RLS POLICY ISSUE DETECTED\n');
          setTestResult(prev => prev + 'To fix this issue, go to your Supabase dashboard:\n');
          setTestResult(prev => prev + '1. Go to Authentication > Policies\n');
          setTestResult(prev => prev + '2. Find the name_records table\n');
          setTestResult(prev => prev + '3. Add a policy that allows SELECT with this condition:\n');
          setTestResult(prev => prev + '   (auth.uid() = user_id)\n\n');
        }
      }
      
      // 3. Test updating records (if we have any)
      if (names.length > 0) {
        setTestResult(prev => prev + '3. Testing UPDATE operation...\n');
        try {
          const nameToUpdate = names[0];
          const newStatus = nameToUpdate.status === 'liked' ? 'maybe' : 'liked';
          
          await updateNameStatus(nameToUpdate.id, newStatus);
          setTestResult(prev => prev + '✅ UPDATE operation successful\n\n');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          setTestResult(prev => prev + `❌ UPDATE operation failed: ${errorMsg}\n\n`);
          
          if (errorMsg.includes('policy')) {
            setTestResult(prev => prev + 'RLS POLICY ISSUE DETECTED\n');
            setTestResult(prev => prev + 'To fix this issue, go to your Supabase dashboard:\n');
            setTestResult(prev => prev + '1. Go to Authentication > Policies\n');
            setTestResult(prev => prev + '2. Find the name_records table\n');
            setTestResult(prev => prev + '3. Add a policy that allows UPDATE with this condition:\n');
            setTestResult(prev => prev + '   (auth.uid() = user_id)\n\n');
          }
        }
      } else {
        setTestResult(prev => prev + '3. Skipping UPDATE test (no records available)\n\n');
      }
      
      // Final summary
      setTestResult(prev => prev + 'RLS POLICY TEST COMPLETE\n\n');
      setTestResult(prev => prev + 'If you encountered any policy issues, please update your Supabase RLS policies as suggested above.\n');
      setTestResult(prev => prev + 'Alternatively, you can temporarily disable RLS for testing (not recommended for production):\n');
      setTestResult(prev => prev + '1. Go to the Table Editor in Supabase\n');
      setTestResult(prev => prev + '2. Select the name_records table\n');
      setTestResult(prev => prev + '3. Go to "Table Configuration"\n');
      setTestResult(prev => prev + '4. Toggle "Enable Row Level Security" to OFF\n');
      
    } catch (err) {
      setTestResult(`Error testing RLS policies: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const testSupabaseConfiguration = async () => {
    try {
      setTestResult('Testing Supabase Configuration...\n\n');
      
      // 1. Test Anonymous Authentication
      setTestResult(prev => prev + '1. Testing Anonymous Authentication...\n');
      try {
        await signOut(); // First sign out to ensure we're testing a fresh sign-in
        await signIn(); // Try to sign in
        
        if (session && !session.access_token.includes('offline_mode')) {
          setTestResult(prev => prev + '✅ Anonymous Authentication ENABLED and working correctly\n\n');
        } else {
          setTestResult(prev => prev + '❌ Using OFFLINE mode - Anonymous Authentication might be disabled\n\n');
          setTestResult(prev => prev + 'To enable Anonymous Authentication in Supabase:\n');
          setTestResult(prev => prev + '1. Go to your Supabase dashboard\n');
          setTestResult(prev => prev + '2. Navigate to Authentication > Providers\n');
          setTestResult(prev => prev + '3. Find "Anonymous Sign-in" and toggle it to ENABLED\n');
          setTestResult(prev => prev + '4. Save your changes\n\n');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setTestResult(prev => prev + `❌ Anonymous Authentication Failed: ${errorMsg}\n\n`);
        
        if (errorMsg.includes('Anonymous sign-ins are disabled')) {
          setTestResult(prev => prev + 'To enable Anonymous Authentication in Supabase:\n');
          setTestResult(prev => prev + '1. Go to your Supabase dashboard\n');
          setTestResult(prev => prev + '2. Navigate to Authentication > Providers\n');
          setTestResult(prev => prev + '3. Find "Anonymous Sign-in" and toggle it to ENABLED\n');
          setTestResult(prev => prev + '4. Save your changes\n\n');
        }
      }
      
      // 2. Check if we're using a valid Supabase URL
      setTestResult(prev => prev + '2. Checking Supabase URL Configuration...\n');
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (supabaseUrl && supabaseUrl.includes('supabase.co')) {
        setTestResult(prev => prev + `✅ Supabase URL configured: ${supabaseUrl}\n\n`);
      } else {
        setTestResult(prev => prev + `❌ Invalid Supabase URL: ${supabaseUrl || 'Not set'}\n\n`);
        setTestResult(prev => prev + 'Please update your .env file with a valid EXPO_PUBLIC_SUPABASE_URL\n\n');
      }
      
      // 3. Check Supabase Anon Key
      setTestResult(prev => prev + '3. Checking Supabase Anon Key Configuration...\n');
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseAnonKey && supabaseAnonKey.length > 20) {
        setTestResult(prev => prev + `✅ Supabase Anon Key configured (length: ${supabaseAnonKey.length})\n\n`);
      } else {
        setTestResult(prev => prev + `❌ Invalid Supabase Anon Key: ${supabaseAnonKey ? 'Too short' : 'Not set'}\n\n`);
        setTestResult(prev => prev + 'Please update your .env file with a valid EXPO_PUBLIC_SUPABASE_ANON_KEY\n\n');
      }
      
      // 4. RLS Policy Check reminder
      setTestResult(prev => prev + '4. Row Level Security (RLS) Policies\n');
      setTestResult(prev => prev + 'To check RLS policies, use the "Test RLS Policies" button after ensuring anonymous auth is working.\n\n');
      
      // Summary
      setTestResult(prev => prev + 'SUPABASE CONFIGURATION TEST COMPLETE\n\n');
      setTestResult(prev => prev + 'If any issues were found, please update your Supabase configuration as suggested above.\n');
      
    } catch (err) {
      setTestResult(`Error testing Supabase configuration: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const testNamePersistence = async () => {
    try {
      setTestResult('Testing name persistence...\n\n');
      
      // 1. Check current stored names
      setTestResult(prev => prev + '1. Current stored names:\n');
      setTestResult(prev => prev + `Liked: ${likedNames.length} names\n`);
      setTestResult(prev => prev + `Maybe: ${maybeNames.length} names\n`);
      setTestResult(prev => prev + `Disliked: ${dislikedNames.length} names\n\n`);
      
      // 2. Check local storage keys
      const likedFromStorage = await AsyncStorage.getItem('zuzu_liked_names');
      const maybeFromStorage = await AsyncStorage.getItem('zuzu_maybe_names');
      const dislikedFromStorage = await AsyncStorage.getItem('zuzu_disliked_names');
      
      setTestResult(prev => prev + '2. Names in AsyncStorage:\n');
      setTestResult(prev => prev + `Liked: ${likedFromStorage ? JSON.parse(likedFromStorage).length : 0} names\n`);
      setTestResult(prev => prev + `Maybe: ${maybeFromStorage ? JSON.parse(maybeFromStorage).length : 0} names\n`);
      setTestResult(prev => prev + `Disliked: ${dislikedFromStorage ? JSON.parse(dislikedFromStorage).length : 0} names\n\n`);
      
      // 3. Test saving a new name
      setTestResult(prev => prev + '3. Testing name saving...\n');
      const testName = {
        name: 'Persistence Test',
        last_name: null,
        meaning: 'Testing name persistence',
        origin: 'Test',
        status: 'maybe' as const,
        search_context: { test: true }
      };
      
      try {
        await saveNameStatus(testName, 'maybe');
        setTestResult(prev => prev + '✅ Successfully saved test name\n\n');
      } catch (error) {
        setTestResult(prev => prev + `❌ Error saving test name: ${error instanceof Error ? error.message : String(error)}\n\n`);
      }
      
      // 4. Verify the name was saved
      setTestResult(prev => prev + '4. Verifying saved name...\n');
      const updatedMaybeNames = await AsyncStorage.getItem('zuzu_maybe_names');
      const maybeNamesArray = updatedMaybeNames ? JSON.parse(updatedMaybeNames) : [];
      const foundTestName = maybeNamesArray.find((n: any) => n.name === 'Persistence Test');
      
      if (foundTestName) {
        setTestResult(prev => prev + '✅ Test name found in storage\n\n');
      } else {
        setTestResult(prev => prev + '❌ Test name not found in storage\n\n');
      }
      
      // 5. Clean up test data
      setTestResult(prev => prev + '5. Cleaning up test data...\n');
      try {
        const filteredNames = maybeNamesArray.filter((n: any) => n.name !== 'Persistence Test');
        await AsyncStorage.setItem('zuzu_maybe_names', JSON.stringify(filteredNames));
        setTestResult(prev => prev + '✅ Successfully cleaned up test data\n\n');
      } catch (error) {
        setTestResult(prev => prev + `❌ Error cleaning up test data: ${error instanceof Error ? error.message : String(error)}\n\n`);
      }
      
      setTestResult(prev => prev + 'NAME PERSISTENCE TEST COMPLETE\n\n');
      
    } catch (err) {
      setTestResult(`Error testing name persistence: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.gradients.background[0], Colors.gradients.background[1]]}
        style={styles.background}
      >
        <SafeAreaView style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Supabase Integration Test</Text>
            <Link href="/home" asChild>
              <TouchableOpacity style={styles.backButton}>
                <Text style={styles.buttonText}>Back to Home</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Auth Status:</Text>
            <Text style={styles.statusValue}>
              {authLoading ? 'Loading...' : session ? 'Authenticated' : 'Not Authenticated'}
            </Text>
          </View>

          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Network Status:</Text>
            <Text style={[
              styles.statusValue, 
              { color: networkStatus.isConnected ? 'green' : 'red' }
            ]}>
              {networkStatus.isConnected ? 'Online' : 'Offline'} ({networkStatus.type || 'unknown'})
            </Text>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={checkConnectivity}
            >
              <Text style={styles.smallButtonText}>Check</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={runTests}
              disabled={testStatus === 'loading'}
            >
              {testStatus === 'loading' ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.buttonText}>Run All Tests</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={testSupabaseConnection}
            >
              <Text style={styles.buttonText}>Test Connection</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={testSupabaseConfiguration}
            >
              <Text style={styles.buttonText}>Test Supabase Config</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={testRlsPolicies}
            >
              <Text style={styles.buttonText}>Test RLS Policies</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#8E44AD' }]}
              onPress={testNamePersistence}
            >
              <Text style={styles.buttonText}>Test Name Persistence</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.dangerButton]}
              onPress={handleSignOut}
            >
              <Text style={styles.buttonText}>Sign Out</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.successButton]}
              onPress={handleSignIn}
            >
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#FF9800' }]}
              onPress={clearCache}
            >
              <Text style={styles.buttonText}>Clear Cache</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.resultContainer}
            contentContainerStyle={styles.resultContent}
          >
            <Text style={styles.resultText}>{testResult}</Text>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  backButton: {
    padding: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  smallButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
  },
  statusLabel: {
    color: 'white',
    fontSize: 16,
    marginRight: 8,
  },
  statusValue: {
    color: 'white',
    fontSize: 16,
    flex: 1,
  },
  syncButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: '#0A7EA4',
  },
  secondaryButton: {
    backgroundColor: '#2C3E50',
  },
  dangerButton: {
    backgroundColor: '#E74C3C',
  },
  successButton: {
    backgroundColor: '#27AE60',
  },
  resultContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 16,
  },
  resultContent: {
    paddingBottom: 16,
  },
  resultText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
});
*/ 