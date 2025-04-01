import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomTabBar from './components/BottomTabBar';
import Colors from '@/constants/Colors';
import { useNameStatus, LoadingState } from '@/hooks/useNameStatus';

// Define types with the same structure as NameType in useNameStatus
type NameCardItem = {
  firstName: string;
  lastName?: string;
  meaning: string;
  origin: string;
  gender: 'boy' | 'girl' | 'unisex' | 'any';
  id?: string;
  isFavorite?: boolean;
  listIndex?: number; // Add index for color cycling
};

// Add timestamp helper function
const getTimestamp = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

// Define a refined color palette - cohesive and good contrast with white text
const cardColorPalette = [
  { main: '#6A5AFF' }, // Zuzu Purple
  { main: '#FF5BA1' }, // Pink
  { main: '#3CA3FF' }, // Blue
  { main: '#FFB83D' }, // Gold/Orange
  { main: '#4DCC8F' }, // Green
  { main: '#B799FF' }, // Lighter Purple
];

export default function LikesScreen() {
  const insets = useSafeAreaInsets();
  const timestamp = getTimestamp();
  
  // Use the useNameStatus hook - get loadingState instead of isInitialized
  const { 
    likedNames, 
    maybeNames, 
    dislikedNames, 
    saveNameStatus, 
    loadingState // <-- Get the new loading state
  } = useNameStatus();
  
  // RE-ADD TEMP LOG: Check the state received from the hook
  // console.log(`[${getTimestamp()}] TEMP_DEBUG_LIKES: Received from hook - Loading: ${loadingState}, Liked: ${likedNames?.length ?? 'null/undef'}, Maybe: ${maybeNames?.length ?? 'null/undef'}`);

  // Local state to track favorite status WITHIN this screen
  const [localFavorites, setLocalFavorites] = useState<Record<string, boolean>>({}); 
  
  const [activeTab, setActiveTab] = useState<'liked' | 'maybe' | 'favorites'>('liked');
  const [pressedTrashId, setPressedTrashId] = useState<string | null>(null); // State for trash press
  
  // Log when the screen initializes and when names are loaded/ready
  useEffect(() => {
    const timestamp = getTimestamp();
    console.log(`[${timestamp}] 🚀 LIKES_SCREEN: Component mounted/updated, loading state: ${loadingState}`);
    if (loadingState === 'ready') { 
      console.log(`[${timestamp}] 📊 LIKES_SCREEN: State is ready (liked=${likedNames.length}, maybe=${maybeNames.length})`);
    }
  }, [loadingState, likedNames, maybeNames]); // Depend on loading state and lists

  // Helper function to generate consistent IDs for names
  const generateNameId = useCallback((name: NameCardItem) => {
    // Use a combination of fields for a more unique ID if needed
    return `${name.firstName.toLowerCase()}-${name.gender}-${(name.lastName || '').toLowerCase()}`;
  }, []);
  
  // Process liked names using useMemo
  const processedLikedNames = useMemo(() => {
    const timestamp = getTimestamp();
    console.log(`[${timestamp}] 🔄 LIKES_SCREEN: Memoizing ${likedNames.length} liked names`);
    return likedNames.map((name, index) => { // Add index here
      const id = generateNameId(name);
      return {
        ...name,
        id: id,
        isFavorite: !!localFavorites[id], // Check favorite status from local state
        listIndex: index, // Assign index for color cycling
      };
    });
  }, [likedNames, localFavorites, generateNameId]); // Re-run if likedNames or localFavorites change

  // Process maybe names using useMemo
  const processedMaybeNames = useMemo(() => {
    const timestamp = getTimestamp();
    console.log(`[${timestamp}] 🔄 LIKES_SCREEN: Memoizing ${maybeNames.length} maybe names`);
    return maybeNames.map((name, index) => { // Add index here
      const id = generateNameId(name);
      return {
        ...name,
        id: id,
        isFavorite: !!localFavorites[id], // Check favorite status from local state
        listIndex: index, // Assign index for color cycling
      };
    });
  }, [maybeNames, localFavorites, generateNameId]); // Re-run if maybeNames or localFavorites change
  
  // Derive favorites list using useMemo
  const derivedFavoriteNames = useMemo(() => {
     const timestamp = getTimestamp();
     const favorites = [...processedLikedNames, ...processedMaybeNames].filter(name => name.isFavorite);
     console.log(`[${timestamp}] ⭐ LIKES_SCREEN: Derived ${favorites.length} favorite names`);
     return favorites;
  }, [processedLikedNames, processedMaybeNames]);

  // Log when the active tab changes
  useEffect(() => {
    const timestamp = getTimestamp();
    console.log(`[${timestamp}] 🔖 LIKES_SCREEN: Active tab changed to "${activeTab}"`);
  }, [activeTab]);
  
  // Toggle favorite status ONLY in the local state map
  const toggleFavorite = useCallback((id: string) => {
    const timestamp = getTimestamp();
    console.log(`[${timestamp}] ⭐ LIKES_SCREEN: Toggling local favorite for ID ${id}`);
    setLocalFavorites(prev => ({
      ...prev,
      [id]: !prev[id] // Toggle the boolean value
    }));
  }, []); 
  
  // Discard function remains similar, but removes from the source hook state
  const discardName = useCallback(async (item: NameCardItem) => {
    const timestamp = getTimestamp();
    const id = item.id || generateNameId(item); // Ensure ID exists
    console.log(`[${timestamp}] 🗑️ LIKES_SCREEN: Discarding name "${item.firstName}" (ID: ${id})`);
    
    // No need for optimistic UI removal here, as the lists will re-render 
    // when useNameStatus updates after saveNameStatus completes.
    
    try {
      // Directly call saveNameStatus to update the master lists and trigger re-render
      await saveNameStatus(
        { ...item }, // Pass necessary fields
        'disliked' 
      );
      console.log(`[${timestamp}] ✅ LIKES_SCREEN: Successfully saved discard status for "${item.firstName}"`);
      // Remove from local favorites if it was favorited
      setLocalFavorites(prev => {
        const newFavs = { ...prev };
        if (newFavs[id]) {
          delete newFavs[id];
          console.log(`[${timestamp}] ⭐ LIKES_SCREEN: Removed discarded name ${id} from local favorites`);
        }
        return newFavs;
      });
    } catch (error) {
      console.error(`[${timestamp}] ❌ LIKES_SCREEN: Failed to save discard status for "${item.firstName}":`, error);
    }
  }, [activeTab, saveNameStatus, generateNameId]);
  
  const getNameInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };
  
  // Keep renderNameItem concise - it now uses the memoized processed lists
  const renderNameItem = useCallback(({ item }: { item: NameCardItem }) => {
    if (!item || !item.id) { // Ensure item and id exist
      console.warn(`[${getTimestamp()}] ⚠️ LIKES_SCREEN: Attempted to render invalid item:`, item);
      return null; 
    }
    
    // Determine color based on gender
    let cardColor = Colors.gender.neutral.main; // Default to neutral
    if (item.gender === 'boy') {
      cardColor = '#3CA3FF'; // Blue
    } else if (item.gender === 'girl') {
      cardColor = '#FF5BA1'; // Pink
    } else if (item.gender === 'unisex') {
      cardColor = '#6A5AFF'; // Zuzu Purple
    }
    
    const isTrashPressed = pressedTrashId === item.id;

    return (
      <View style={styles.cardContainer}>
        <View style={[styles.card, { backgroundColor: cardColor }]}>
          <View style={styles.nameDetails}> 
            <Text style={styles.nameText}>{item.firstName}{item.lastName ? ` ${item.lastName}` : ''}</Text>
            <Text style={styles.meaningText}>{item.meaning}</Text>
            <Text style={styles.originText}>{item.origin}</Text>
          </View>
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              onPress={() => toggleFavorite(item.id!)} 
              style={styles.iconButton}
              activeOpacity={0.7} 
            >
              <Ionicons 
                name={item.isFavorite ? "star" : "star-outline"} // Changed to star
                size={26} // Slightly larger star
                color={item.isFavorite ? '#FFD700' : '#FFFFFF'} // Use Gold color for favorite
              />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => discardName(item)} 
              onPressIn={() => setPressedTrashId(item.id!)} // Set pressed ID
              onPressOut={() => setPressedTrashId(null)}  // Clear pressed ID
              style={styles.iconButton}
              activeOpacity={0.7} 
            >
              <Ionicons 
                name={isTrashPressed ? "trash" : "trash-outline"} // Toggle based on press state
                size={24} 
                color="#FFFFFF" // Keep white, visual feedback is fill/outline
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [activeTab, toggleFavorite, discardName, generateNameId, pressedTrashId]); // Add pressedTrashId dependency

  // Function to determine which list to display
  const getDataForList = () => {
     // Return empty if not ready
    if (loadingState !== 'ready') return [];
    
    switch (activeTab) {
      case 'liked':
        return processedLikedNames;
      case 'maybe':
        return processedMaybeNames;
      case 'favorites':
        return derivedFavoriteNames; // Use the derived list
      default:
        return [];
    }
  };

  // Function to render content based on loadingState
  const renderContent = () => {
    switch (loadingState) {
      case 'idle':
      case 'loading':
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary.main} />
            <Text style={styles.loadingText}>Loading matches...</Text>
          </View>
        );
      case 'error':
        return (
          <View style={styles.emptyContainer}> 
             <Ionicons name="warning-outline" size={60} color={Colors.neutral.lightGray} />
             <Text style={styles.emptyText}>Could not load names.</Text>
             <Text style={styles.emptySubText}>Please check your connection and try again.</Text>
             {/* Optionally add a retry button here */}
          </View>
        );
      case 'ready':
        const data = getDataForList();
        if (data.length === 0) {
          let emptyMessage = "You haven't matched any names yet.";
          if (activeTab === 'maybe') {
             emptyMessage = "You haven't saved any names as maybe.";
          } else if (activeTab === 'favorites') {
             emptyMessage = "You haven't favorited any names yet.";
          }
          return (
             <View style={styles.emptyContainer}>
                <Ionicons name="file-tray-outline" size={60} color={Colors.neutral.lightGray} />
                <Text style={styles.emptyText}>{emptyMessage}</Text>
                <Text style={styles.emptySubText}>Swipe right on names you like!</Text>
            </View>
          );
        }
        // ADD TEMP LOG: Check data *just* before passing to FlatList
        // console.log(`[${getTimestamp()}] TEMP_DEBUG_FLATLIST: Rendering FlatList with ${data.length} items for tab '${activeTab}'`);
        return (
          <FlatList
            data={data}
            renderItem={renderNameItem}
            keyExtractor={(item) => item.id || generateNameId(item)} // Fallback key generation
            contentContainerStyle={styles.listContentContainer}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={<View style={{ height: 100 }} />} // Add space at bottom
          />
        );
       default: 
         return null; // Should not happen
    }
  };

  // Render main structure
  return (
     <View style={styles.container}>
       <StatusBar style="dark" />
       <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: 0 }]}>
         {/* Header */}
         <View style={styles.header}>
           <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
             <Ionicons name="chevron-back" size={28} color="#6A5AFF" />
           </TouchableOpacity>
           <Text style={styles.headerTitle}>Matches</Text>
           <View style={{ width: 40 }} /> 
         </View>

         {/* Tabs */}
         <View style={styles.tabContainer}>
           <TouchableOpacity
             style={styles.tabButton}
             onPress={() => setActiveTab('liked')}
             activeOpacity={0.7}
           >
             <Text style={[styles.tabText, activeTab === 'liked' && styles.activeTabText]}>
               Liked ({likedNames.length})
             </Text>
           </TouchableOpacity>
           <TouchableOpacity
             style={styles.tabButton}
             onPress={() => setActiveTab('maybe')}
             activeOpacity={0.7}
           >
             <Text style={[styles.tabText, activeTab === 'maybe' && styles.activeTabText]}>
               Maybe ({maybeNames.length})
             </Text>
           </TouchableOpacity>
            <TouchableOpacity
             style={styles.tabButton}
             onPress={() => setActiveTab('favorites')}
             activeOpacity={0.7}
           >
             <Text style={[styles.tabText, activeTab === 'favorites' && styles.activeTabText]}>
               Favorites ({derivedFavoriteNames.length})
             </Text>
           </TouchableOpacity>
         </View>

         {/* Content Area - Uses renderContent function */}
         <View style={styles.contentArea}>
           {renderContent()}
         </View>

       </SafeAreaView>

       {/* Bottom Tab Bar */}
       <BottomTabBar />
     </View>
  );
}

