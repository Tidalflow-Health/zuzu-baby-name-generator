# Zuzu Baby Name Generator - Technical Documentation

## Table of Contents
1. [App Overview](#app-overview)
2. [Core User Flow](#core-user-flow)
3. [Component Architecture](#component-architecture)
4. [State Management](#state-management)
5. [Data Persistence](#data-persistence)
6. [API Integration](#api-integration)
7. [Potential Issues & Unsteady Areas](#potential-issues--unsteady-areas)

## App Overview

The Zuzu Baby Name Generator is a React Native application built with Expo that helps users discover and save baby name ideas. The app integrates with OpenAI to generate personalized name suggestions based on user preferences, and uses Supabase for backend data persistence.

### Key Features
- AI-powered name generation
- Tinder-like card swiping interface
- Name categorization (like, maybe, dislike)
- Session persistence
- Offline support

## Core User Flow

### 1. Home Screen (`app/home.tsx`)
- **Entry Point**: Users start at the home screen with a search bar and filters.
- **Search Parameters**: Users can set:
  - Gender preference (Boy/Girl/Any)
  - Last name (optional, expandable input)
  - Search query (traits, themes, preferences, etc.)
- **Navigation**: When users tap "Find Names", the app navigates to the Names screen with `newSearch: 'true'` parameter, initiating a fresh search.

### 2. Names Screen (`app/names.tsx`)
- **State Loading**:
  - If `newSearch: 'true'` is provided, clears previous session.
  - If no parameters but previous session exists, loads the saved session.
  - If neither parameters nor saved session, shows a placeholder prompting the user to start a search.

- **Name Generation**:
  - Calls the OpenAI API via a Vercel serverless function to generate 20 names.
  - Excludes names the user has already seen (liked, maybe, disliked).
  - Shows a loading indicator during API calls.

- **Card Interaction**:
  - Displays names as swipeable cards, one at a time.
  - Swipe right = like, left = dislike, up = maybe.
  - Button controls are also available at the bottom.
  - Each swipe:
    1. Triggers animation
    2. Saves the name with its status
    3. Updates session state
    4. Advances to the next card

- **Session Persistence**:
  - After each swipe, updates AsyncStorage with:
    - Current search parameters
    - Complete name list
    - Current index
  - This enables users to continue where they left off

### 3. Likes Screen (`app/likes.tsx`)
- Shows categorized lists of names:
  - Liked names
  - Maybe names
- Enables users to review their saved names 
- Allows users to move names between categories or delete them

## Component Architecture

### Home Screen Components
- Search input
- Gender selector
- Last name input (collapsible)
- Find Names button
- Bottom navigation

### Names Screen Components
- **Card Stack System**:
  - Top card (current) with full animation
  - Next card (partially visible)
  - Placeholder for no search, empty state, or all cards viewed
- **Interaction Controls**:
  - Swipe gestures
  - Like/Maybe/Dislike buttons
  - Refresh button
- **Animation System**:
  - Position animations for card movement
  - Button scale animations for feedback
  - Transition animations between cards

### Likes Screen Components
- Tab navigation for liked/maybe
- List items with name details
- Action buttons

## State Management

### Local Component State
- **Home Screen**:
  - Search parameters (lastName, gender, searchQuery)
  - UI states (showLastNameInput)

- **Names Screen**:
  - Names array (fetched from AI)
  - Current index (position in the stack)
  - Loading states
  - Error states
  - Animation values

### Custom Hooks
- **useNameStatus** (`hooks/useNameStatus.ts`):
  - Manages liked, maybe, disliked name lists
  - Handles persistence to AsyncStorage
  - Syncs with Supabase when online

- **useAINames** (`hooks/useAINames.ts`):
  - Handles AI name generation
  - Manages loading and error states
  - Excludes already-seen names

- **useNames** (`hooks/useNames.ts`):
  - Manages interaction with Supabase database
  - Handles CRUD operations for name records
  - Provides offline queue functionality

## Data Persistence

### Local Storage (AsyncStorage)
- **Name Lists**:
  - `zuzu_liked_names`: Array of liked names
  - `zuzu_maybe_names`: Array of maybe names
  - `zuzu_disliked_names`: Array of disliked names

- **Search Session**:
  - `zuzu_current_search`: Current search parameters
  - `zuzu_current_names`: Current list of names being shown
  - `zuzu_current_index`: Current position in the name list

- **Offline Queue**:
  - `zuzu_pending_operations`: Queue of operations to sync when online

### Backend Storage (Supabase)
- **name_records table**:
  - Stores user's name preferences
  - Row-level security ensures data privacy
  - Syncs when user is online

## API Integration

### OpenAI Integration
- Uses a Vercel serverless function as proxy
- Generates baby names based on user criteria
- Personalized results with metadata (origin, meaning)

### Supabase Integration
- Anonymous authentication
- Name record CRUD operations
- Background synchronization

## Potential Issues & Unsteady Areas

### 1. API Dependency
- **Issue**: The app relies heavily on the OpenAI API for name generation.
- **Symptoms**: API errors, slow response times, or rate limiting can disrupt the core functionality.
- **Mitigation**: The app has error handling but lacks a robust fallback mechanism for prolonged API outages.

### 2. Race Conditions in Name Processing
- **Issue**: Concurrent operations during swiping can lead to race conditions.
- **Where**: In the `swipeRight`, `swipeLeft`, and `swipeUp` functions.
- **Symptoms**: Cards sometimes get stuck or names aren't saved properly if swiped too quickly.
- **Root Cause**: Async operations completing out of order.

### 3. Session Management Complexity
- **Issue**: The app uses a complex system to manage session state across multiple screens.
- **Where**: Multiple hooks and AsyncStorage keys track current state.
- **Risk**: This complexity makes it difficult to track the source of intermittent bugs.

### 4. Gesture Handling Edge Cases
- **Issue**: The PanResponder implementation doesn't always handle edge cases cleanly.
- **Symptoms**: Occasionally, gestures may not register, or animations may not complete smoothly.
- **Affected Code**: `onStartShouldSetPanResponder` and `onPanResponderRelease` in Names screen.

### 5. Redundant API Calls
- **Issue**: The logs show multiple consecutive AI name generation calls.
- **Symptoms**: Unnecessary API usage and potential rate limiting.
- **Root Cause**: Multiple component rerenders or effect dependencies triggering unnecessarily.

### 6. Inconsistent Asynchronous Error Handling
- **Issue**: Error handling for async operations varies across the codebase.
- **Where**: Some functions use try/catch blocks, others use `.catch()`, and some don't handle errors at all.
- **Risk**: Unhandled promise rejections could cause the app to behave unpredictably.

### 7. State Preservation During Navigation
- **Issue**: State is sometimes lost when navigating between screens.
- **Where**: The app attempts to preserve state via params and AsyncStorage, but this approach can lead to inconsistencies.
- **Symptoms**: Users may lose progress or see outdated information after navigation.

### 8. Excessive Rerendering
- **Issue**: From the logs, there appears to be excessive rerendering and duplicate operations.
- **Symptoms**: Multiple "Generated 20 names using AI" logs in rapid succession suggest redundant rendering cycles.
- **Performance Impact**: Battery drain, slower UI, and potential flickering.

### 9. Complex Session Restoration Logic
- **Issue**: The session restoration logic in `loadSavedSession` has multiple branches and conditions.
- **Risk**: This complexity makes it prone to bugs and edge cases that are difficult to test.
- **Impact**: Users might encounter unexpected behavior when returning to the app.

### 10. Memory Management
- **Issue**: Large arrays of names are stored in multiple places (state, refs, AsyncStorage).
- **Risk**: Potential memory issues on low-end devices, especially with many saved names.
- **Suggestions**: Implement pagination or virtualization for large lists.

## Recommended Improvements

1. **Implement a robust error recovery system** for API failures
2. **Refactor the swiping logic** to use a state machine approach for better predictability
3. **Simplify session management** by consolidating the storage approach
4. **Add comprehensive logging** for easier debugging
5. **Optimize render cycles** to reduce unnecessary API calls and rerenders
6. **Standardize async error handling** across the codebase
7. **Implement proper offline-first architecture** for better resilience
8. **Add automated tests** for critical user flows and edge cases 