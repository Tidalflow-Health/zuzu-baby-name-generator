import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, router } from 'expo-router';

type BottomTabBarProps = {
  likedNamesData?: string;
  maybeNamesData?: string;
};

// Define valid paths for type checking
type ValidPath = '/home' | '/names' | '/likes';

const BottomTabBar: React.FC<BottomTabBarProps> = ({ likedNamesData, maybeNamesData }) => {
  const pathname = usePathname();

  const navigate = (path: ValidPath, params?: Record<string, string>) => {
    if (path === pathname) return;
    
    if (params) {
      router.push({
        pathname: path,
        params
      });
    } else {
      router.push(path);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.tabButton, pathname === '/home' && styles.activeTab]}
        onPress={() => navigate('/home')}
      >
        <Ionicons 
          name="search-outline" 
          size={24} 
          color={pathname === '/home' ? '#F39F86' : '#777'} 
        />
        <Text 
          style={[
            styles.tabText, 
            pathname === '/home' && styles.activeTabText
          ]}
        >
          Search
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, pathname === '/names' && styles.activeTab]}
        onPress={() => navigate('/names')}
      >
        <Ionicons 
          name="person-outline" 
          size={24} 
          color={pathname === '/names' ? '#F39F86' : '#777'} 
        />
        <Text 
          style={[
            styles.tabText, 
            pathname === '/names' && styles.activeTabText
          ]}
        >
          Names
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, pathname === '/likes' && styles.activeTab]}
        onPress={() => {
          if (likedNamesData && maybeNamesData) {
            navigate('/likes', {
              likedNamesData,
              maybeNamesData
            });
          } else {
            navigate('/likes');
          }
        }}
      >
        <Ionicons 
          name="heart-outline" 
          size={24} 
          color={pathname === '/likes' ? '#F39F86' : '#777'} 
        />
        <Text 
          style={[
            styles.tabText, 
            pathname === '/likes' && styles.activeTabText
          ]}
        >
          Matches
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 70,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 10,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 10,
  },
  activeTab: {
    borderTopWidth: 2,
    borderTopColor: '#F39F86',
  },
  tabText: {
    marginTop: 4,
    fontSize: 12,
    color: '#777',
  },
  activeTabText: {
    color: '#F39F86',
    fontWeight: 'bold',
  },
});

export default BottomTabBar; 