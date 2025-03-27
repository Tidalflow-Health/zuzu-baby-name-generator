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
  Modal,
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
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Storage keys for session persistence
const CURRENT_SEARCH_KEY = 'zuzu_current_search';
const CURRENT_NAMES_KEY = 'zuzu_current_names';
const CURRENT_INDEX_KEY = 'zuzu_current_index';

export default function NamesScreen() {
  const params = useLocalSearchParams<{ 
    lastName: string; 
    gender: 'boy' | 'girl' | 'any'; 
    searchQuery: string;
    newSearch: string; // Flag to indicate if this is a new search
  }>();
  const newSearch = params.newSearch === 'true';
  const lastName = params.lastName || '';
  const gender = (params.gender || 'any') as 'boy' | 'girl' | 'any';
  const searchQuery = params.searchQuery || '';
  const insets = useSafeAreaInsets();
  
  // Use the useNameStatus hook for state management and persistence
  const { likedNames, maybeNames, dislikedNames, saveNameStatus } = useNameStatus();
  // Use the useAINames hook for AI-generated names
  const { fetchNames: fetchAINames, isLoading: isLoadingAINames } = useAINames();
  
  const [names, setNames] = useState<NameType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingNames, setIsLoadingNames] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitiatedSearch, setHasInitiatedSearch] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [isGeneratingNextBatch, setIsGeneratingNextBatch] = useState(false);
  const [pendingNames, setPendingNames] = useState<NameType[]>([]);
  
  const position = useRef(new Animated.ValueXY()).current;
  
  // Animation values for button feedback
  const likeButtonScale = useRef(new Animated.Value(1)).current;
  const maybeButtonScale = useRef(new Animated.Value(1)).current;
  
  // Create a ref to store the names array so it's accessible in the panResponder
  const namesRef = useRef<NameType[]>([]);
  
  // Add a flag to prevent multiple swipes from processing simultaneously
  const [isProcessingSwipe, setIsProcessingSwipe] = useState(false);
  
  useEffect(() => {
    // Store names in the ref whenever it changes
    namesRef.current = names;
    console.log(`Names ref updated with ${namesRef.current.length} names`);
  }, [names]);
  
  // Load saved search session on first mount
  useEffect(() => {
    async function loadSavedSession() {
      try {
        // Check if we're forcing a new search
        if (newSearch) {
          // Clear previous session data and start fresh
          await AsyncStorage.multiRemove([CURRENT_SEARCH_KEY, CURRENT_NAMES_KEY, CURRENT_INDEX_KEY]);
          console.log("Starting new search, cleared previous session");
          setHasInitiatedSearch(true);
          return;
        }
        
        // First check if there's a search in progress
        const savedSearchJSON = await AsyncStorage.getItem(CURRENT_SEARCH_KEY);
        
        if (savedSearchJSON) {
          const savedSearch = JSON.parse(savedSearchJSON);
          console.log("Found saved search:", savedSearch);
          
          // If there are route params, they take precedence
          if (lastName || gender !== 'any' || searchQuery) {
            console.log("Using route params over saved search");
            setHasInitiatedSearch(true);
            return;
          }
          
          // Load saved names and index
          const savedNamesJSON = await AsyncStorage.getItem(CURRENT_NAMES_KEY);
          const savedIndexString = await AsyncStorage.getItem(CURRENT_INDEX_KEY);
          
          if (savedNamesJSON && savedIndexString) {
            const savedNames = JSON.parse(savedNamesJSON);
            const savedIndex = parseInt(savedIndexString, 10);
            
            console.log(`Restoring saved session: ${savedNames.length} names, index ${savedIndex}`);
            
            // Restore the saved state
            setNames(savedNames);
            setCurrentIndex(savedIndex);
            namesRef.current = savedNames;
            setIsLoadingNames(false);
            // Only set hasInitiatedSearch to true if we have explicit search parameters
            // or if this is a resumed session from a previous explicit search
            const hasExplicitSearch = 
              lastName !== '' || 
              gender !== 'any' || 
              searchQuery !== '' || 
              savedSearch.lastName !== '' || 
              savedSearch.gender !== 'any' || 
              savedSearch.searchQuery !== '';
            
            if (hasExplicitSearch) {
              setHasInitiatedSearch(true);
            } else {
              console.log("Restored empty search session, not triggering name generation");
              setHasInitiatedSearch(false);
            }
          } else {
            console.log("Found saved search but no saved names/index, starting fresh");
            // Only set hasInitiatedSearch if we have explicit search parameters
            setHasInitiatedSearch(lastName !== '' || gender !== 'any' || searchQuery !== '');
          }
        } else {
          // No saved search, check if we have route params
          if (lastName || gender !== 'any' || searchQuery) {
            console.log("No saved search, but found route params");
            setHasInitiatedSearch(true);
          } else {
            console.log("No saved search or route params, showing placeholder");
            setIsLoadingNames(false);
            setHasInitiatedSearch(false);
          }
        }
      } catch (error) {
        console.error("Error loading saved session:", error);
        // If there's an error, default to the normal flow
        if (lastName || gender !== 'any' || searchQuery) {
          setHasInitiatedSearch(true);
        } else {
          setIsLoadingNames(false);
          setHasInitiatedSearch(false);
        }
      }
    }
    
    loadSavedSession();
  }, [lastName, gender, searchQuery, newSearch]);
  
  // Save the current search between sessions
  useEffect(() => {
    if (!hasInitiatedSearch || names.length === 0) return;
    
    async function saveCurrentSession() {
      try {
        const searchParams = { lastName, gender, searchQuery };
        
        // Only save if we have at least one meaningful search parameter
        const hasSearchParams = 
          lastName !== '' || 
          gender !== 'any' || 
          searchQuery !== '';
          
        if (!hasSearchParams) {
          console.log("No meaningful search parameters, skipping session save");
          return;
        }
        
        await AsyncStorage.setItem(CURRENT_SEARCH_KEY, JSON.stringify(searchParams));
        await AsyncStorage.setItem(CURRENT_NAMES_KEY, JSON.stringify(names));
        await AsyncStorage.setItem(CURRENT_INDEX_KEY, currentIndex.toString());
        console.log(`Saved current session: search params, ${names.length} names, index ${currentIndex}`);
      } catch (error) {
        console.error("Error saving current session:", error);
      }
    }
    
    saveCurrentSession();
  }, [hasInitiatedSearch, names, currentIndex, lastName, gender, searchQuery]);
  
  useEffect(() => {
    // Generate names when the component mounts and there's a search to perform
    if (!hasInitiatedSearch) {
      console.log("No search initiated, skipping name generation");
      return;
    }
    
    // If we have names, don't regenerate them
    if (names.length > 0) {
      console.log("Using existing names, not generating new ones");
      return;
    }
    
    console.log("Generating names with:", { lastName, gender, searchQuery });
    setIsLoadingNames(true);
    setError(null);
    
    async function generateNames() {
      try {
        // Use AI to generate names
        console.log("Generating AI names");
        const aiNames = await fetchAINames({
          lastName,
          gender,
          searchQuery,
          count: 20
        });
        
        if (aiNames.length === 0) {
          console.error("Generated names array is empty");
          setError("No names were generated. Please try again or change your search criteria.");
          setIsLoadingNames(false);
          return;
        }
        
        // Set initial batch of names (first 5)
        const initialBatch = aiNames.slice(0, 5);
        setNames(initialBatch);
        namesRef.current = initialBatch;
        console.log(`Set initial batch of ${initialBatch.length} names`);
        
        // Store remaining names as pending
        setPendingNames(aiNames.slice(5));
        
      } catch (error) {
        console.error("Error generating names:", error);
        setError(`Error generating names. Please check your connection and try again.`);
      } finally {
        setIsLoadingNames(false);
      }
    }
    
    generateNames();
  }, [hasInitiatedSearch, lastName, gender, searchQuery, fetchAINames]);
  
  // Add effect to handle adding more names when needed
  useEffect(() => {
    // If we're close to running out of names (3 or fewer left) and have pending names
    if (names.length - currentIndex <= 3 && pendingNames.length > 0 && !isGeneratingNextBatch) {
      setIsGeneratingNextBatch(true);
      
      // Add next batch of names (5 more)
      const nextBatch = pendingNames.slice(0, 5);
      setNames(prevNames => [...prevNames, ...nextBatch]);
      namesRef.current = [...namesRef.current, ...nextBatch];
      setPendingNames(prevPending => prevPending.slice(5));
      
      setIsGeneratingNextBatch(false);
    }
  }, [currentIndex, names.length, pendingNames.length, isGeneratingNextBatch]);
  
  // Update panResponder for better swipe detection and handling with async functions
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Skip gesture detection if already processing a swipe
        if (isProcessingSwipe) {
          console.log("Ignoring gesture - already processing a swipe");
          return false;
        }
        
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
        
        // Skip if already processing a swipe
        if (isProcessingSwipe) {
          console.log("Ignoring gesture release - already processing a swipe");
          resetPosition();
          return;
        }
        
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
  
  // Add a function to check if we've reached the end of cards
  const checkEndOfCards = useCallback((indexValue: number) => {
    console.log(`Checking end of cards: index=${indexValue}, names.length=${names.length}`);
    
    // Only show the modal when we've reached the LAST card (not just any card)
    if (indexValue === names.length - 1) {
      console.log("Reached end of cards, showing completion modal");
      setShowCompletionModal(true);
    }
  }, [names.length]);
  
  // Common function to update session state after each swipe
  const updateSessionAfterSwipe = async (indexToUpdate: number) => {
    try {
      // Update current index in AsyncStorage
      await AsyncStorage.setItem(CURRENT_INDEX_KEY, (indexToUpdate + 1).toString());
      console.log(`Updated session index to ${indexToUpdate + 1}`);
      
      // Check if we've reached the end of cards after updating the index
      checkEndOfCards(indexToUpdate);
      
      // No matter what, don't clear the session - let the user see all cards
      // and only clear when they explicitly start a new search
    } catch (error) {
      console.error("Error updating session after swipe:", error);
    }
  };

  const swipeRight = async () => {
    // Prevent multiple swipes from processing at once
    if (isProcessingSwipe) {
      console.log("Ignoring swipe - already processing another swipe");
      return;
    }
    
    try {
      setIsProcessingSwipe(true);
      
      // Capture current index in a local variable to ensure we use the correct value
      const indexToUpdate = currentIndex;
      // Use namesRef.current to get the most up-to-date names array
      const currentNameObj = namesRef.current[indexToUpdate];
      
      console.log(`swipeRight called for index ${indexToUpdate}, names length: ${namesRef.current.length}`);
      
      if (!currentNameObj) {
        console.error(`No name found at index ${indexToUpdate}`);
        setIsProcessingSwipe(false);
        return;
      }
      
      // Make a local copy of the name to ensure it doesn't change during async operations
      const nameToSave = {...currentNameObj};
      
      console.log(`Processing swipe right for name: ${nameToSave.firstName}`);
      
      // Define the success flag to track if save completed
      let saveSuccessful = false;
      
      try {
        // Save to liked list with status 'liked' and await the completion
        console.log(`Initiating save for "${nameToSave.firstName}" to liked list`);
        await saveNameStatus(nameToSave, 'liked');
        console.log(`Successfully saved "${nameToSave.firstName}" to liked list`);
        
        // Update session state after successful save
        await updateSessionAfterSwipe(indexToUpdate);
        
        // Mark save as successful
        saveSuccessful = true;
      } catch (error) {
        console.error(`Failed to save "${nameToSave.firstName}" to liked list:`, error);
        // Continue with animation even if save fails - UX should not be interrupted
      }
  
      // Check if we've reached the end of cards before starting animation
      checkEndOfCards(indexToUpdate);
  
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
        
        // Only increment the index if save was successful
        if (saveSuccessful) {
          // Use a slight delay before updating the index to avoid animation jank
          setTimeout(() => {
            // Important: Use the state updater form to ensure we're working with the latest state
            setCurrentIndex(prevIndex => {
              console.log("Updating index from", prevIndex, "to", prevIndex + 1);
              return prevIndex + 1;
            });
            
            // Reset the processing flag
            setIsProcessingSwipe(false);
            console.log("Card position reset, ready for next card");
            
            // Check if we've reached the end of cards
            checkEndOfCards(indexToUpdate);
          }, 50); // Small delay to ensure smooth transition
        } else {
          // Reset the processing flag even if save failed
          setIsProcessingSwipe(false);
          console.log("Card position reset, but index not incremented due to save failure");
        }
      });
    } catch (error) {
      console.error("Error in swipe right:", error);
      setIsProcessingSwipe(false);
    }
  };
  
  const swipeLeft = async () => {
    // Prevent multiple swipes from processing at once
    if (isProcessingSwipe) {
      console.log("Ignoring swipe - already processing another swipe");
      return;
    }
    
    try {
      setIsProcessingSwipe(true);
      
      // Capture current index in a local variable to ensure we use the correct value
      const indexToUpdate = currentIndex;
      // Use namesRef.current to get the most up-to-date names array
      const currentNameObj = namesRef.current[indexToUpdate];
      
      console.log(`swipeLeft called for index ${indexToUpdate}, names length: ${namesRef.current.length}`);
      
      if (!currentNameObj) {
        console.error(`No name found at index ${indexToUpdate}`);
        setIsProcessingSwipe(false);
        return;
      }
      
      // Make a local copy of the name to ensure it doesn't change during async operations
      const nameToSave = {...currentNameObj};
      
      console.log(`Processing swipe left for name: ${nameToSave.firstName}`);
      
      // Define the success flag to track if save completed
      let saveSuccessful = false;
      
      try {
        // Save to disliked list with status 'disliked' and await the completion
        console.log(`Initiating save for "${nameToSave.firstName}" to disliked list`);
        await saveNameStatus(nameToSave, 'disliked');
        console.log(`Successfully saved "${nameToSave.firstName}" to disliked list`);
        
        // Update session state after successful save
        await updateSessionAfterSwipe(indexToUpdate);
        
        // Mark save as successful
        saveSuccessful = true;
      } catch (error) {
        console.error(`Failed to save "${nameToSave.firstName}" to disliked list:`, error);
        // Continue with animation even if save fails - UX should not be interrupted
      }
  
      // Check if we've reached the end of cards before starting animation
      checkEndOfCards(indexToUpdate);
  
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
        
        // Only increment the index if save was successful
        if (saveSuccessful) {
          // Use a slight delay before updating the index to avoid animation jank
          setTimeout(() => {
            // Important: Use the state updater form to ensure we're working with the latest state
            setCurrentIndex(prevIndex => {
              console.log("Updating index from", prevIndex, "to", prevIndex + 1);
              return prevIndex + 1;
            });
            
            // Reset the processing flag
            setIsProcessingSwipe(false);
            console.log("Card position reset, ready for next card");
            
            // Check if we've reached the end of cards
            checkEndOfCards(indexToUpdate);
          }, 50); // Small delay to ensure smooth transition
        } else {
          // Reset the processing flag even if save failed
          setIsProcessingSwipe(false);
          console.log("Card position reset, but index not incremented due to save failure");
        }
      });
    } catch (error) {
      console.error("Error in swipe left:", error);
      setIsProcessingSwipe(false);
    }
  };
  
  const swipeUp = async () => {
    // Prevent multiple swipes from processing at once
    if (isProcessingSwipe) {
      console.log("Ignoring swipe - already processing another swipe");
      return;
    }
    
    try {
      setIsProcessingSwipe(true);
      
      // Capture current index in a local variable to ensure we use the correct value
      const indexToUpdate = currentIndex;
      // Use namesRef.current to get the most up-to-date names array
      const currentNameObj = namesRef.current[indexToUpdate];
      
      console.log(`swipeUp called for index ${indexToUpdate}, names length: ${namesRef.current.length}`);
      
      if (!currentNameObj) {
        console.error(`No name found at index ${indexToUpdate}`);
        setIsProcessingSwipe(false);
        return;
      }
      
      // Make a local copy of the name to ensure it doesn't change during async operations
      const nameToSave = {...currentNameObj};
      
      console.log(`Processing swipe up for name: ${nameToSave.firstName}`);
      
      // Define the success flag to track if save completed
      let saveSuccessful = false;
      
      try {
        // Save to maybe list with status 'maybe' and await the completion
        console.log(`Initiating save for "${nameToSave.firstName}" to maybe list`);
        await saveNameStatus(nameToSave, 'maybe');
        console.log(`Successfully saved "${nameToSave.firstName}" to maybe list`);
        
        // Update session state after successful save
        await updateSessionAfterSwipe(indexToUpdate);
        
        // Mark save as successful
        saveSuccessful = true;
      } catch (error) {
        console.error(`Failed to save "${nameToSave.firstName}" to maybe list:`, error);
        // Continue with animation even if save fails - UX should not be interrupted
      }
  
      // Check if we've reached the end of cards before starting animation
      checkEndOfCards(indexToUpdate);
  
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
        
        // Only increment the index if save was successful
        if (saveSuccessful) {
          // Use a slight delay before updating the index to avoid animation jank
          setTimeout(() => {
            // Important: Use the state updater form to ensure we're working with the latest state
            setCurrentIndex(prevIndex => {
              console.log("Updating index from", prevIndex, "to", prevIndex + 1);
              return prevIndex + 1;
            });
            
            // Reset the processing flag
            setIsProcessingSwipe(false);
            console.log("Card position reset, ready for next card");
            
            // Check if we've reached the end of cards
            checkEndOfCards(indexToUpdate);
          }, 50); // Small delay to ensure smooth transition
        } else {
          // Reset the processing flag even if save failed
          setIsProcessingSwipe(false);
          console.log("Card position reset, but index not incremented due to save failure");
        }
      });
    } catch (error) {
      console.error("Error in swipe up:", error);
      setIsProcessingSwipe(false);
    }
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
    
    // Check if already processing a swipe
    if (isProcessingSwipe) {
      console.log("Like button ignored - already processing a swipe");
      return;
    }
    
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
    
    // Check if already processing a swipe
    if (isProcessingSwipe) {
      console.log("Maybe button ignored - already processing a swipe");
      return;
    }
    
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
    
    // Check if already processing a swipe
    if (isProcessingSwipe) {
      console.log("Dislike button ignored - already processing a swipe");
      return;
    }
    
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
  
  const refreshNames = useCallback(async () => {
    console.log("=== Starting Name Refresh ===");
    console.log("Current search parameters:", { lastName, gender, searchQuery });
    console.log("Previously seen names:", {
      liked: likedNames.map(n => n.firstName),
      maybe: maybeNames.map(n => n.firstName),
      disliked: dislikedNames.map(n => n.firstName)
    });
    
    // Reset current state
    setNames([]);
    setCurrentIndex(0);
    setPendingNames([]);
    setIsLoadingNames(true);
    setError(null);
    
    // Clear existing session data to force a fresh generation
    try {
      await AsyncStorage.multiRemove([CURRENT_NAMES_KEY, CURRENT_INDEX_KEY]);
      console.log("Cleared previous names data for refresh");
    } catch (error) {
      console.error("Error clearing session data:", error);
    }
    
    // Generate new names
    try {
      // Use AI to generate new names
      console.log("Generating new AI names with parameters:", {
        lastName,
        gender,
        searchQuery,
        count: 20,
        excludeNames: [...likedNames, ...maybeNames, ...dislikedNames].map(name => name.firstName)
      });

      const aiNames = await fetchAINames({
        lastName,
        gender,
        searchQuery,
        count: 20,
        excludeNames: [...likedNames, ...maybeNames, ...dislikedNames].map(name => name.firstName)
      });
      
      console.log(`Generated ${aiNames.length} new names`);
      console.log("New names:", aiNames.map(n => n.firstName));
      
      if (aiNames.length === 0) {
        console.error("Generated names array is empty");
        setError("No new names were generated. Try adjusting your search criteria or try a new search.");
        setIsLoadingNames(false);
        return;
      }
      
      // Set initial batch of names (first 5)
      const initialBatch = aiNames.slice(0, 5);
      setNames(initialBatch);
      namesRef.current = initialBatch;
      console.log(`Set initial batch of ${initialBatch.length} names:`, initialBatch.map(n => n.firstName));
      
      // Store remaining names as pending
      const remainingNames = aiNames.slice(5);
      setPendingNames(remainingNames);
      console.log(`Stored ${remainingNames.length} pending names:`, remainingNames.map(n => n.firstName));
      
      // Save the new session
      const searchParams = { lastName, gender, searchQuery };
      await AsyncStorage.setItem(CURRENT_SEARCH_KEY, JSON.stringify(searchParams));
      await AsyncStorage.setItem(CURRENT_NAMES_KEY, JSON.stringify(aiNames));
      await AsyncStorage.setItem(CURRENT_INDEX_KEY, "0");
      console.log("Saved refreshed session data with search params:", searchParams);
      
    } catch (error) {
      console.error("Error refreshing names:", error);
      setError(`Error generating names. Please check your connection and try again.`);
    } finally {
      setIsLoadingNames(false);
      console.log("=== Name Refresh Complete ===");
    }
  }, [lastName, gender, searchQuery, fetchAINames, likedNames, maybeNames, dislikedNames]);
  
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
      <TouchableOpacity style={styles.actionButton} onPress={refreshNames}>
        <Text style={styles.actionButtonText}>Generate More Names</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Add a placeholder component for users who haven't initiated a search
  const renderNoSearchPlaceholder = () => (
    <View style={styles.noMoreCardsContainer}>
      <Ionicons name="search" size={60} color="#FF5BA1" style={styles.placeholderIcon} />
      <Text style={styles.noMoreCardsText}>Search to start swiping!</Text>
      <TouchableOpacity style={styles.actionButton} onPress={goToNewSearch}>
        <Text style={styles.actionButtonText}>Search for Names</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Update renderCards to include the placeholder state
  const renderCards = () => {
    // If user hasn't initiated a search, show placeholder
    if (!hasInitiatedSearch) {
      return renderNoSearchPlaceholder();
    }
    
    // Show a loading indicator when names are loading
    if (isLoadingNames) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF5BA1" />
          <Text style={styles.loadingText}>
            Generating creative names with AI...
          </Text>
          <Text style={styles.aiSubtext}>
            This may take a few moments
          </Text>
        </View>
      );
    }
    
    // Show error message if there is one
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#FF5BA1" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.actionButton} onPress={refreshNames}>
            <Text style={styles.actionButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Handle empty names array
    if (names.length === 0) {
      return (
        <View style={styles.noMoreCardsContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#FF5BA1" />
          <Text style={styles.noMoreCardsText}>No names were found</Text>
          <Text style={styles.placeholderSubtext}>
            Try adjusting your search criteria to find beautiful baby names
          </Text>
          <TouchableOpacity style={styles.actionButton} onPress={goToNewSearch}>
            <Text style={styles.actionButtonText}>Try a New Search</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Show "No more names" when we've gone through all names
    if (currentIndex >= names.length) {
      return renderNoMoreCards();
    }
    
    // Render only the current card and the next card
    const currentCard = names[currentIndex];
    const nextCard = names[currentIndex + 1];
    
    return (
      <View style={styles.cardsContainer}>
        {nextCard && (
          <View style={[styles.card, styles.nextCard]}>
            <LinearGradient
              colors={getGradientColors(nextCard.gender)}
              style={styles.cardGradient}
              start={{ x: 0, y: 0.7 }}
              end={{ x: 0, y: 1 }}
            >
              <Text style={styles.firstNameText}>{nextCard.firstName}</Text>
              {nextCard.lastName && <Text style={styles.lastNameText}>{nextCard.lastName}</Text>}
              <Text style={styles.meaningText}>{nextCard.meaning}</Text>
            </LinearGradient>
          </View>
        )}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate: position.x.interpolate({
                  inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
                  outputRange: ['-30deg', '0deg', '30deg'],
                })}
              ],
              zIndex: 2,
            }
          ]}
          {...panResponder.panHandlers}
        >
          <LinearGradient
            colors={getGradientColors(currentCard.gender)}
            style={styles.cardGradient}
            start={{ x: 0, y: 0.7 }}
            end={{ x: 0, y: 1 }}
          >
            <Text style={styles.firstNameText}>{currentCard.firstName}</Text>
            {currentCard.lastName && <Text style={styles.lastNameText}>{currentCard.lastName}</Text>}
            <Text style={styles.meaningText}>{currentCard.meaning}</Text>
          </LinearGradient>
        </Animated.View>
        {isGeneratingNextBatch && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color="#FF5BA1" />
          </View>
        )}
      </View>
    );
  };
  
  // Helper function to get gradient colors based on gender
  const getGradientColors = (gender: 'boy' | 'girl' | 'unisex' | 'any'): [string, string] => {
    if (gender === 'boy') {
      return Colors.gender.boy.gradient as [string, string];
    } else if (gender === 'girl') {
      return Colors.gender.girl.gradient as [string, string];
    } else {
      return Colors.gender.neutral.gradient as [string, string];
    }
  };
  
  // Add debugging log for names array
  useEffect(() => {
    console.log(`Loaded ${names.length} names, current index: ${currentIndex}`);
  }, [names, currentIndex]);
  
  // Add a useEffect to monitor liked, maybe, and disliked names and ensure session is synced
  useEffect(() => {
    // This effect runs whenever the name lists change
    if (hasInitiatedSearch && names.length > 0) {
      console.log(`Name lists changed: ${likedNames.length} liked, ${maybeNames.length} maybe, ${dislikedNames.length} disliked`);
      
      // Save the current session state to ensure it persists
      const saveCurrentSessionState = async () => {
        try {
          if (currentIndex < names.length) {
            const searchParams = { lastName, gender, searchQuery };
            await AsyncStorage.setItem(CURRENT_SEARCH_KEY, JSON.stringify(searchParams));
            await AsyncStorage.setItem(CURRENT_NAMES_KEY, JSON.stringify(names));
            await AsyncStorage.setItem(CURRENT_INDEX_KEY, currentIndex.toString());
            console.log(`Session saved after name list change: ${names.length} names, index ${currentIndex}`);
          }
        } catch (error) {
          console.error("Error saving session after name list change:", error);
        }
      };
      
      saveCurrentSessionState();
    }
  }, [likedNames, maybeNames, dislikedNames, hasInitiatedSearch, names, currentIndex, lastName, gender, searchQuery]);
  
  // Add a cleanup handler to save session on unmount
  useEffect(() => {
    // Save the current session when component unmounts
    return () => {
      if (hasInitiatedSearch && names.length > 0 && currentIndex < names.length) {
        console.log("Component unmounting, saving session state");
        
        // Use a synchronous version for cleanup
        const saveSession = async () => {
          try {
            const searchParams = { lastName, gender, searchQuery };
            await AsyncStorage.setItem(CURRENT_SEARCH_KEY, JSON.stringify(searchParams));
            await AsyncStorage.setItem(CURRENT_NAMES_KEY, JSON.stringify(names));
            await AsyncStorage.setItem(CURRENT_INDEX_KEY, currentIndex.toString());
            console.log(`Saved session on unmount: ${names.length} names, index ${currentIndex}`);
          } catch (error) {
            console.error("Error saving session on unmount:", error);
          }
        };
        
        // Execute but don't wait for promise to complete - this is a best effort save
        saveSession();
      }
    };
  }, [hasInitiatedSearch, names, currentIndex, lastName, gender, searchQuery]);
  
  // Add modal render function
  const renderCompletionModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showCompletionModal}
      onRequestClose={() => setShowCompletionModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setShowCompletionModal(false)}
          >
            <Ionicons name="close" size={24} color="#999" />
          </TouchableOpacity>
          
          <Ionicons name="checkmark-circle" size={60} color="#FF5BA1" style={styles.modalIcon} />
          <Text style={styles.modalTitle}>You've seen all names!</Text>
          <Text style={styles.modalText}>What would you like to do next?</Text>
          
          <TouchableOpacity 
            style={[styles.modalButton, { backgroundColor: '#FF5BA1' }]} 
            onPress={() => {
              setShowCompletionModal(false);
              refreshNames();
            }}
          >
            <Text style={styles.modalButtonText}>Refresh with Same Search</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.modalButton, { backgroundColor: '#3CA3FF', marginTop: 10 }]} 
            onPress={() => {
              setShowCompletionModal(false);
              goToNewSearch();
            }}
          >
            <Text style={styles.modalButtonText}>Try a New Search</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.modalButton, { backgroundColor: '#B799FF', marginTop: 10 }]} 
            onPress={() => {
              setShowCompletionModal(false);
              goToMatches();
            }}
          >
            <Text style={styles.modalButtonText}>View My Matches</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
  
  // Update getProgressText to show out of 20
  const getProgressText = useCallback(() => {
    if (!names.length) return '';
    return `${currentIndex + 1}/20`;
  }, [currentIndex]);
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {renderCompletionModal()}
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
            
            <View style={styles.headerCenterContent}>
              <TouchableOpacity 
                style={styles.refreshButton} 
                onPress={refreshNames}
                activeOpacity={0.6}
              >
                <Ionicons name="sync" size={24} color="black" />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
              
              {hasInitiatedSearch && names.length > 0 && currentIndex < names.length && (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressText}>{getProgressText()}</Text>
                </View>
              )}
            </View>
            
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
  headerCenterContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  refreshButtonText: {
    color: 'black',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  progressContainer: {
    marginTop: 6,
  },
  progressText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
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
    fontWeight: '600',
    color: '#FF9B85',
    textAlign: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#FF5BA1',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  placeholderIcon: {
    marginBottom: 24,
    opacity: 0.7,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 24,
    lineHeight: 22,
  },
  findNamesButton: {
    backgroundColor: '#FF5BA1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 10,
  },
  findNamesButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
    zIndex: 1,
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButton: {
    backgroundColor: '#FF5BA1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 10,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingIndicator: {
    position: 'absolute',
    bottom: -30,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 