import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Image,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomTabBar from './components/BottomTabBar';
import Colors from '../constants/Colors';
import { Link } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useNames } from '../hooks/useNames';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ZUZU_PINK = '#FF5BA1'; // Adding Zuzu pink color constant

export default function HomeScreen() {
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('Any');
  const [searchQuery, setSearchQuery] = useState('');
  const [likedNames, setLikedNames] = useState([]);
  const [maybeNames, setMaybeNames] = useState([]);
  const [showLastNameInput, setShowLastNameInput] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const insets = useSafeAreaInsets();
  const { session, isOnline } = useAuth();
  const { pendingOperations, syncPendingOperations } = useNames();

  // Animation for the last name input - ensure it has an initial value of 0
  const lastNameInputHeight = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Check sync status periodically
    const checkSyncStatus = async () => {
      try {
        const pendingOps = await AsyncStorage.getItem('zuzu_pending_operations');
        const pendingCount = pendingOps ? JSON.parse(pendingOps).length : 0;
        
        if (pendingCount > 0) {
          setSyncStatus(`⚠️ ${pendingCount} pending changes to sync`);
        } else if (!isOnline) {
          setSyncStatus('📴 Offline mode - changes will sync when online');
        } else {
          setSyncStatus('✅ All changes synced');
        }
      } catch (error) {
        setSyncStatus('❌ Error checking sync status');
      }
    };

    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [isOnline]);

  const toggleLastNameInput = () => {
    setShowLastNameInput(!showLastNameInput);
    
    // Animate to the proper height or back to 0
    Animated.timing(lastNameInputHeight, {
      toValue: showLastNameInput ? 0 : 70, // Slightly taller to ensure visibility
      duration: 300,
      useNativeDriver: false,
    }).start();
  };
  
  const handleSearch = () => {
    router.push({
      pathname: '/names',
      params: {
        lastName,
        gender,
        searchQuery,
        newSearch: 'true',
      },
    });
  };

  const goToNames = () => {
    router.push('/names');
  };

  const goToLikes = () => {
    router.push({
      pathname: '/likes',
      params: {
        likedNamesData: JSON.stringify(likedNames),
        maybeNamesData: JSON.stringify(maybeNames)
      }
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.gradients.background[0], Colors.gradients.background[1]]}
        style={styles.background}
      >
        <SafeAreaView style={styles.content}>
          {/* Status Bar */}
          <View style={styles.statusBar}>
            <View style={styles.statusItem}>
              <Ionicons 
                name={session ? "checkmark-circle" : "alert-circle"} 
                size={16} 
                color={session ? "white" : "#FFD700"} 
              />
              <Text style={styles.statusText}>
                {session ? "Authenticated" : "Not Authenticated"}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons 
                name={isOnline ? "wifi" : "cloud-offline"} 
                size={16} 
                color={isOnline ? "white" : "#FFD700"} 
              />
              <Text style={styles.statusText}>
                {isOnline ? "Online" : "Offline"}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons 
                name="sync" 
                size={16} 
                color="white" 
              />
              <Text style={styles.statusText}>
                {syncStatus}
              </Text>
            </View>
          </View>

          <View style={styles.centeredContent}>
            <View style={styles.titleContainer}>
              <Image 
                source={require('../assets/images/ZuzuLogo.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={[styles.appSubtitle, { color: ZUZU_PINK }]}>Baby Names</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Enter name ideas, themes, or preferences..."
                  placeholderTextColor={Colors.neutral.gray}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  style={styles.searchIconButton}
                  onPress={handleSearch}
                >
                  <Ionicons
                    name="search"
                    size={22}
                    color="#FF5BA1"
                  />
                </TouchableOpacity>
              </View>
              
              <View style={styles.optionsContainer}>
                <View>
                  <Text style={[styles.formLabel, { color: ZUZU_PINK }]}>Gender</Text>
                  <View style={styles.genderOptions}>
                    <TouchableOpacity
                      style={[
                        styles.genderIconOption,
                        gender === 'Boy' && styles.activeGenderOption,
                        { backgroundColor: gender === 'Boy' ? 'white' : '#4FB0FF' }
                      ]}
                      onPress={() => setGender('Boy')}
                    >
                      <Ionicons 
                        name="male" 
                        size={20} 
                        color={gender === 'Boy' ? '#4FB0FF' : 'white'} 
                      />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.genderIconOption,
                        gender === 'Girl' && styles.activeGenderOption,
                        { backgroundColor: gender === 'Girl' ? 'white' : '#FF5BA1' }
                      ]}
                      onPress={() => setGender('Girl')}
                    >
                      <Ionicons 
                        name="female" 
                        size={20} 
                        color={gender === 'Girl' ? '#FF5BA1' : 'white'} 
                      />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.genderIconOption,
                        gender === 'Any' && styles.activeGenderOption,
                        { backgroundColor: '#B799FF' }
                      ]}
                      onPress={() => setGender('Any')}
                    >
                      <Text 
                        style={[
                          styles.questionMarkText,
                          { color: 'white' }
                        ]}
                      >
                        ?
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View>
                  <Text style={[styles.formLabel, { color: ZUZU_PINK }]}>Last Name</Text>
                  <TouchableOpacity
                    style={[
                      styles.lastNameButton,
                      { backgroundColor: '#F0F0F0' }
                    ]}
                    onPress={toggleLastNameInput}
                  >
                    <Ionicons 
                      name="pencil" 
                      size={20} 
                      color="black" 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              
              <Animated.View 
                style={{ 
                  height: lastNameInputHeight, 
                  overflow: 'hidden',
                  marginBottom: showLastNameInput ? 16 : 0 
                }}
              >
                <View style={styles.searchInputContainer}>
                  <TextInput
                    style={styles.searchInput}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Enter last name"
                    placeholderTextColor="black"
                    autoFocus={showLastNameInput}
                    returnKeyType="done"
                  />
                </View>
              </Animated.View>
              
              <TouchableOpacity
                style={styles.findNamesButton}
                onPress={handleSearch}
              >
                <Text style={styles.findNamesButtonText}>Find Names</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tabBarContainer}>
            <BottomTabBar 
              likedNamesData={JSON.stringify(likedNames)}
              maybeNamesData={JSON.stringify(maybeNames)}
              backgroundColor={Colors.gradients.background[1]}
            />
          </View>
          
          {/* Test link - dev only */}
          {/* <Link href="/test" asChild>
            <TouchableOpacity 
              style={styles.testButton}
              accessibilityLabel="Test Supabase Integration"
            >
              <Text style={styles.testButtonText}>Test Supabase</Text>
            </TouchableOpacity>
          </Link> */}
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
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 100, // Leave space for the tab bar
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    color: 'white',
  },
  appSubtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  formContainer: {
    marginHorizontal: 24,
  },
  searchInputContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontFamily: 'System',  // This will use San Francisco on iOS
    fontSize: 16,
    color: 'black',
  },
  searchIconButton: {
    padding: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  genderOptions: {
    flexDirection: 'row',
  },
  genderIconOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeGenderOption: {
    borderColor: 'white',
  },
  questionMarkText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  lastNameButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  findNamesButton: {
    backgroundColor: '#FF5BA1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  findNamesButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'System',  // This will use San Francisco on iOS
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
  },
  testButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: '#5E5CE6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  testButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    marginBottom: 16,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
  },
}); 