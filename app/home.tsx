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

export default function HomeScreen() {
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('Any');
  const [searchQuery, setSearchQuery] = useState('');
  const [likedNames, setLikedNames] = useState([]);
  const [maybeNames, setMaybeNames] = useState([]);
  const [showLastNameInput, setShowLastNameInput] = useState(false);
  const insets = useSafeAreaInsets();

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
        colors={[Colors.secondary.yellow, Colors.secondary.peach]}
        style={styles.background}
      >
        <SafeAreaView style={styles.content}>
          <View style={styles.centeredContent}>
            <View style={styles.titleContainer}>
              <Image 
                source={require('../assets/images/ZuzuLogo.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.appSubtitle}>Baby Name Generator</Text>
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
                    color={Colors.primary.main}
                  />
                </TouchableOpacity>
              </View>
              
              <View style={styles.optionsContainer}>
                <View>
                  <Text style={styles.formLabel}>Gender</Text>
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
                  <Text style={styles.formLabel}>Last Name</Text>
                  <TouchableOpacity
                    style={[
                      styles.lastNameButton,
                      { backgroundColor: '#F9D976' }
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
                    placeholderTextColor={Colors.neutral.gray}
                    autoFocus={showLastNameInput}
                    returnKeyType="done"
                  />
                </View>
              </Animated.View>
              
              <TouchableOpacity
                style={styles.searchButton}
                onPress={handleSearch}
              >
                <LinearGradient
                  colors={[Colors.primary.main, Colors.primary.dark]}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.buttonText}>Find Names</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tabBarContainer}>
            <BottomTabBar 
              likedNamesData={JSON.stringify(likedNames)}
              maybeNamesData={JSON.stringify(maybeNames)}
              backgroundColor={Colors.secondary.peach}
            />
          </View>
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
    marginBottom: 30,
  },
  logo: {
    width: 180,
    height: 80,
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.neutral.white,
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  appSubtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginHorizontal: 20,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.4)',
  },
  formContainer: {
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral.white,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: Colors.neutral.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  searchInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.onLight,
    backgroundColor: 'transparent',
  },
  searchIconButton: {
    padding: 10,
    marginRight: 5,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.onDark,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  genderOptions: {
    flexDirection: 'row',
    marginRight: 8,
  },
  genderIconOption: {
    width: 44,
    height: 44,
    marginRight: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  lastNameButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  activeGenderOption: {
    backgroundColor: Colors.neutral.white,
  },
  questionMarkText: {
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  searchButton: {
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: Colors.neutral.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 30,
  },
  buttonText: {
    color: Colors.text.onDark,
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
  },
}); 