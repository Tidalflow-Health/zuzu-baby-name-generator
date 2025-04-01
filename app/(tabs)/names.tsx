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
import BottomTabBar from '../../src/components/BottomTabBar';
import Colors from 'constants/Colors';
import { useNameStatus } from 'hooks/useNameStatus';
import { useAINames } from 'hooks/useAINames';
import { FEATURES } from 'utils/appConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get screen dimensions
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
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
  const currentIndexRef = useRef(0); // Ref for synchronous index access
  const topCardOpacity = useRef(new Animated.Value(1)).current; // Opacity for the top card
  
  // Animation values for button feedback
  const likeButtonScale = useRef(new Animated.Value(1)).current;
  const maybeButtonScale = useRef(new Animated.Value(1)).current;
  
  // State for card overlay feedback
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [overlayType, setOverlayType] = useState<'like' | 'dislike' | 'maybe' | null>(null);
  
  // Create a ref to store the names array so it's accessible in the panResponder
  const namesRef = useRef<NameType[]>([]);
  
  // Add a flag to prevent multiple swipes from processing simultaneously
  const [isProcessingSwipe, setIsProcessingSwipe] = useState(false);
  // Add a debounce timer reference
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Helper function to debounce actions
  const debounce = (func: Function, delay: number) => {
    // Clear previous timer if it exists
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      func();
      debounceTimerRef.current = null;
    }, delay);
  };

  // Store names in the ref whenever it changes
  useEffect(() => {
    namesRef.current = names;
    // DEBUG: console.log("Names ref updated with", names.length, "names");
  }, [names]);
  
  // Sync state index with ref index whenever state changes
  useEffect(() => {
    currentIndexRef.current = currentIndex;
    // DEBUG: console.log(`currentIndexRef updated to: ${currentIndexRef.current}`);
    // Reset opacity for the new top card
    topCardOpacity.setValue(1); 
    // DEBUG: console.log(`topCardOpacity reset to 1 for new index ${currentIndex}`);
  }, [currentIndex]);
  
  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
  
  // Load or generate the initial set of names
  useEffect(() => {
    if (!hasInitiatedSearch) {
      setHasInitiatedSearch(true);
      
      // When users access this screen directly (not from search)
      // try to restore the previous session if it exists
      const restoreSession = async () => {
        try {
          const storedSearch = await AsyncStorage.getItem(CURRENT_SEARCH_KEY);
          const storedNames = await AsyncStorage.getItem(CURRENT_NAMES_KEY);
          const storedIndex = await AsyncStorage.getItem(CURRENT_INDEX_KEY);
          
          if (storedSearch && storedNames && storedIndex) {
            const searchParams = JSON.parse(storedSearch);
            const namesList = JSON.parse(storedNames);
            const nameIndex = parseInt(storedIndex, 10);
            
            if (
              // If there are route params, they take precedence
              !newSearch && 
              namesList.length > 0 && 
              // Only restore session if the search params match or there are no search params
              (!params.gender || searchParams.gender === params.gender) &&
              (!params.lastName || searchParams.lastName === params.lastName) &&
              (!params.searchQuery || searchParams.searchQuery === params.searchQuery)
            ) {
              // Check if we've already gone through all names
              if (nameIndex >= namesList.length) {
                console.log("Session restored, all names were already swiped. Setting state to show completion.");
                // Keep the names list, but set the index to the end to trigger the correct view
                setNames(namesList); 
                namesRef.current = namesList;
                setCurrentIndex(nameIndex); // Set index to length (e.g., 20)
                setIsLoadingNames(false);
                return true; // Indicate session was restored in completed state
              }
              
              // If not completed, restore normally
              setNames(namesList);
              namesRef.current = namesList;
              setCurrentIndex(nameIndex);
              setIsLoadingNames(false);
              return true; // Indicate session was restored
            }
          }
          return false; // Session not restored
        } catch (error) {
          console.error('Error restoring session:', error);
          return false;
        }
      };
      
      // Try to restore the session first
      restoreSession().then(restored => {
        // If session couldn't be restored, generate new names
        if (!restored) {
          generateInitialNames();
        }
      });
    }
  }, [hasInitiatedSearch, newSearch, params.gender, params.lastName, params.searchQuery]);
  
  // Function to generate initial names - separated to improve readability
  const generateInitialNames = async () => {
    console.log(`[${getTimestamp()}] 🚀 GENERATE_INITIAL V2: Starting initial fetch.`);
    setIsLoadingNames(true);
    setError(null);
    setCurrentIndex(0); // Ensure index is reset for a new search
    setNames([]); // Clear previous names immediately
    namesRef.current = [];
    
    try {
      // Get names already interacted with to exclude them
      const excludeRecords = [...likedNames, ...maybeNames, ...dislikedNames];
      const excludeIds = new Set(excludeRecords.map(n => n.firstName.toLowerCase()));
      // --- CHANGE: Request 20 names for the initial batch --- 
      const requestedCount = 20;
      
      console.log(`[${getTimestamp()}] 🤖 GENERATE_INITIAL V2: Calling fetchAINames. Requesting: ${requestedCount}, Initial Exclusions: ${excludeIds.size}`);
      const aiNames = await fetchAINames({
        lastName,
        gender,
        searchQuery,
        count: requestedCount, 
        excludeNames: [], // Let backend handle exclusions if needed, but primarily rely on client-side filtering for now
      });
      console.log(`[${getTimestamp()}] 🤖 GENERATE_INITIAL V2: fetchAINames returned ${aiNames?.length ?? 0} raw names.`);
      
      if (!aiNames || aiNames.length === 0) {
        console.error("GENERERATE_INITIAL V2: fetchAINames returned no names.");
        setError("No names were generated. Please try again or change your search criteria.");
        setIsLoadingNames(false);
        return;
      }
      
      // --- Client-Side Filtering for uniqueness and against interacted names ---
      const uniqueFilteredNames: NameType[] = [];
      const seenIds = new Set<string>(); 
      
      for (const name of aiNames) {
        const nameId = name.firstName.toLowerCase();
        if (!seenIds.has(nameId) && !excludeIds.has(nameId)) {
          uniqueFilteredNames.push(name);
          seenIds.add(nameId);
        }
      }
      console.log(`[${getTimestamp()}] ✨ GENERATE_INITIAL V2: Filtered down to ${uniqueFilteredNames.length} unique, non-excluded names.`);
      
      if (uniqueFilteredNames.length === 0) {
        console.error("GENERERATE_INITIAL V2: No unique, non-excluded names found after filtering.");
        setError("No new names found matching your criteria. Try adjusting your search.");
        setIsLoadingNames(false);
        return;
      }
      // ---------------------------
      
      // --- CHANGE: Set all fetched (and filtered) names directly, remove pending logic ---
      setNames(uniqueFilteredNames); 
      namesRef.current = uniqueFilteredNames;
      // setPendingNames([]); // Remove pending names state usage
      
      // Save the session after generation
      try {
        const searchParams = { lastName, gender, searchQuery };
        await AsyncStorage.setItem(CURRENT_SEARCH_KEY, JSON.stringify(searchParams));
        await AsyncStorage.setItem(CURRENT_NAMES_KEY, JSON.stringify(uniqueFilteredNames)); // Save the list shown
        await AsyncStorage.setItem(CURRENT_INDEX_KEY, "0");
        console.log(`[${getTimestamp()}] 💾 GENERATE_INITIAL V2: Saved session with ${uniqueFilteredNames.length} names.`);
      } catch (saveError) {
        console.error("Error saving session after generating names:", saveError);
      }
      
    } catch (error) {
      console.error("Error generating names V2:", error);
      setError(`Error generating names. Please check your connection and try again.`);
    } finally {
      setIsLoadingNames(false);
    }
  };

  // Update panResponder for better swipe detection and handling with async functions
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Skip gesture detection if already processing a swipe
        if (isProcessingSwipe) {
          // DEBUG: console.log("Ignoring gesture - already processing a swipe");
          return false;
        }
        
        // Use namesRef.current and currentIndexRef.current for latest values
        const currentNames = namesRef.current;
        const currentIdx = currentIndexRef.current; 
        
        // Check if we have a valid name at the current index
        const hasValidName = currentNames[currentIdx] !== undefined;
        // DEBUG: console.log(`Gesture check - current name: ${hasValidName ? currentNames[currentIdx].firstName : 'none'}, index: ${currentIdx}, names length: ${currentNames.length}`);
        
        if (!hasValidName) {
          // DEBUG: console.log("Ignoring gesture - no valid name at current index");
          return false;
        }
        
        // DEBUG: console.log(`Gesture allowed for: ${currentNames[currentIdx].firstName}`);
        return true;
      },
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
        
        // Determine overlay type based on swipe direction/distance
        const horizontalThreshold = SWIPE_THRESHOLD * 0.5; // Lower threshold for showing overlay
        const verticalThreshold = SWIPE_THRESHOLD * 0.4;
        
        if (gesture.dy < -verticalThreshold && Math.abs(gesture.dy) > Math.abs(gesture.dx)) {
          setOverlayType('maybe');
        } else if (gesture.dx > horizontalThreshold && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
          setOverlayType('like');
        } else if (gesture.dx < -horizontalThreshold && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
          setOverlayType('dislike');
        } else {
          setOverlayType(null); // Clear if not strongly in one direction
        }
        
        // Visual feedback during swiping (rotation)
        position.flattenOffset();
      },
      onPanResponderRelease: (_, gesture) => {
        // DEBUG: console.log("Gesture released:", gesture.dx, gesture.dy);
        
        // Skip if already processing a swipe
        if (isProcessingSwipe) {
          // DEBUG: console.log("Ignoring gesture release - already processing a swipe");
          resetPosition();
          return;
        }
        
        // Use refs for latest values
        const currentNames = namesRef.current;
        const currentIdx = currentIndexRef.current; 
        
        // Double-check we have a valid name before processing
        if (!currentNames[currentIdx]) {
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
            // DEBUG: console.log(`Swiping right detected for: ${currentNames[currentIdx].firstName}`);
            swipeRight().catch(error => {
              console.error("Error in swipe right gesture:", error);
              resetPosition(); // Reset position if saving fails
            });
          } else if (gesture.dx < -horizontalThreshold) {
            // DEBUG: console.log(`Swiping left detected for: ${currentNames[currentIdx].firstName}`);
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
            // DEBUG: console.log(`Swiping up detected for: ${currentNames[currentIdx].firstName}`);
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
    // Use spring for more natural bounce-back
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 6, 
      tension: 40, 
      useNativeDriver: true,
    }).start(() => setOverlayType(null)); // Clear overlay type when reset completes
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
  
  // Helper function to get a formatted timestamp for logs
  const getTimestamp = () => {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  };

  // Common function to update session state after each swipe
  const updateSessionAfterSwipe = async (newIndex: number, swipeType: string) => {
    const timestamp = getTimestamp();
    console.log(`[${timestamp}] 💾 SWIPE: Saving session index ${newIndex} after ${swipeType}`);
    
    try {
      // Only save if we actually have names loaded to avoid saving index for empty state
      if (namesRef.current.length > 0) { 
        await AsyncStorage.setItem(CURRENT_INDEX_KEY, newIndex.toString());
      } else {
        console.log(`[${timestamp}] ⚠️ SWIPE: Skipped saving index ${newIndex} as names list is empty.`);
      }
    } catch (error) {
      console.error(`[${timestamp}] ❌ SWIPE: Error saving session index ${newIndex} after ${swipeType}:`, error);
    }
  };

  // Improved swipe right function with retries
  const swipeRight = async () => {
    const timestamp = getTimestamp();
    const currentIdx = currentIndexRef.current; // Use ref
    if (isProcessingSwipe || currentIdx >= namesRef.current.length) {
      console.log(`[${timestamp}] ⚠️ SWIPE: Swipe Right ignored (processing=${isProcessingSwipe}, index=${currentIdx}, length=${namesRef.current.length})`);
      return;
    }
    
    const currentName = namesRef.current[currentIdx]; // Use ref
    console.log(`[${timestamp}] 👉 SWIPE: Right (Like) started for "${currentName.firstName}"`);
    setIsProcessingSwipe(true);
    // setOverlayType('like'); // Type is now set in PanResponderMove
    
    // Animate card position only
    Animated.timing(position, {
      toValue: { x: SCREEN_WIDTH * 1.5, y: 0 },
      duration: 300,
      useNativeDriver: true,
    }).start(async () => { // Callback runs AFTER card moves
      // Reset position and make old card invisible immediately
      position.setValue({ x: 0, y: 0 });
      topCardOpacity.setValue(0);
      setOverlayType(null); // Clear overlay type after swipe completes
      
      const saveStartTime = Date.now();
      try {
        await saveNameStatus(currentName, 'liked');
        const duration = Date.now() - saveStartTime;
        console.log(`[${timestamp}] ✅ SWIPE: Right (Like) saved "${currentName.firstName}" in ${duration}ms`);
        
        const prevIndex = currentIdx; // Use ref value
        const newIndex = prevIndex + 1; // Calculate new index
        setCurrentIndex(newIndex);       // Update state
        currentIndexRef.current = newIndex; // Sync ref
        // Save the NEW index immediately
        updateSessionAfterSwipe(newIndex, 'like').catch(e => console.error(`[${timestamp}] ❌ SWIPE: Session update failed after like:`, e)); 
        console.log(`[${timestamp}] 👉 SWIPE: Right (Like) completed for "${currentName.firstName}", moved to index ${newIndex}`);
        
        // Set processing to false AFTER state updates are queued
        // DEBUG: console.log(`[${timestamp}] 👉 Setting isProcessingSwipe = false (Like Success)`);
        setIsProcessingSwipe(false);

      } catch (error) {
        const duration = Date.now() - saveStartTime;
        console.error(`[${timestamp}] ❌ SWIPE: Right (Like) failed for "${currentName.firstName}" after ${duration}ms:`, error);
        resetPosition(); // Reset position visually on error
        topCardOpacity.setValue(1); // Make card visible again if swipe fails
        // overlayOpacity.setValue(0); // Opacity is handled by interpolation
        setOverlayType(null); // Clear type on error
        // DEBUG: console.log(`[${timestamp}] 👉 Setting isProcessingSwipe = false (Like Error)`);
        setIsProcessingSwipe(false);
        setError("Failed to save your choice. Please try again.");
      }
    });
  };
  
  // Add the swipeLeft function for disliking a name
  const swipeLeft = async () => {
    const timestamp = getTimestamp();
    const currentIdx = currentIndexRef.current; // Use ref
    if (isProcessingSwipe || currentIdx >= namesRef.current.length) {
      console.log(`[${timestamp}] ⚠️ SWIPE: Swipe Left ignored (processing=${isProcessingSwipe}, index=${currentIdx}, length=${namesRef.current.length})`);
      return;
    }
    
    const currentName = namesRef.current[currentIdx]; // Use ref
    console.log(`[${timestamp}] 👈 SWIPE: Left (Dislike) started for "${currentName.firstName}"`);
    setIsProcessingSwipe(true);
    // setOverlayType('dislike'); // Type is now set in PanResponderMove
    
    // Animate card position only
    Animated.timing(position, {
      toValue: { x: -SCREEN_WIDTH * 1.5, y: 0 },
      duration: 300,
      useNativeDriver: true,
    }).start(async () => { // Callback runs AFTER card moves
      // Reset position and make old card invisible immediately
      position.setValue({ x: 0, y: 0 });
      topCardOpacity.setValue(0);
      setOverlayType(null); // Clear overlay type after swipe completes

      const saveStartTime = Date.now();
      try {
        await saveNameStatus(currentName, 'disliked');
        const duration = Date.now() - saveStartTime;
        console.log(`[${timestamp}] ✅ SWIPE: Left (Dislike) saved "${currentName.firstName}" in ${duration}ms`);
        
        const prevIndex = currentIdx; // Use ref value
        const newIndex = prevIndex + 1; // Calculate new index
        setCurrentIndex(newIndex);       // Update state
        currentIndexRef.current = newIndex; // Sync ref
        // Save the NEW index immediately
        updateSessionAfterSwipe(newIndex, 'dislike').catch(e => console.error(`[${timestamp}] ❌ SWIPE: Session update failed after dislike:`, e));
        console.log(`[${timestamp}] 👈 SWIPE: Left (Dislike) completed for "${currentName.firstName}", moved to index ${newIndex}`);

        // Set processing to false AFTER state updates are queued
        // DEBUG: console.log(`[${timestamp}] 👉 Setting isProcessingSwipe = false (Dislike Success)`);
        setIsProcessingSwipe(false);

      } catch (error) {
        const duration = Date.now() - saveStartTime;
        console.error(`[${timestamp}] ❌ SWIPE: Left (Dislike) failed for "${currentName.firstName}" after ${duration}ms:`, error);
        resetPosition(); // Reset position visually on error
        topCardOpacity.setValue(1); // Make card visible again if swipe fails
        // overlayOpacity.setValue(0); // Opacity is handled by interpolation
        setOverlayType(null); // Clear type on error
        // DEBUG: console.log(`[${timestamp}] 👉 Setting isProcessingSwipe = false (Dislike Error)`);
        setIsProcessingSwipe(false);
        setError("Failed to save your choice. Please try again.");
      }
    });
  };
  
  // Add the swipeUp function for maybe status
  const swipeUp = async () => {
    const timestamp = getTimestamp();
    const currentIdx = currentIndexRef.current; // Use ref
    if (isProcessingSwipe || currentIdx >= namesRef.current.length) {
      console.log(`[${timestamp}] ⚠️ SWIPE: Swipe Up ignored (processing=${isProcessingSwipe}, index=${currentIdx}, length=${namesRef.current.length})`);
      return;
    }
    
    const currentName = namesRef.current[currentIdx]; // Use ref
    console.log(`[${timestamp}] 👆 SWIPE: Up (Maybe) started for "${currentName.firstName}"`);
    setIsProcessingSwipe(true);
    // setOverlayType('maybe'); // Type is now set in PanResponderMove
    
    // Animate card position only
    Animated.timing(position, {
      toValue: { x: 0, y: -SCREEN_WIDTH * 1.5 }, // Use SCREEN_WIDTH for distance consistency
      duration: 300,
      useNativeDriver: true,
    }).start(async () => { // Callback runs AFTER card moves
      // Reset position and make old card invisible immediately
      position.setValue({ x: 0, y: 0 });
      topCardOpacity.setValue(0);
      setOverlayType(null); // Clear overlay type after swipe completes

      const saveStartTime = Date.now();
      try {
        await saveNameStatus(currentName, 'maybe');
        const duration = Date.now() - saveStartTime;
        console.log(`[${timestamp}] ✅ SWIPE: Up (Maybe) saved "${currentName.firstName}" in ${duration}ms`);
        
        const prevIndex = currentIdx; // Use ref value
        const newIndex = prevIndex + 1; // Calculate new index
        setCurrentIndex(newIndex);       // Update state
        currentIndexRef.current = newIndex; // Sync ref
        // Save the NEW index immediately
        updateSessionAfterSwipe(newIndex, 'maybe').catch(e => console.error(`[${timestamp}] ❌ SWIPE: Session update failed after maybe:`, e));
        console.log(`[${timestamp}] 👆 SWIPE: Up (Maybe) completed for "${currentName.firstName}", moved to index ${newIndex}`);

        // Set processing to false AFTER state updates are queued
        // DEBUG: console.log(`[${timestamp}] 👉 Setting isProcessingSwipe = false (Maybe Success)`);
        setIsProcessingSwipe(false);

      } catch (error) {
        const duration = Date.now() - saveStartTime;
        console.error(`[${timestamp}] ❌ SWIPE: Up (Maybe) failed for "${currentName.firstName}" after ${duration}ms:`, error);
        resetPosition(); // Reset position visually on error
        topCardOpacity.setValue(1); // Make card visible again if swipe fails
        // overlayOpacity.setValue(0); // Opacity is handled by interpolation
        setOverlayType(null); // Clear type on error
        // DEBUG: console.log(`[${timestamp}] 👉 Setting isProcessingSwipe = false (Maybe Error)`);
        setIsProcessingSwipe(false);
        setError("Failed to save your choice. Please try again.");
      }
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
  
  // Update button press handlers with better logging
  const handleLike = () => {
    const timestamp = getTimestamp();
    const currentIdx = currentIndexRef.current; // Use ref
    if (isProcessingSwipe || !namesRef.current[currentIdx]) {
      console.log(`[${timestamp}] ⚠️ SWIPE: Like button ignored (processing=${isProcessingSwipe}, index=${currentIdx}, nameExists=${!!namesRef.current[currentIdx]})`);
      return;
    }
    console.log(`[${timestamp}] 👍 SWIPE: Like button pressed for "${namesRef.current[currentIdx].firstName}"`);
    animateButton(likeButtonScale);
    swipeRight().catch(error => {
      console.error(`[${timestamp}] ❌ SWIPE: Error during Like button action:`, error);
    });
  };
  
  const handleMaybe = () => {
    const timestamp = getTimestamp();
    const currentIdx = currentIndexRef.current; // Use ref
    if (isProcessingSwipe || !namesRef.current[currentIdx]) {
      console.log(`[${timestamp}] ⚠️ SWIPE: Maybe button ignored (processing=${isProcessingSwipe}, index=${currentIdx}, nameExists=${!!namesRef.current[currentIdx]})`);
      return;
    }
    console.log(`[${timestamp}] 🤔 SWIPE: Maybe button pressed for "${namesRef.current[currentIdx].firstName}"`);
    animateButton(maybeButtonScale);
    swipeUp().catch(error => {
      console.error(`[${timestamp}] ❌ SWIPE: Error during Maybe button action:`, error);
    });
  };

  const handleDislike = () => {
    const timestamp = getTimestamp();
    const currentIdx = currentIndexRef.current; // Use ref
    if (isProcessingSwipe || !namesRef.current[currentIdx]) {
      console.log(`[${timestamp}] ⚠️ SWIPE: Dislike button ignored (processing=${isProcessingSwipe}, index=${currentIdx}, nameExists=${!!namesRef.current[currentIdx]})`);
      return;
    }
    console.log(`[${timestamp}] 👎 SWIPE: Dislike button pressed for "${namesRef.current[currentIdx].firstName}"`);
    swipeLeft().catch(error => {
      console.error(`[${timestamp}] ❌ SWIPE: Error during Dislike button action:`, error);
    });
  };
  
  const goToMatches = () => {
    // No need to pass data via params anymore - navigate to the likes screen directly
    router.push('/likes');
  };
  
  // Updated refreshNames function to fetch the NEXT batch, excluding previously seen names
  const refreshNames = useCallback(async () => {
    const timestamp = getTimestamp();
    console.log(`[${timestamp}] 🔄 REFRESH V2: Starting refresh names process (fetching next batch).`);
    setIsLoadingNames(true); // Show loading indicator
    setError(null);
    
    // Use namesRef to get the most current list of names already displayed/fetched
    const currentNameList = namesRef.current || [];
    const currentSeenIds = new Set(currentNameList.map(n => n.firstName.toLowerCase()));
    console.log(`[${timestamp}] 📊 REFRESH V2: Currently have ${currentNameList.length} names. Excluding ${currentSeenIds.size} seen IDs.`);

    // Combine already interacted names (liked/maybe/disliked) with names already fetched in this session
    const excludeRecords = [...likedNames, ...maybeNames, ...dislikedNames];
    const interactedIds = new Set(excludeRecords.map(n => n.firstName.toLowerCase()));
    const allExcludeIds = new Set([...currentSeenIds, ...interactedIds]);

    // --- CHANGE: Request 20 names for the next batch --- 
    const requestedCount = 20;
    const searchParams = { lastName, gender, searchQuery };

    try {
      console.log(`[${timestamp}] 🤖 REFRESH V2: Calling fetchAINames. Requesting: ${requestedCount}, Total Exclusions: ${allExcludeIds.size}`);
      const aiNames = await fetchAINames({
        ...searchParams,
        count: requestedCount,
        // --- CHANGE: Pass ALL excluded names (seen + interacted) --- 
        excludeNames: Array.from(allExcludeIds), 
      });
      console.log(`[${timestamp}] 🤖 REFRESH V2: fetchAINames returned ${aiNames?.length ?? 0} raw names.`);

      if (!aiNames || aiNames.length === 0) {
        console.error(`[${timestamp}] ⚠️ REFRESH V2: fetchAINames returned no new names.`);
        setError("No more new names found for this search."); // More specific error message
        setIsLoadingNames(false);
        setShowCompletionModal(true); // Optionally show a modal indicating completion
        return;
      }
      
      // --- Client-Side Filtering (redundant if backend excludes, but good safety check) ---
      const uniqueFilteredNames: NameType[] = [];
      const seenIds = new Set<string>(); // Use a local set for this batch
      
      for (const name of aiNames) {
        const nameId = name.firstName.toLowerCase();
        // Ensure it's not already in the current list and hasn't been interacted with
        if (!seenIds.has(nameId) && !allExcludeIds.has(nameId)) {
          uniqueFilteredNames.push(name);
          seenIds.add(nameId);
        }
      }
      console.log(`[${timestamp}] ✨ REFRESH V2: Filtered down to ${uniqueFilteredNames.length} unique, non-excluded NEW names.`);

      if (uniqueFilteredNames.length === 0) {
        console.error(`[${timestamp}] ⚠️ REFRESH V2: No new unique, non-excluded names found after filtering.`);
        setError("All generated names were duplicates or already seen. No more new names found.");
        setIsLoadingNames(false);
        setShowCompletionModal(true); // Show completion modal
        return;
      }
      // ---------------------------

      // --- CHANGE: Append new names to the existing list --- 
      const updatedNameList = [...currentNameList, ...uniqueFilteredNames];
      setNames(updatedNameList);
      namesRef.current = updatedNameList;
      // No need for pendingNames anymore
      // setPendingNames([]); 

      // --- CHANGE: Keep current index, user continues swiping from where they left off --- 
      // setCurrentIndex(0); // Do NOT reset index
      
      // Save the updated session state (with appended names)
      try {
        const latestIndex = currentIndexRef.current; // Use the current index for saving
        await AsyncStorage.setItem(CURRENT_SEARCH_KEY, JSON.stringify(searchParams));
        await AsyncStorage.setItem(CURRENT_NAMES_KEY, JSON.stringify(updatedNameList)); // Save combined list
        await AsyncStorage.setItem(CURRENT_INDEX_KEY, latestIndex.toString()); // Save the index where user was
        console.log(`[${timestamp}] 💾 REFRESH V2: Saved updated session with ${updatedNameList.length} total names. Current index: ${latestIndex}`);
      } catch (saveError) {
        console.error("Error saving refreshed session:", saveError);
      }
      
      console.log(`[${timestamp}] ✅ REFRESH V2: Name Refresh Complete. Added ${uniqueFilteredNames.length} new names.`);

    } catch (error) {
      console.error(`[${timestamp}] ❌ REFRESH V2: Error during name fetch or processing:`, error);
      setError(`Error refreshing names: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingNames(false); // Hide loading indicator
    }
  }, [lastName, gender, searchQuery, fetchAINames, likedNames, maybeNames, dislikedNames]); // Dependency array is okay
  
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
          <ActivityIndicator size="large" color="#6A5AFF" />
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
              <Text style={styles.meaningText}>📖 {nextCard.meaning}</Text>
            </LinearGradient>
          </View>
        )}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: topCardOpacity,
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
            <Text style={styles.meaningText}>📖 {currentCard.meaning}</Text>
            
            {/* --- Swipe Overlay --- */}
            <Animated.View style={[
              styles.overlay,
              {
                opacity: overlayType === 'maybe'
                  ? position.y.interpolate({ // Opacity based on Y for Maybe
                      inputRange: [-SCREEN_HEIGHT * 0.4, -50, 0], // Visible when dragged up significantly
                      outputRange: [1, 1, 0],
                      extrapolate: 'clamp'
                    })
                  : position.x.interpolate({ // Opacity based on X for Like/Dislike
                      inputRange: [-SCREEN_WIDTH * 0.4, -50, 0, 50, SCREEN_WIDTH * 0.4],
                      outputRange: [1, 1, 0, 1, 1], // Visible when dragged left/right significantly
                      extrapolate: 'clamp'
                    })
              }
            ]}>
              {overlayType === 'like' && <Text style={[styles.overlayText, styles.overlayLike]}>LIKE</Text>}
              {overlayType === 'dislike' && <Text style={[styles.overlayText, styles.overlayDislike]}>NOPE</Text>}
              {overlayType === 'maybe' && <Text style={[styles.overlayText, styles.overlayMaybe]}>MAYBE</Text>}
            </Animated.View>
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
    } else if (gender === 'unisex') {
      return ['#6A5AFF', '#8A7FFF']; // Zuzu Purple gradient
    } else { // 'any' or other cases default to neutral
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
          // Use currentIndexRef.current for the most up-to-date value
          const latestIndex = currentIndexRef.current; 
          
          // Save only if we have names and the index is valid (though list change implies names exist)
          if (names.length > 0) { 
            const searchParams = { lastName, gender, searchQuery };
            await AsyncStorage.setItem(CURRENT_SEARCH_KEY, JSON.stringify(searchParams));
            await AsyncStorage.setItem(CURRENT_NAMES_KEY, JSON.stringify(names));
            await AsyncStorage.setItem(CURRENT_INDEX_KEY, latestIndex.toString());
            console.log(`Session saved after name list change: ${names.length} names, index ${latestIndex}`);
          }
        } catch (error) {
          console.error("Error saving session after name list change:", error);
        }
      };
      
      saveCurrentSessionState();
    }
  }, [likedNames, maybeNames, dislikedNames, hasInitiatedSearch, lastName, gender, searchQuery]);
  
  // Add a cleanup handler to save session on unmount
  useEffect(() => {
    // Save the current session when component unmounts
    return () => {
      // Always try to save if search was initiated and we potentially have state
      if (hasInitiatedSearch) { 
        console.log("Component unmounting, saving final session state");
        
        // Use a synchronous version for cleanup and use the ref
        const saveSession = async () => {
          try {
            // Use currentIndexRef.current for the most up-to-date value
            const latestIndex = currentIndexRef.current; 
            const currentNames = namesRef.current; // Use names ref as well

            // Check if we actually have names to save
            if (currentNames.length > 0) {
              const searchParams = { lastName, gender, searchQuery };
              await AsyncStorage.setItem(CURRENT_SEARCH_KEY, JSON.stringify(searchParams));
              await AsyncStorage.setItem(CURRENT_NAMES_KEY, JSON.stringify(currentNames));
              await AsyncStorage.setItem(CURRENT_INDEX_KEY, latestIndex.toString());
              console.log(`Saved final session on unmount: ${currentNames.length} names, index ${latestIndex}`);
            } else {
               console.log("Skipped saving session on unmount: No names loaded.");
            }
          } catch (error) {
            console.error("Error saving final session on unmount:", error);
          }
        };
        
        // Execute but don't wait for promise to complete - this is a best effort save
        saveSession();
      }
    };
  // Depend only on variables needed for the save itself and the condition
  }, [hasInitiatedSearch, lastName, gender, searchQuery]); 
  
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
  
  // Update getProgressText to show out of total in batch
  const getProgressText = useCallback(() => {
    if (!names.length) return '';
    const totalInBatch = namesRef.current.length > 0 ? namesRef.current.length : 20;
    return `${currentIndex + 1}/${totalInBatch}`; // Removed emoji
  }, [currentIndex]);
  
  const [isRefreshPressed, setIsRefreshPressed] = useState(false);
  
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {renderCompletionModal()}
      <SafeAreaView style={styles.safeAreaContent}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerIconButton} 
            onPress={goToNewSearch}
            activeOpacity={0.6}
          >
            <Ionicons name="chevron-back" size={28} color="#6A5AFF" />
          </TouchableOpacity>
          
          <View style={styles.headerCenterContent}>
            <TouchableOpacity 
              style={[
                styles.refreshButton,
                isRefreshPressed && styles.refreshButtonPressed
              ]} 
              onPress={refreshNames}
              onPressIn={() => setIsRefreshPressed(true)}
              onPressOut={() => setIsRefreshPressed(false)}
              activeOpacity={1}
            >
              <Ionicons 
                name="add-circle-outline" 
                size={24} 
                color={isRefreshPressed ? 'white' : 'black'} 
              />
              <Text style={[
                styles.refreshButtonText,
                isRefreshPressed && styles.refreshButtonTextPressed
              ]}>More Names</Text>
            </TouchableOpacity>
            
            {/* Progress counter commented out
            {hasInitiatedSearch && names.length > 0 && currentIndex < names.length && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>{getProgressText()}</Text>
              </View>
            )}
            */}
          </View>
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
        <BottomTabBar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  safeAreaContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'white',
    position: 'relative',
  },
  headerIconButton: {
    padding: 10,
    borderRadius: 8,
    position: 'absolute',
    left: 16,
  },
  headerCenterContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.neutral.black,
  },
  refreshButtonPressed: {
    backgroundColor: '#6A5AFF',
  },
  refreshButtonText: {
    color: 'black',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  refreshButtonTextPressed: {
    color: 'white',
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
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  cardGradient: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    justifyContent: 'center',
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
    backgroundColor: '#6A5AFF',
  },
  dislikeButton: {
    backgroundColor: '#FF0000',
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
    color: '#6A5AFF',
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
    backgroundColor: 'white',
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
    color: '#6A5AFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
  },
  aiSubtext: {
    color: '#6A5AFF',
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
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
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
    backgroundColor: '#6A5AFF',
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
  // Styles for Swipe Overlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, // Ensure it's above the card content
  },
  overlayText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    borderWidth: 4,
    borderColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    opacity: 0.8, // Slight transparency
  },
  overlayLike: {
    borderColor: '#4CAF50',
    color: '#4CAF50',
    transform: [{ rotate: '-20deg' }],
  },
  overlayDislike: {
    borderColor: '#F44336',
    color: '#F44336',
    transform: [{ rotate: '20deg' }],
  },
  overlayMaybe: {
    borderColor: '#6A5AFF', 
    color: '#6A5AFF',
    // No rotation for maybe
  },
  // End Styles for Swipe Overlay
}); 