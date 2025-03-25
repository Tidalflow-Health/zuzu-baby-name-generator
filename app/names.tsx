import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomTabBar from './components/BottomTabBar';
import Colors from '../constants/Colors';
import { useNameStatus } from '../hooks/useNameStatus';
import { useAINames } from '../hooks/useAINames';
import { FEATURES } from '../utils/appConfig';

// Get screen dimensions
const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

// Define types
type NameType = {
  firstName: string;
  lastName?: string;
  meaning: string;
  origin: string;
  gender: 'boy' | 'girl' | 'unisex' | 'any';
};

// Dummy data for demonstration
const generateDummyNames = (lastName: string, gender: 'boy' | 'girl' | 'any' = 'any', count = 20): NameType[] => {
  const nameOptions = [
    // Boy names
    { name: 'Oliver', meaning: 'Olive tree', origin: 'Latin', gender: 'boy' as const },
    { name: 'Liam', meaning: 'Strong-willed warrior', origin: 'Irish', gender: 'boy' as const },
    { name: 'Noah', meaning: 'Rest, comfort', origin: 'Hebrew', gender: 'boy' as const },
    { name: 'Ethan', meaning: 'Strong, enduring', origin: 'Hebrew', gender: 'boy' as const },
    { name: 'Lucas', meaning: 'Light', origin: 'Latin', gender: 'boy' as const },
    { name: 'Mason', meaning: 'Stone worker', origin: 'English', gender: 'boy' as const },
    
    // Girl names
    { name: 'Emma', meaning: 'Universal', origin: 'Germanic', gender: 'girl' as const },
    { name: 'Olivia', meaning: 'Olive tree', origin: 'Latin', gender: 'girl' as const },
    { name: 'Isabella', meaning: 'Pledged to God', origin: 'Hebrew', gender: 'girl' as const },
    { name: 'Sophia', meaning: 'Wisdom', origin: 'Greek', gender: 'girl' as const },
    { name: 'Charlotte', meaning: 'Free person', origin: 'French', gender: 'girl' as const },
    { name: 'Amelia', meaning: 'Work', origin: 'Germanic', gender: 'girl' as const },
    
    // Unisex names
    { name: 'Avery', meaning: 'Ruler of the elves', origin: 'English', gender: 'unisex' as const },
    { name: 'Jordan', meaning: 'Flowing down', origin: 'Hebrew', gender: 'unisex' as const },
    { name: 'Riley', meaning: 'Valiant', origin: 'Irish', gender: 'unisex' as const },
    { name: 'Morgan', meaning: 'Sea-born', origin: 'Welsh', gender: 'unisex' as const },
    { name: 'Taylor', meaning: 'Tailor', origin: 'English', gender: 'unisex' as const },
    { name: 'Alex', meaning: 'Defender', origin: 'Greek', gender: 'unisex' as const },
  ];

  // Filter names by gender if specified
  const filteredNames = gender === 'any' 
    ? nameOptions 
    : nameOptions.filter(name => name.gender === gender || name.gender === 'unisex');
    
  // Shuffle the filtered array to get random names
  const shuffled = [...filteredNames]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
  
  const result: NameType[] = [];
  
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    result.push({
      firstName: shuffled[i].name,
      lastName: lastName || '',
      meaning: shuffled[i].meaning,
      origin: shuffled[i].origin,
      gender: shuffled[i].gender,
    });
  }
  
  return result;
};

