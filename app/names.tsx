import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomTabBar from './components/BottomTabBar';
import Colors from '../constants/Colors';

// Get screen dimensions
const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

// Define types
type NameCardProps = {
  firstName: string;
  lastName: string;
  meaning: string;
  origin: string;
};

// Dummy data for demonstration
const generateDummyNames = (lastName: string, count = 20): NameCardProps[] => {
  const nameOptions = [
    { name: 'Oliver', meaning: 'Olive tree', origin: 'Latin' },
    { name: 'Emma', meaning: 'Universal', origin: 'Germanic' },
    { name: 'Liam', meaning: 'Strong-willed warrior', origin: 'Irish' },
    { name: 'Ava', meaning: 'Life', origin: 'Latin' },
    { name: 'Elijah', meaning: 'Jehovah is God', origin: 'Hebrew' },
    { name: 'Olivia', meaning: 'Olive tree', origin: 'Latin' },
    { name: 'Noah', meaning: 'Rest, comfort', origin: 'Hebrew' },
    { name: 'Sophia', meaning: 'Wisdom', origin: 'Greek' },
    { name: 'Lucas', meaning: 'Light-giving', origin: 'Latin' },
    { name: 'Isabella', meaning: 'Devoted to God', origin: 'Italian' },
    { name: 'Mason', meaning: 'Stone worker', origin: 'English' },
    { name: 'Mia', meaning: 'Mine', origin: 'Scandinavian' },
    { name: 'Logan', meaning: 'Small hollow', origin: 'Scottish' },
    { name: 'Charlotte', meaning: 'Free man', origin: 'French' },
    { name: 'Ethan', meaning: 'Strong, firm', origin: 'Hebrew' },
    { name: 'Amelia', meaning: 'Work', origin: 'Germanic' },
    { name: 'Aiden', meaning: 'Little fire', origin: 'Irish' },
    { name: 'Harper', meaning: 'Harp player', origin: 'English' },
    { name: 'James', meaning: 'Supplanter', origin: 'Hebrew' },
    { name: 'Evelyn', meaning: 'Wished for child', origin: 'English' },
    { name: 'Lincoln', meaning: 'From the lake settlement', origin: 'English' },
    { name: 'Ollie', meaning: 'Olive tree', origin: 'English' },
  ];

  const result: NameCardProps[] = [];
  
  // Shuffle the array to get random names
  const shuffled = [...nameOptions].sort(() => 0.5 - Math.random());
  
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    result.push({
      firstName: shuffled[i].name,
      lastName,
      meaning: shuffled[i].meaning,
      origin: shuffled[i].origin,
    });
  }
  
  return result;
};

