import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomTabBar from './components/BottomTabBar';
import Colors from '../constants/Colors';
import { useNameStatus } from '../hooks/useNameStatus';

// Define types with the same structure as NameType in useNameStatus
type NameCardItem = {
  firstName: string;
  lastName?: string;
  meaning: string;
  origin: string;
  gender: 'boy' | 'girl' | 'unisex' | 'any';
  id?: string;
  isFavorite?: boolean;
};

export default function LikesScreen() {
  const insets = useSafeAreaInsets();
  // Use the useNameStatus hook to access persistently stored names
  const { likedNames, maybeNames, dislikedNames, saveNameStatus } = useNameStatus();
  
  const [favoriteNames, setFavoriteNames] = useState<NameCardItem[]>([]);
  const [activeTab, setActiveTab] = useState<'liked' | 'maybe' | 'favorites'>('liked');
  
  // Debug useEffect to log the names we're receiving from useNameStatus
  useEffect(() => {
    console.log("LikesScreen - likedNames from hook:", likedNames.length);
    console.log("LikesScreen - maybeNames from hook:", maybeNames.length);
    
    // Log some sample names if available
    if (likedNames.length > 0) {
      console.log("Sample liked name:", likedNames[0].firstName);
    }
    if (maybeNames.length > 0) {
      console.log("Sample maybe name:", maybeNames[0].firstName);
    }
  }, [likedNames, maybeNames]);
  
  // Process names once on component mount or when likedNames/maybeNames change
  const [processedLikedNames, setProcessedLikedNames] = useState<NameCardItem[]>([]);
  const [processedMaybeNames, setProcessedMaybeNames] = useState<NameCardItem[]>([]);
  
  // Helper function to generate consistent IDs for names
  const generateNameId = useCallback((name: NameCardItem) => {
    return `${name.firstName.toLowerCase()}-${(name.lastName || '').toLowerCase()}`;
  }, []);
  
  // Process liked names when they change
  useEffect(() => {
    if (likedNames && likedNames.length > 0) {
      console.log("Processing liked names:", likedNames.length);
      const processed = likedNames.map((name) => ({
        ...name,
        id: generateNameId(name),
        isFavorite: false
      }));
      setProcessedLikedNames(processed);
    } else {
      setProcessedLikedNames([]);
    }
  }, [likedNames, generateNameId]);
  
  // Process maybe names when they change
  useEffect(() => {
    if (maybeNames && maybeNames.length > 0) {
      console.log("Processing maybe names:", maybeNames.length);
      const processed = maybeNames.map((name) => ({
        ...name,
        id: generateNameId(name),
        isFavorite: false
      }));
      setProcessedMaybeNames(processed);
    } else {
      setProcessedMaybeNames([]);
    }
  }, [maybeNames, generateNameId]);

  // Update favorites when processed names change
  useEffect(() => {
    const allFavorites = [...processedLikedNames, ...processedMaybeNames].filter(name => name.isFavorite);
    setFavoriteNames(allFavorites);
  }, [processedLikedNames, processedMaybeNames]);
  
  // Use useCallback to prevent recreation on every render
  const toggleFavorite = useCallback((id: string) => {
    // Find the name in either list
    setProcessedLikedNames(prevNames => {
      const updatedNames = [...prevNames];
      const nameIndex = updatedNames.findIndex(name => name.id === id);
      
      if (nameIndex !== -1) {
        const updatedName = { 
          ...updatedNames[nameIndex], 
          isFavorite: !updatedNames[nameIndex].isFavorite 
        };
        updatedNames[nameIndex] = updatedName;
        
        // No need to call saveNameStatus here as we're just toggling favorite status
        // which is a UI-only state that doesn't affect the underlying storage
      }
      
      return updatedNames;
    });
    
    setProcessedMaybeNames(prevNames => {
      const updatedNames = [...prevNames];
      const nameIndex = updatedNames.findIndex(name => name.id === id);
      
      if (nameIndex !== -1) {
        const updatedName = { 
          ...updatedNames[nameIndex], 
          isFavorite: !updatedNames[nameIndex].isFavorite 
        };
        updatedNames[nameIndex] = updatedName;
        
        // No need to call saveNameStatus here as we're just toggling favorite status
        // which is a UI-only state that doesn't affect the underlying storage
      }
      
      return updatedNames;
    });
  }, []);
  
  const getNameInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };
  
  const renderNameItem = useCallback(({ item }: { item: NameCardItem }) => {
    if (!item) {
      return null; // Skip rendering null items
    }
    
    // Set solid colors based on the gender
    let cardColor: string;
    let avatarBgColor: string;
    
    if (item.gender === 'boy') {
      cardColor = Colors.gender.boy.main;
      avatarBgColor = Colors.gender.boy.light;
    } else if (item.gender === 'girl') {
      cardColor = Colors.gender.girl.main;
      avatarBgColor = Colors.gender.girl.light;
    } else if (item.gender === 'unisex') {
      cardColor = Colors.gender.neutral.main;
      avatarBgColor = Colors.gender.neutral.light;
    } else {
      cardColor = Colors.gender.neutral.main;
      avatarBgColor = Colors.gender.neutral.light;
    }
    
    return (
      <View style={styles.nameCard}>
        <View style={[styles.cardContainer, { backgroundColor: cardColor }]}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: avatarBgColor }]}>
              <Text style={styles.avatarText}>{getNameInitial(item.firstName)}</Text>
            </View>
          </View>
          
          <View style={styles.nameInfo}>
            <Text style={styles.nameText}>
              {item.firstName} {item.lastName ? item.lastName : ''}
            </Text>
            <Text style={styles.meaningText}>
              Means: {item.meaning || 'Unknown'}
            </Text>
            <Text style={styles.originText}>
              Origin: {item.origin || 'Unknown'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.favoriteButton} 
            onPress={() => toggleFavorite(item.id || '')}
          >
            <Ionicons 
              name={item.isFavorite ? "star" : "star-outline"} 
              size={24} 
              color={item.isFavorite ? Colors.secondary.yellow : Colors.text.onDark} 
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [toggleFavorite]);
  
  const goBack = useCallback(() => {
    router.back();
  }, []);

  // Get the data for the current active tab
  const getActiveData = useCallback(() => {
    switch (activeTab) {
      case 'liked':
        return processedLikedNames;
      case 'maybe':
        return processedMaybeNames;
      case 'favorites':
        return favoriteNames;
      default:
        return [];
    }
  }, [activeTab, processedLikedNames, processedMaybeNames, favoriteNames]);

  // Ensure keyExtractor always uses the item's ID which is now guaranteed to be unique
  const keyExtractor = useCallback((item: NameCardItem) => {
    return item.id || `fallback-${Math.random().toString(36).substring(2, 15)}`;
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.gradients.background[0], Colors.gradients.background[1]]}
        style={styles.background}
      >
        <SafeAreaView style={[styles.safeAreaContent, { paddingBottom: 0 }]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerIconButton} onPress={goBack}>
              <Ionicons name="arrow-back" size={28} color="black" />
            </TouchableOpacity>
            <View style={styles.headerTabs}>
              <TouchableOpacity
                style={[
                       styles.headerTab,
                       activeTab === 'liked' && styles.activeHeaderTabLiked,
                ]}
                onPress={() => setActiveTab('liked')}
              >
                     <Text style={styles.headerTabText}>I Like</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                       styles.headerTab,
                       activeTab === 'maybe' && styles.activeHeaderTabMaybe,
                ]}
                onPress={() => setActiveTab('maybe')}
              >
                     <Text style={styles.headerTabText}>Maybe</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                       styles.headerTab,
                       activeTab === 'favorites' && styles.activeHeaderTabFavorites,
                ]}
                onPress={() => setActiveTab('favorites')}
              >
                     <Text style={styles.headerTabText}>Favorites</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <FlatList
            data={getActiveData()}
            renderItem={renderNameItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No {
                    activeTab === 'liked' 
                      ? 'liked' 
                      : activeTab === 'maybe' 
                        ? 'maybe' 
                        : 'favorite'
                  } names yet
                </Text>
              </View>
            }
          />
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
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.neutral.white,
  },
  headerIconButton: {
    padding: 10,
    borderRadius: 8,
  },
  headerTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerTab: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  activeHeaderTabLiked: {
    backgroundColor: '#FF5BA1', // Pink for liked tab
  },
  activeHeaderTabMaybe: {
    backgroundColor: '#3CA3FF', // Blue for maybe tab
  },
  activeHeaderTabFavorites: {
    backgroundColor: '#B799FF', // Purple for favorites tab
  },
  headerTabText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 13,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 120,
  },
  nameCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
    shadowColor: Colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContainer: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.text.onDark,
    fontSize: 20,
    fontWeight: 'bold',
  },
  nameInfo: {
    flex: 1,
  },
  nameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.onDark,
    marginBottom: 2,
  },
  meaningText: {
    fontSize: 14,
    color: Colors.text.onDark,
    opacity: 0.9,
    marginBottom: 2,
  },
  originText: {
    fontSize: 12,
    color: Colors.text.onDark,
    opacity: 0.8,
  },
  favoriteButton: {
    padding: 8,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 4,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: 'black',
    textAlign: 'center',
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
  }
}); 