// Styles (Keep existing styles, but add/modify as needed for empty/error states)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral.white, 
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lightGray,
    backgroundColor: Colors.neutral.white, 
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6A5AFF',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: Colors.neutral.white, 
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lightGray,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'normal',
    color: Colors.neutral.gray,
  },
  activeTabText: {
    fontWeight: 'bold',
    color: Colors.neutral.black,
  },
  contentArea: {
    flex: 1, // Make content area take remaining space
  },
  listContentContainer: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 100, // Extra padding at the bottom
  },
  cardContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6, // Reduced space between cards
    width: '100%',
    alignItems: 'center', 
  },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14, // Slightly less rounded for tighter look
    paddingVertical: 12, // Reduced vertical padding
    paddingHorizontal: 16, // Reduced horizontal padding slightly
    shadowColor: Colors.neutral.black,
    shadowOffset: {
      width: 0,
      height: 2, // Subtle shadow
    },
    shadowOpacity: 0.15, 
    shadowRadius: 4, 
    elevation: 3,
    // backgroundColor set dynamically
  },
  nameDetails: {
    flex: 1,
    marginRight: 12, 
  },
  nameText: {
    fontSize: 19, // Readable prominent size
    fontWeight: '700', // Heavy weight for hierarchy
    color: '#FFFFFF', // Pure white for contrast
    marginBottom: 5, // Clear separation
    // Removed text shadow for clarity
  },
  meaningText: {
    fontSize: 13, // Smaller secondary size
    fontWeight: '400', // Lighter weight
    color: '#FFFFFF', // Pure white for contrast
    marginBottom: 1, 
    lineHeight: 18, 
  },
  originText: {
    fontSize: 13, // Match meaning size
    fontWeight: '400', // Lighter weight
    color: '#FFFFFF', // Pure white for contrast
    fontStyle: 'italic',
    lineHeight: 18, 
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 6, // Slightly smaller padding
    marginLeft: 8, // Keep some space between icons
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100, // Offset from bottom bar
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: Colors.neutral.gray,
  },
  emptyContainer: {
     flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30, 
    paddingBottom: 100, // Offset from bottom bar
  },
  emptyText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.black,
    textAlign: 'center',
  },
   emptySubText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.neutral.gray,
    textAlign: 'center',
  },
}); 