export default function NamesScreen() {
  const params = useLocalSearchParams<{ 
    lastName: string; 
    gender: 'boy' | 'girl' | 'any'; 
    searchQuery: string;
    useAI: string;
  }>();
  const lastName = params.lastName || '';
  const gender = (params.gender || 'any') as 'boy' | 'girl' | 'any';
  const searchQuery = params.searchQuery || '';
  const useAI = params.useAI === 'true' && FEATURES.AI_NAME_GENERATION;
  const insets = useSafeAreaInsets();
  
  // Use the useNameStatus hook for state management and persistence
  const { likedNames, maybeNames, dislikedNames, saveNameStatus } = useNameStatus();
  // Use the useAINames hook for AI-generated names
  const { fetchNames: fetchAINames, isLoading: isLoadingAINames } = useAINames();
  
  const [names, setNames] = useState<NameType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingNames, setIsLoadingNames] = useState(true);
  
  const position = useRef(new Animated.ValueXY()).current;
  
  // Animation values for button feedback
  const likeButtonScale = useRef(new Animated.Value(1)).current;
  const maybeButtonScale = useRef(new Animated.Value(1)).current;
  
  // Create a ref to store the names array so it's accessible in the panResponder
  const namesRef = useRef<NameType[]>([]);
  
  useEffect(() => {
    // Store names in the ref whenever it changes
    namesRef.current = names;
    console.log(`Names ref updated with ${namesRef.current.length} names`);
  }, [names]);
  
  useEffect(() => {
    // Generate names when the component mounts
    console.log("Generating names with:", { lastName, gender, searchQuery, useAI });
    setIsLoadingNames(true);
    
    async function generateNames() {
      try {
        let generatedNames: NameType[] = [];
        
        if (useAI) {
          // Use AI to generate names
          console.log("Using AI to generate names");
          const aiNames = await fetchAINames({
            lastName,
            gender,
            searchQuery,
            count: 20
          });
          
          generatedNames = aiNames;
          console.log(`Generated ${generatedNames.length} names using AI`);
        } else {
          // Use dummy names
          console.log("Using dummy names");
          generatedNames = generateDummyNames(lastName, gender);
          console.log(`Generated ${generatedNames.length} dummy names`);
        }
        
        if (generatedNames.length === 0) {
          console.error("Generated names array is empty");
          // Fallback to dummy names if AI failed to generate any
          if (useAI) {
            console.log("Falling back to dummy names");
            generatedNames = generateDummyNames(lastName, gender);
          }
        }
        
        // Set names in state and immediately update the ref
        setNames(generatedNames);
        namesRef.current = generatedNames;
        console.log(`Names ref set directly with ${generatedNames.length} names`);
        
      } catch (error) {
        console.error("Error generating names:", error);
        // Fallback to dummy names in case of error
        const dummyNames = generateDummyNames(lastName, gender);
        setNames(dummyNames);
        namesRef.current = dummyNames;
      } finally {
        setIsLoadingNames(false);
      }
    }
    
    generateNames();
  }, [lastName, gender, searchQuery, useAI, fetchAINames]);
  
  // Update panResponder for better swipe detection and handling with async functions
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Use namesRef.current instead of names to ensure we have the latest value
        const currentNames = namesRef.current;
        // Check if we have a valid name at the current index
        const hasValidName = currentNames[currentIndex] !== undefined;
        console.log(`Gesture check - current name: ${hasValidName ? currentNames[currentIndex].firstName : 'none'}, index: ${currentIndex}, names length: ${currentNames.length}`);
        
        if (!hasValidName) {
          console.log("Ignoring gesture - no valid name at current index");
          return false;
        }
        
        console.log(`Gesture allowed for: ${currentNames[currentIndex].firstName}`);
        return true;
      },
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
        
        // Visual feedback during swiping
        const rotate = gesture.dx / 20;
        position.flattenOffset();
      },
      onPanResponderRelease: (_, gesture) => {
        console.log("Gesture released:", gesture.dx, gesture.dy);
        
        // Use namesRef.current to ensure we have the latest value
        const currentNames = namesRef.current;
        
        // Double-check we have a valid name before processing
        if (!currentNames[currentIndex]) {
          console.log("Ignoring gesture release - no valid name at current index");
          resetPosition();
          return;
        }
        
        // Improved threshold detection
        const horizontalThreshold = SWIPE_THRESHOLD;
        const verticalThreshold = SWIPE_THRESHOLD * 0.8;
        
        // Determine the primary direction of the swipe
        const isHorizontalSwipe = Math.abs(gesture.dx) > Math.abs(gesture.dy);
        
        if (isHorizontalSwipe) {
          // Handle horizontal swipes (right or left)
          if (gesture.dx > horizontalThreshold) {
            console.log(`Swiping right detected for: ${currentNames[currentIndex].firstName}`);
            swipeRight().catch(error => {
              console.error("Error in swipe right gesture:", error);
              resetPosition(); // Reset position if saving fails
            });
          } else if (gesture.dx < -horizontalThreshold) {
            console.log(`Swiping left detected for: ${currentNames[currentIndex].firstName}`);
            swipeLeft().catch(error => {
              console.error("Error in swipe left gesture:", error);
              resetPosition(); // Reset position if saving fails
            });
          } else {
            // Not enough horizontal movement
            console.log("No horizontal swipe threshold reached, resetting position");
            resetPosition();
          }
        } else {
          // Handle vertical swipes (primarily up)
          if (gesture.dy < -verticalThreshold) {
            console.log(`Swiping up detected for: ${currentNames[currentIndex].firstName}`);
            swipeUp().catch(error => {
              console.error("Error in swipe up gesture:", error);
              resetPosition(); // Reset position if saving fails
            });
          } else {
            // Not enough vertical movement
            console.log("No vertical swipe threshold reached, resetting position");
            resetPosition();
          }
        }
      },
      onPanResponderTerminate: () => {
        // Handle cases where the gesture is interrupted
        console.log("Pan responder terminated");
        resetPosition();
      }
    })
  ).current;
  
  const resetPosition = () => {
    // Use spring for more natural bounce-back when the card is released without a full swipe
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 6, // Higher friction for faster settling
      tension: 40, // Good tension for responsive bounce
      useNativeDriver: false,
    }).start();
  };
  
  // Fix swipe functions to provide cleaner transitions
  const swipeRight = async () => {
    // Capture current index in a local variable to ensure we use the correct value
    const indexToUpdate = currentIndex;
    // Use namesRef.current to get the most up-to-date names array
    const currentNameObj = namesRef.current[indexToUpdate];
    
    console.log(`swipeRight called for index ${indexToUpdate}, names length: ${namesRef.current.length}`);
    
    if (!currentNameObj) {
      console.error(`No name found at index ${indexToUpdate}`);
      return;
    }
    
    // Make a local copy of the name to ensure it doesn't change during async operations
    const nameToSave = {...currentNameObj};
    
    console.log(`Processing swipe right for name: ${nameToSave.firstName}`);
    
    try {
      // Save to liked list with status 'liked' and await the completion
      console.log(`Initiating save for "${nameToSave.firstName}" to liked list`);
      await saveNameStatus(nameToSave, 'liked');
      console.log(`Successfully saved "${nameToSave.firstName}" to liked list`);
    } catch (error) {
      console.error(`Failed to save "${nameToSave.firstName}" to liked list:`, error);
      // Continue with animation even if save fails - UX should not be interrupted
    }

    // Animate the card off-screen with a smooth motion
    console.log(`Starting right swipe animation for "${nameToSave.firstName}"`);
    Animated.timing(position, {
      toValue: { x: SCREEN_WIDTH * 1.5, y: 0 },
      duration: 300, // Slightly faster for a cleaner transition
      useNativeDriver: false,
      easing: Easing.out(Easing.ease), // Add easing for more natural movement
    }).start(() => {
      // Only update state and reset position after animation completes
      console.log(`Right swipe animation completed for "${nameToSave.firstName}", advancing from index:`, indexToUpdate);
      
      // Reset position immediately to avoid visual glitches
      position.setValue({ x: 0, y: 0 });
      
      // Use a slight delay before updating the index to avoid animation jank
      setTimeout(() => {
        // Important: Use the state updater form to ensure we're working with the latest state
        setCurrentIndex(prevIndex => {
          console.log("Updating index from", prevIndex, "to", prevIndex + 1);
          return prevIndex + 1;
        });
        
        console.log("Card position reset, ready for next card");
      }, 50); // Small delay to ensure smooth transition
    });
  };
  
  const swipeLeft = async () => {
    // Capture current index in a local variable to ensure we use the correct value
    const indexToUpdate = currentIndex;
    // Use namesRef.current to get the most up-to-date names array
    const currentNameObj = namesRef.current[indexToUpdate];
    
    console.log(`swipeLeft called for index ${indexToUpdate}, names length: ${namesRef.current.length}`);
    
    if (!currentNameObj) {
      console.error(`No name found at index ${indexToUpdate}`);
      return;
    }
    
    // Make a local copy of the name to ensure it doesn't change during async operations
    const nameToSave = {...currentNameObj};
    
    console.log(`Processing swipe left for name: ${nameToSave.firstName}`);
    
    try {
      // Save to disliked list with status 'disliked' and await the completion
      console.log(`Initiating save for "${nameToSave.firstName}" to disliked list`);
      await saveNameStatus(nameToSave, 'disliked');
      console.log(`Successfully saved "${nameToSave.firstName}" to disliked list`);
    } catch (error) {
      console.error(`Failed to save "${nameToSave.firstName}" to disliked list:`, error);
      // Continue with animation even if save fails - UX should not be interrupted
    }

    // Animate the card off-screen with a smooth motion
    console.log(`Starting left swipe animation for "${nameToSave.firstName}"`);
    Animated.timing(position, {
      toValue: { x: -SCREEN_WIDTH * 1.5, y: 0 },
      duration: 300, // Slightly faster for a cleaner transition
      useNativeDriver: false,
      easing: Easing.out(Easing.ease), // Add easing for more natural movement
    }).start(() => {
      // Only update state and reset position after animation completes
      console.log(`Left swipe animation completed for "${nameToSave.firstName}", advancing from index:`, indexToUpdate);
      
      // Reset position immediately to avoid visual glitches
      position.setValue({ x: 0, y: 0 });
      
      // Use a slight delay before updating the index to avoid animation jank
      setTimeout(() => {
        // Important: Use the state updater form to ensure we're working with the latest state
        setCurrentIndex(prevIndex => {
          console.log("Updating index from", prevIndex, "to", prevIndex + 1);
          return prevIndex + 1;
        });
        
        console.log("Card position reset, ready for next card");
      }, 50); // Small delay to ensure smooth transition
    });
  };
  
  const swipeUp = async () => {
    // Capture current index in a local variable to ensure we use the correct value
    const indexToUpdate = currentIndex;
    // Use namesRef.current to get the most up-to-date names array
    const currentNameObj = namesRef.current[indexToUpdate];
    
    console.log(`swipeUp called for index ${indexToUpdate}, names length: ${namesRef.current.length}`);
    
    if (!currentNameObj) {
      console.error(`No name found at index ${indexToUpdate}`);
      return;
    }
    
    // Make a local copy of the name to ensure it doesn't change during async operations
    const nameToSave = {...currentNameObj};
    
    console.log(`Processing swipe up for name: ${nameToSave.firstName}`);
    
    try {
      // Save to maybe list with status 'maybe' and await the completion
      console.log(`Initiating save for "${nameToSave.firstName}" to maybe list`);
      await saveNameStatus(nameToSave, 'maybe');
      console.log(`Successfully saved "${nameToSave.firstName}" to maybe list`);
    } catch (error) {
      console.error(`Failed to save "${nameToSave.firstName}" to maybe list:`, error);
      // Continue with animation even if save fails - UX should not be interrupted
    }

    // Animate the card off-screen with a smooth motion
    console.log(`Starting up swipe animation for "${nameToSave.firstName}"`);
    Animated.timing(position, {
      toValue: { x: 0, y: -SCREEN_WIDTH * 1.5 },
      duration: 300, // Slightly faster for a cleaner transition
      useNativeDriver: false,
      easing: Easing.out(Easing.ease), // Add easing for more natural movement
    }).start(() => {
      // Only update state and reset position after animation completes
      console.log(`Up swipe animation completed for "${nameToSave.firstName}", advancing from index:`, indexToUpdate);
      
      // Reset position immediately to avoid visual glitches
      position.setValue({ x: 0, y: 0 });
      
      // Use a slight delay before updating the index to avoid animation jank
      setTimeout(() => {
        // Important: Use the state updater form to ensure we're working with the latest state
        setCurrentIndex(prevIndex => {
          console.log("Updating index from", prevIndex, "to", prevIndex + 1);
          return prevIndex + 1;
        });
        
        console.log("Card position reset, ready for next card");
      }, 50); // Small delay to ensure smooth transition
    });
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
  
  // Update button press handlers to use the async swipe functions
  const handleLike = () => {
    console.log("Like button pressed");
    
    // Check for a valid name at current index using the ref
    if (!namesRef.current[currentIndex]) {
      console.log("Like ignored - no valid name at current index");
      return;
    }
    
    console.log(`Handling like for: ${namesRef.current[currentIndex].firstName}`);
    animateButton(likeButtonScale);
    
    // Call the async swipe function but don't wait for it (fire and forget)
    // This keeps the UI responsive while the operation is happening
    swipeRight().catch(error => {
      console.error("Error in handleLike:", error);
    });
  };
  
  const handleMaybe = () => {
    console.log("Maybe button pressed");
    
    // Check for a valid name at current index using the ref
    if (!namesRef.current[currentIndex]) {
      console.log("Maybe ignored - no valid name at current index");
      return;
    }
    
    console.log(`Handling maybe for: ${namesRef.current[currentIndex].firstName}`);
    animateButton(maybeButtonScale);
    
    // Call the async swipe function but don't wait for it (fire and forget)
    swipeUp().catch(error => {
      console.error("Error in handleMaybe:", error);
    });
  };

  const handleDislike = () => {
    console.log("Dislike button pressed");
    
    // Check for a valid name at current index using the ref
    if (!namesRef.current[currentIndex]) {
      console.log("Dislike ignored - no valid name at current index");
      return;
    }
    
    console.log(`Handling dislike for: ${namesRef.current[currentIndex].firstName}`);
    
    // Call the async swipe function but don't wait for it (fire and forget)
    swipeLeft().catch(error => {
      console.error("Error in handleDislike:", error);
    });
  };
  
  const goToMatches = () => {
    // No need to pass data via params anymore - navigate to the likes screen directly
    router.push('/likes');
  };
  
  const refreshNames = useCallback(() => {
    // Create a helper function to check if a name is in the seen names list
    const isNameSeen = (nameToCheck: NameType) => {
      return [...likedNames, ...dislikedNames, ...maybeNames]
        .some(existingName => 
          existingName.firstName.toLowerCase() === nameToCheck.firstName.toLowerCase() &&
          ((!existingName.lastName && !nameToCheck.lastName) || 
           (existingName.lastName?.toLowerCase() === nameToCheck.lastName?.toLowerCase()))
        );
    };
    
    // Generate new names that haven't been seen
    const newNames = generateDummyNames(lastName, gender).filter(name => !isNameSeen(name));
    
    // Make sure we have at least some names, even if they've been seen before
    if (newNames.length === 0) {
      setNames(generateDummyNames(lastName, gender));
    } else {
      setNames(newNames);
    }
    
    setCurrentIndex(0);
  }, [likedNames, dislikedNames, maybeNames, lastName, gender]);
  
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
  
  // Render multiple cards in a stack like Tinder
  const renderCards = () => {
    // Show a loading indicator when names are loading
    if (isLoadingNames) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF5BA1" />
          <Text style={styles.loadingText}>
            {useAI ? 'Generating creative names with AI...' : 'Loading names...'}
          </Text>
          {useAI && (
            <Text style={styles.aiSubtext}>
              This may take a few moments
            </Text>
          )}
        </View>
      );
    }
    
    // Handle empty names array
    if (names.length === 0) {
      return (
        <View style={styles.noMoreCardsContainer}>
          <Text style={styles.noMoreCardsText}>No names available</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={refreshNames}>
            <Text style={styles.refreshButtonText}>Generate Names</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Show "No more names" when we've gone through all names
    if (currentIndex >= names.length) {
      return renderNoMoreCards();
    }
    
    // In Tinder, we only show the current card fully visible and the next card partially behind
    const cards = names
      .slice(currentIndex, currentIndex + 2) // Get current and next card
      .map((name, index) => {
        if (index === 0) {
          // Top card - fully visible and interactive
          return renderTopCard(name);
        } else {
          // Next card - initially hidden underneath
          return renderNextCard(name);
        }
      });
    
    // Render in reverse to ensure proper z-index (next card behind top card)
    return (
      <View style={styles.cardsContainer}>
        {cards.reverse()}
      </View>
    );
  };
  
  // The top card that users interact with
  const renderTopCard = (name: NameType) => {
    console.log(`Rendering top card for name: ${name?.firstName || 'undefined'}`);
    
    if (!name) {
      console.error("Attempted to render top card with null name");
      return null;
    }
    
    let gradientColors: [string, string];
    
    // Set gradient colors based on gender
    if (name.gender === 'boy') {
      gradientColors = Colors.gender.boy.gradient as [string, string];
    } else if (name.gender === 'girl') {
      gradientColors = Colors.gender.girl.gradient as [string, string];
    } else if (name.gender === 'unisex') {
      gradientColors = Colors.gender.neutral.gradient as [string, string];
    } else {
      gradientColors = Colors.gender.neutral.gradient as [string, string];
    }
    
    // Get rotation based on position for realistic card movement
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
      outputRange: ['-30deg', '0deg', '30deg'],
    });
    
    return (
      <Animated.View
        key={`card-${currentIndex}`}
        style={[
          styles.card,
          {
            transform: [
              { translateX: position.x },
              { translateY: position.y },
              { rotate },
            ],
            zIndex: 2,
          }
        ]}
        {...panResponder.panHandlers}
      >
        <LinearGradient
          colors={gradientColors}
          style={styles.cardGradient}
          start={{ x: 0, y: 0.7 }}
          end={{ x: 0, y: 1 }}
        >
          <Text style={styles.firstNameText}>{name.firstName}</Text>
          {name.lastName && <Text style={styles.lastNameText}>{name.lastName}</Text>}
          <Text style={styles.meaningText}>
            {name.meaning}
          </Text>
        </LinearGradient>
      </Animated.View>
    );
  };
  
  // The next card that's hidden underneath
  const renderNextCard = (name: NameType) => {
    console.log(`Rendering next card for name: ${name?.firstName || 'undefined'}`);
    
    if (!name) {
      console.error("Attempted to render next card with null name");
      return null;
    }
    
    let gradientColors: [string, string];
    
    // Set gradient colors based on gender
    if (name.gender === 'boy') {
      gradientColors = Colors.gender.boy.gradient as [string, string];
    } else if (name.gender === 'girl') {
      gradientColors = Colors.gender.girl.gradient as [string, string];
    } else if (name.gender === 'unisex') {
      gradientColors = Colors.gender.neutral.gradient as [string, string];
    } else {
      gradientColors = Colors.gender.neutral.gradient as [string, string];
    }
    
    // Simplify next card rendering - no animations
    return (
      <View
        key={`next-card-${currentIndex + 1}`}
        style={[
          styles.card,
          styles.nextCard,
          {
            // Fixed position with slight scaling down and reduced opacity
            transform: [{ scale: 0.95 }],
            opacity: 0.7,
            zIndex: 1,
          }
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          style={styles.cardGradient}
          start={{ x: 0, y: 0.7 }}
          end={{ x: 0, y: 1 }}
        >
          <Text style={styles.firstNameText}>{name.firstName}</Text>
          {name.lastName && <Text style={styles.lastNameText}>{name.lastName}</Text>}
          <Text style={styles.meaningText}>
            {name.meaning}
          </Text>
        </LinearGradient>
      </View>
    );
  };
  
  // Add debugging log for names array
  useEffect(() => {
    console.log(`Loaded ${names.length} names, current index: ${currentIndex}`);
  }, [names, currentIndex]);
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.gradients.background[0], Colors.gradients.background[1]]}
        style={styles.background}
      >
        <SafeAreaView style={[styles.safeAreaContent, { paddingBottom: 0 }]}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.headerIconButton} 
              onPress={goToNewSearch}
              activeOpacity={0.6}
            >
              <Ionicons name="arrow-back" size={28} color="black" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerIconButton} 
              onPress={refreshNames}
              activeOpacity={0.6}
            >
              <Ionicons name="sync" size={28} color="black" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerIconButton} 
              onPress={goToMatches}
              activeOpacity={0.6}
            >
              <Ionicons name="arrow-forward" size={28} color="black" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.cardContainer}>
            {renderCards()}
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
            backgroundColor={Colors.gradients.background[1]}
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
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    letterSpacing: 0.5,
  },
  lastNameText: {
    fontSize: 36,
    fontWeight: '600',
    color: 'white',
    opacity: 0.95,
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    letterSpacing: 0.3,
  },
  meaningText: {
    fontSize: 20,
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    letterSpacing: 0.3,
    fontWeight: '600',
    lineHeight: 28,
    paddingHorizontal: 20,
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
  staticCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  cardsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FF5BA1',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
  },
  aiSubtext: {
    color: '#FF5BA1',
    fontSize: 14,
    opacity: 0.8,
    marginTop: 10,
    textAlign: 'center',
    maxWidth: '80%',
  },
}); 