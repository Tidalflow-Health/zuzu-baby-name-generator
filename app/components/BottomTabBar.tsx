import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';

type BottomTabBarProps = {
  likedNamesData?: string;
  maybeNamesData?: string;
  backgroundColor?: string;
};

// Define valid paths for type checking
type ValidPath = '/home' | '/names' | '/likes';

// Define valid icon names - explicitly include outline variants
type ValidIcon = 'search' | 'search-outline' | 'layers-outline' | 'star' | 'star-outline' | 'person' | 'person-outline';

type Route = {
  name: string;
  path: ValidPath;
  icon: ValidIcon;
  showAsCircle?: boolean;
};

export default function BottomTabBar({
  likedNamesData = '[]',
  maybeNamesData = '[]',
  backgroundColor = '#FFFFFF',
}: BottomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  
  // Define routes with better icon choices
  const routes: Route[] = [
    {
      name: 'Find Names',
      path: '/home',
      icon: 'person',
      showAsCircle: true,
    },
    {
      name: 'Swipe',
      path: '/names',
      icon: 'layers-outline',
    },
    {
      name: 'Favorites',
      path: '/likes',
      icon: 'star',
    },
  ];
  
  const navigateTo = (path: ValidPath) => {
    let params = {};
    
    // Pass data to other screens
    if (path !== pathname) {
      params = {
        likedNamesData,
        maybeNamesData,
      };
    }
    
    router.push({
      pathname: path,
      params,
    });
  };
  
  // Get icon size based on active state
  const getIconSize = (isActive: boolean, isCircle: boolean) => {
    if (isCircle) return 26;
    return isActive ? 24 : 22;
  };
  
  return (
    <View style={styles.wrapper}>
      {/* Floating search button */}
      <TouchableOpacity
        style={[
          styles.floatingButton,
          { left: screenWidth / 6 - 27 } // Position at 1/6 of screen width minus half button width
        ]}
        onPress={() => navigateTo('/home')}
        activeOpacity={0.7}
      >
        <View style={[styles.circleButton, { backgroundColor: '#6A5AFF' }]}>
          <Ionicons
            name="person"
            size={26}
            color="white"
          />
        </View>
      </TouchableOpacity>
      
      {/* Main tab bar */}
      <View
        style={[
          styles.container,
          {
            backgroundColor,
            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : 8,
          },
        ]}
      >
        {routes.map((route) => {
          // Skip the Search button in the regular tab rendering
          if (route.showAsCircle) {
            return (
              <View key={route.path} style={styles.tab}>
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: pathname === route.path ? '#6A5AFF' : 'black',
                      fontWeight: pathname === route.path ? '600' : 'normal',
                      marginTop: 24, // Push text down to align with other tabs
                    },
                  ]}
                >
                  {route.name}
                </Text>
              </View>
            );
          }
          
          const isActive = pathname === route.path;
          
          return (
            <TouchableOpacity
              key={route.path}
              style={styles.tab}
              onPress={() => navigateTo(route.path)}
              activeOpacity={0.7}
            >
              <View style={styles.tabContent}>
                <Ionicons
                  // Conditionally add -outline, except for icons already ending with it
                  name={isActive 
                    ? route.icon 
                    : route.icon === 'layers-outline' 
                      ? 'layers-outline' 
                      : `${route.icon}-outline` as any}
                  size={getIconSize(isActive, false)}
                  color={isActive ? '#6A5AFF' : '#000000'}
                  style={styles.tabIcon}
                />
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: isActive ? '#6A5AFF' : '#000000',
                      fontWeight: isActive ? '600' : 'normal',
                    },
                  ]}
                >
                  {route.name}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    paddingTop: 6,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    shadowColor: Colors.neutral.black,
    shadowOffset: {
      width: 0,
      height: -1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  tabIcon: {
    marginBottom: 2,
  },
  floatingButton: {
    position: 'absolute',
    top: -25, // Negative value positions it above the tab bar
    zIndex: 10, // Ensure it appears above the tab bar
  },
  circleButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.neutral.black,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  tabText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
}); 