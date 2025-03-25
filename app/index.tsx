import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';
import Colors from '../constants/Colors';
import { DEBUG_CONFIG } from '../utils/appConfig';

export default function Index() {
  const { signIn, isLoading, session, isOnline } = useAuth();
  const [showDebug, setShowDebug] = useState(false);
  
  useEffect(() => {
    // Automatically sign in anonymously if not already signed in
    const initAuth = async () => {
      if (!session) {
        try {
          await signIn();
        } catch (error) {
          console.error('Failed to sign in anonymously:', error);
        }
      }
    };
    
    initAuth();

    // Show debug info for a few seconds if in offline mode
    if (DEBUG_CONFIG.FORCE_OFFLINE_MODE || !isOnline) {
      setShowDebug(true);
      const timer = setTimeout(() => setShowDebug(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [session, signIn, isOnline]);
  
  // If still loading, show spinner
  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={Colors.primary.main} />

        {/* Debug indicator */}
        {showDebug && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>
              {DEBUG_CONFIG.FORCE_OFFLINE_MODE 
                ? 'DEBUG: Forced Offline Mode Enabled' 
                : !isOnline 
                  ? 'Network Error: Running in Offline Mode'
                  : ''}
            </Text>
          </View>
        )}
      </View>
    );
  }
  
  // Once loaded, redirect to home
  return <Redirect href="/home" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gradients.background[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 8,
  },
  debugText: {
    color: '#FF5BA1',
    textAlign: 'center',
    fontWeight: 'bold',
  },
}); 