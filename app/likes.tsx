import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomTabBar from './components/BottomTabBar';
import Colors from '../constants/Colors';

// Define types
type NameCardProps = {
  firstName: string;
  lastName: string;
  meaning: string;
  origin: string;
  id?: string;
  isFavorite?: boolean;
};

export default function LikesScreen() {
  const params = useLocalSearchParams<{
    likedNamesData: string;
    maybeNamesData: string;
  }>();
  const insets = useSafeAreaInsets();
  
  const [likedNames, setLikedNames] = useState<NameCardProps[]>([]);
  const [maybeNames, setMaybeNames] = useState<NameCardProps[]>([]);
  const [favoriteNames, setFavoriteNames] = useState<NameCardProps[]>([]);
  const [activeTab, setActiveTab] = useState<'liked' | 'maybe' | 'favorites'>('liked');
  
  useEffect(() => {
    if (params.likedNamesData) {
      try {
        const parsed = JSON.parse(params.likedNamesData);
        // Add unique IDs if they don't exist
        const withIds = parsed.map((name: NameCardProps) => ({
          ...name,
          id: name.id || `${name.firstName}-${name.lastName || ''}-${Math.random().toString(36).substr(2, 9)}`,
          isFavorite: name.isFavorite || false
        }));
        setLikedNames(withIds);
      } catch (error) {
        console.error('Error parsing liked names:', error);
      }
    }
    
    if (params.maybeNamesData) {
      try {
        const parsed = JSON.parse(params.maybeNamesData);
        // Add unique IDs if they don't exist
        const withIds = parsed.map((name: NameCardProps) => ({
          ...name,
          id: name.id || `${name.firstName}-${name.lastName || ''}-${Math.random().toString(36).substr(2, 9)}`,
          isFavorite: name.isFavorite || false
        }));
        setMaybeNames(withIds);
      } catch (error) {
        console.error('Error parsing maybe names:', error);
      }
    }
  }, [params.likedNamesData, params.maybeNamesData]);

  // Update favorites when liked or maybe names change
  useEffect(() => {
    const allFavorites = [...likedNames, ...maybeNames].filter(name => name.isFavorite);
    setFavoriteNames(allFavorites);
  }, [likedNames, maybeNames]);
  
  const toggleFavorite = (id: string) => {
    // Update in liked names
    setLikedNames(prev => 
      prev.map(name => 
        name.id === id ? { ...name, isFavorite: !name.isFavorite } : name
      )
    );
    
    // Update in maybe names
    setMaybeNames(prev => 
      prev.map(name => 
        name.id === id ? { ...name, isFavorite: !name.isFavorite } : name
      )
    );
  };
  
  const getNameInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };
  
  const renderNameItem = ({ item }: { item: NameCardProps | null }) => {
    if (!item) {
      return null; // Skip rendering null items
    }
    
    // Set solid colors based on the active tab
    let cardColor: string = '#FF5BA1'; // Default pink for liked names
    
    if (activeTab === 'liked') {
      cardColor = '#FF5BA1'; // Pink for liked names
    } else if (activeTab === 'maybe') {
      cardColor = '#3CA3FF'; // Blue for maybe names
    } else if (activeTab === 'favorites') {
      cardColor = '#B799FF'; // Purple for favorites
    }
    
    return (
      <View style={styles.nameCard}>
        <View style={[styles.cardContainer, { backgroundColor: cardColor }]}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: activeTab === 'liked' ? '#FFC2D8' : 
                                                         activeTab === 'maybe' ? '#C9E7FF' : 
                                                         '#E2D9FF' }]}>
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
  };
  
  const goBack = () => {
    router.back();
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
            <TouchableOpacity style={styles.headerIconButton} onPress={goBack}>
              <Ionicons name="arrow-back" size={28} color="white" />
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
            data={
              activeTab === 'liked' 
                ? likedNames 
                : activeTab === 'maybe' 
                  ? maybeNames 
                  : favoriteNames
            }
            keyExtractor={(item) => item.id || `${Math.random()}`}
            renderItem={renderNameItem}
            contentContainerStyle={styles.listContainer}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.secondary.yellow,
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
    color: Colors.text.onDark,
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
    color: Colors.text.onDark,
    textAlign: 'center',
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
  },
}); 