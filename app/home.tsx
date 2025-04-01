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
import Colors from '@/constants/Colors';
import { Link } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useNames } from '@/hooks/useNames';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ZUZU_PURPLE = '#6A5AFF'; // Adding Zuzu purple color constant

export default function HomeScreen() {
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('Any');
  const [searchQuery, setSearchQuery] = useState('');
  const [likedNames, setLikedNames] = useState([]);
  const [maybeNames, setMaybeNames] = useState([]);
  const [showLastNameInput, setShowLastNameInput] = useState(false);
  const insets = useSafeAreaInsets();
  const { session, isOnline } = useAuth();
  const { pendingOperations, syncPendingOperations } = useNames();

  // Animation for the last name input - ensure it has an initial value of 0
  const lastNameInputHeight = useRef(new Animated.Value(0)).current;
  
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
      <StatusBar style="dark" />
      <View style={styles.background}>
        <SafeAreaView style={styles.content}>
          {/* Removing Status Bar */}

          <View style={styles.centeredContent}>
            <View style={styles.titleContainer}>
              <Image 
                source={require('@assets/images/ZuzuLogo.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={[styles.appSubtitle, { color: ZUZU_PURPLE }]}>Baby Name Generator</Text>
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
                    name="chevron-forward"
                    size={28}
                    color="#6A5AFF"
                  />
                </TouchableOpacity>
              </View>
              
              <View style={styles.optionsContainer}>
                <View>
                  <Text style={[styles.formLabel, { color: ZUZU_PURPLE }]}>Baby Gender</Text>
                  <View style={styles.genderOptions}>
                    <TouchableOpacity
                      style={[
                        styles.genderIconOption,
                        { 
                          backgroundColor: gender === 'Boy' ? '#4FB0FF' : '#F5F5F5',
                        }
                      ]}
                      onPress={() => setGender('Boy')}
                    >
                      <Ionicons 
                        name="male" 
                        size={20} 
                        color={gender === 'Boy' ? 'white' : '#000000'} 
                      />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.genderIconOption,
                        { 
                          backgroundColor: gender === 'Girl' ? '#FF5BA1' : '#F5F5F5',
                        }
                      ]}
                      onPress={() => setGender('Girl')}
                    >
                      <Ionicons 
                        name="female" 
                        size={20} 
                        color={gender === 'Girl' ? 'white' : '#000000'} 
                      />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.genderIconOption,
                        { 
                          backgroundColor: gender === 'Any' ? '#6A5AFF' : '#F5F5F5',
                        }
                      ]}
                      onPress={() => setGender('Any')}
                    >
                      <Text style={{ 
                        fontSize: 20, 
                        color: gender === 'Any' ? 'white' : '#000000',
                        fontWeight: '600'
                      }}>?</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View>
                  <Text style={[styles.formLabel, { color: ZUZU_PURPLE }]}>Baby Last Name</Text>
                  <View style={styles.lastNameInputContainer}>
                    <TextInput
                      style={styles.lastNameInput}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Enter last name"
                      placeholderTextColor={Colors.neutral.gray}
                      returnKeyType="done"
                    />
                  </View>
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
                <Text style={styles.findNamesButtonText}>Find Baby Names</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tabBarContainer}>
            <BottomTabBar 
              likedNamesData={JSON.stringify(likedNames)}
              maybeNamesData={JSON.stringify(maybeNames)}
              backgroundColor="white"
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: 'white',
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
    borderWidth: 1,
    borderColor: '#EEEEEE',
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
    marginHorizontal: 8,
  },
  activeGenderOption: {
    borderColor: 'transparent',
  },
  questionMarkText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  lastNameInputContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    width: 150,
  },
  lastNameInput: {
    height: 40,
    fontSize: 16,
    color: 'black',
    fontFamily: 'System',
  },
  findNamesButton: {
    backgroundColor: '#6A5AFF',
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
}); 