export default function NamesScreen() {
  const params = useLocalSearchParams<{ lastName: string; gender: string; searchQuery: string }>();
  const lastName = params.lastName || '';
  const gender = params.gender || 'Any';
  const searchQuery = params.searchQuery || '';
  const insets = useSafeAreaInsets();
  
  const [names, setNames] = useState<NameCardProps[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedNames, setLikedNames] = useState<NameCardProps[]>([]);
  const [maybeNames, setMaybeNames] = useState<NameCardProps[]>([]);
  const [dislikedNames, setDislikedNames] = useState<NameCardProps[]>([]);
  
  const position = useRef(new Animated.ValueXY()).current;
  
  // Animation values for button feedback
  const likeButtonScale = useRef(new Animated.Value(1)).current;
  const maybeButtonScale = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Generate dummy names when the component mounts
    const generatedNames = generateDummyNames(lastName);
    setNames(generatedNames);
  }, [lastName]);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          swipeRight();
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          swipeLeft();
        } else if (gesture.dy < -SWIPE_THRESHOLD) {
          swipeUp();
        } else {
          resetPosition();
        }
      },
    })
  ).current;
  
  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };
  
  const swipeRight = () => {
    Animated.timing(position, {
      toValue: { x: SCREEN_WIDTH, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => onSwipeComplete('right'));
  };
  
  const swipeLeft = () => {
    Animated.timing(position, {
      toValue: { x: -SCREEN_WIDTH, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => onSwipeComplete('left'));
  };
  
  const swipeUp = () => {
    Animated.timing(position, {
      toValue: { x: 0, y: -SCREEN_WIDTH },
      duration: 250,
      useNativeDriver: false,
    }).start(() => onSwipeComplete('up'));
  };
  
  const onSwipeComplete = (direction: 'left' | 'right' | 'up') => {
    const currentName = names[currentIndex];
    
    // Only proceed if we have a valid name object
    if (currentName) {
      if (direction === 'right') {
        setLikedNames([...likedNames, currentName]);
      } else if (direction === 'left') {
        setDislikedNames([...dislikedNames, currentName]);
      } else if (direction === 'up') {
        setMaybeNames([...maybeNames, currentName]);
      }
    }
    
    position.setValue({ x: 0, y: 0 });
    setCurrentIndex(currentIndex + 1);
  };

  // Button animation functions
  const animateButton = (scaleValue: Animated.Value) => {
    // Scale up quickly
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      // Scale back down with a spring effect
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
  };
  
  // Enhance button press handlers with animations
  const handleLike = () => {
    animateButton(likeButtonScale);
    
    // Original function logic
    const likeName = names[currentIndex];
    if (likeName) {
      setLikedNames([...likedNames, likeName]);
    }
    swipeRight();
  };
  
  const handleMaybe = () => {
    animateButton(maybeButtonScale);
    
    // Original function logic
    const maybeName = names[currentIndex];
    if (maybeName) {
      setMaybeNames([...maybeNames, maybeName]);
    }
    swipeUp();
  };

  const handleDislike = () => {
    setCurrentIndex(currentIndex + 1);
  };
  
  const goToMatches = () => {
    // Filter out any null or undefined values before passing data
    const validLikedNames = likedNames.filter(name => name !== null && name !== undefined);
    const validMaybeNames = maybeNames.filter(name => name !== null && name !== undefined);
    
    router.push({
      pathname: '/likes',
      params: {
        likedNamesData: JSON.stringify(validLikedNames),
        maybeNamesData: JSON.stringify(validMaybeNames),
      }
    });
  };
  
  const refreshNames = () => {
    // Only include names that aren't null/undefined when creating the seenNames array
    const seenNames = [...likedNames, ...dislikedNames, ...maybeNames]
      .filter(name => name !== null && name !== undefined)
      .map(name => name.firstName);
      
    const newNames = generateDummyNames(lastName).filter(
      name => !seenNames.includes(name.firstName)
    );
    
    // Make sure we have at least some names, even if they've been seen before
    if (newNames.length === 0) {
      setNames(generateDummyNames(lastName));
    } else {
      setNames(newNames);
    }
    
    setCurrentIndex(0);
  };
  
  const goToNewSearch = () => {
    router.push('/home');
  };
  
  const getCardStyle = () => {
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
      outputRange: ['-30deg', '0deg', '30deg'],
    });
    
    return {
      ...position.getLayout(),
      transform: [{ rotate }],
    };
  };
  
  const renderNoMoreCards = () => (
    <View style={styles.noMoreCardsContainer}>
      <Text style={styles.noMoreCardsText}>No more names</Text>
      <TouchableOpacity style={styles.refreshButton} onPress={refreshNames}>
        <Text style={styles.refreshButtonText}>Generate More Names</Text>
      </TouchableOpacity>
    </View>
  );
  
  const renderCard = () => {
    if (currentIndex >= names.length) {
      return renderNoMoreCards();
    }
    
    const name = names[currentIndex];
    let bgColor = '#B799FF'; // Default purple

    // Simple color rotation for variety
    const colorOptions = ['#B799FF', '#ACBCFF', '#AEE2FF', '#E6FFFD'];
    const colorIndex = currentIndex % colorOptions.length;
    bgColor = colorOptions[colorIndex];
    
    return (
      <Animated.View
        style={[styles.card, getCardStyle()]}
        {...panResponder.panHandlers}
      >
        <LinearGradient
          colors={[bgColor, bgColor.replace('FF', '99')]}
          style={styles.cardGradient}
        >
          <Text style={styles.firstNameText}>{name.firstName}</Text>
          {name.lastName && <Text style={styles.lastNameText}>{name.lastName}</Text>}
          <Text style={styles.meaningText}>
            Means: {name.meaning}
          </Text>
        </LinearGradient>
      </Animated.View>
    );
  };
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.secondary.yellow, Colors.secondary.peach]}
        style={styles.background}
      >
        <SafeAreaView style={[styles.safeAreaContent, { paddingBottom: 0 }]}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.headerIconButton} 
              onPress={goToNewSearch}
              activeOpacity={0.6}
            >
              <Ionicons name="arrow-back" size={28} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerIconButton} 
              onPress={refreshNames}
              activeOpacity={0.6}
            >
              <Ionicons name="sync" size={28} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerIconButton} 
              onPress={goToMatches}
              activeOpacity={0.6}
            >
              <Ionicons name="arrow-forward" size={28} color="white" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.cardContainer}>
            {renderCard()}
          </View>
          
          <View style={[
            styles.controlsContainer, 
            { bottom: 80 + insets.bottom }
          ]}>
            <TouchableOpacity 
              style={[styles.controlButton, styles.dislikeButton]}
              onPress={handleDislike}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            
            <Animated.View style={{ transform: [{ scale: maybeButtonScale }] }}>
              <TouchableOpacity 
                style={[styles.controlButton, styles.maybeButton]}
                onPress={handleMaybe}
                activeOpacity={0.7}
              >
                <Text style={styles.questionMark}>?</Text>
              </TouchableOpacity>
            </Animated.View>
            
            <Animated.View style={{ transform: [{ scale: likeButtonScale }] }}>
              <TouchableOpacity 
                style={[styles.controlButton, styles.likeButton]}
                onPress={handleLike}
                activeOpacity={0.7}
              >
                <Ionicons name="heart" size={30} color="white" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </SafeAreaView>
        
        <View style={styles.tabBarContainer}>
          <BottomTabBar 
            likedNamesData={JSON.stringify(likedNames)}
            maybeNamesData={JSON.stringify(maybeNames)}
            backgroundColor={Colors.secondary.peach}
          />
        </View>
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
  safeAreaContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    alignItems: 'center',
  },
  headerIconButton: {
    padding: 10,
    borderRadius: 8,
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 140,
  },
  card: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 1.2,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 5,
  },
  cardGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  firstNameText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  lastNameText: {
    fontSize: 36,
    fontWeight: '500',
    color: 'white',
    opacity: 0.9,
    marginBottom: 20,
    textAlign: 'center',
  },
  meaningText: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  controlsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  likeButton: {
    backgroundColor: '#FF5BA1',
  },
  maybeButton: {
    backgroundColor: '#3CA3FF',
  },
  dislikeButton: {
    backgroundColor: '#B799FF',
  },
  questionMark: {
    fontSize: 30,
    fontWeight: 'bold',
    color: 'white',
  },
  noMoreCardsContainer: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
  },
  noMoreCardsText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F39F86',
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: '#F39F86',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
  },
}); 