# Zuzu Baby Name Generator

A beautiful React Native app for discovering and saving baby names.

## Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/zuzu-baby-name-generator.git
cd zuzu-baby-name-generator
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```
Then edit `.env` with your actual values:
- Get Supabase credentials from your Supabase project settings
- Get Superwall API keys from your Superwall dashboard
- Add your OpenAI API key for name generation
- Update Expo project ID if needed

4. Start the development server
```bash
npx expo start
```

A mobile application to help parents discover, search, and save baby names. Built with React Native and Expo, the app includes offline support and features a clean, modern UI.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Directory Structure](#directory-structure)
- [Tech Stack](#tech-stack)
- [Authentication System](#authentication-system)
- [Data Management](#data-management)
- [Network Handling](#network-handling)
- [UI Components](#ui-components)
- [Navigation](#navigation)
- [Development & Testing](#development--testing)
- [Known Issues & Troubleshooting](#known-issues--troubleshooting)
- [Environment Configuration](#environment-configuration)
- [Future Enhancements](#future-enhancements)

## Overview

Zuzu Baby Name Generator allows users to:
- Browse and search baby names
- View name meanings and origins
- Save names to different categories (liked, maybe, disliked)
- Continue using the app offline with automatic syncing when back online
- See personalized name suggestions

## Architecture

The app follows a modern React Native architecture:

### Core Architectural Components

1. **Expo Framework** - Used for easy development and deployment
2. **React Context API** - For state management
3. **Supabase** - Backend-as-a-service for database and authentication
4. **Expo Router** - For application navigation
5. **AsyncStorage** - For local data persistence
6. **Custom Network Utilities** - For handling offline operations

### Key Design Patterns

- **Provider Pattern** - Used for authentication and data management contexts
- **Custom Hooks** - For reusable business logic
- **Offline-First Approach** - Data is stored locally and synced when online

## Features

### Authentication

- Anonymous authentication via Supabase
- Offline authentication fallback
- Session persistence

### Name Management

- Fetch names from database
- Save names to categories (liked, maybe, disliked)
- Offline name creation and categorization
- Sync operations when back online

### Offline Support

- Full functionality when offline
- Local caching of names
- Queuing operations for syncing when online
- Network status detection and management

### Debugging & Testing

- Built-in test screen for integration testing
- Network status toggle for testing offline mode
- Cache clearing functionality

## Directory Structure

The app follows this structure:

```
.
├── assets/                 # Images, fonts, and other static assets
├── src/
│   ├── components/         # Reusable UI components
│   ├── screens/            # Screen components
│   ├── navigation/         # Navigation configuration
│   ├── hooks/              # Custom hooks
│   └── utils/              # Utility functions and helpers
├── App.js                  # Main app entry point
└── app.json                # Expo configuration
```

## Tech Stack

- **React Native** - Mobile application framework
- **Expo** - Development platform
- **TypeScript** - Type-safe JavaScript
- **Supabase** - Backend service
- **React Navigation** - Navigation library
- **AsyncStorage** - Local storage solution
- **Expo Linear Gradient** - For UI styling
- **Expo Safe Area Context** - For safe area handling

## Authentication System

Authentication is managed via the `AuthContext` which provides:

### `AuthProvider` Component

The core authentication provider wraps the app and provides:

```typescript
type AuthContextType = {
  session: Session | null;      // Current user session
  isLoading: boolean;           // Loading state
  isOnline: boolean;            // Network connectivity status
  signIn: () => Promise<void>;  // Sign in method
  signOut: () => Promise<void>; // Sign out method
  checkNetworkStatus: () => Promise<boolean>; // Network checker
};
```

### Authentication Flow

1. **Anonymous Authentication**:
   - Users are automatically signed in anonymously via Supabase
   - Anonymous ID is stored in AsyncStorage for persistence
   - If online, authentication happens through Supabase
   - If offline, a "fake" offline session is created

2. **Offline Authentication**:
   - If the app can't connect to Supabase, it creates a local offline session
   - The offline session uses a stored anonymous ID or generates a new one
   - All app features continue to work in offline mode

3. **Authentication State Management**:
   - Session state is tracked in the AuthContext
   - Network status is monitored for online/offline state
   - Retry mechanisms are implemented for connection failures

## Data Management

### Name Data Structure

```typescript
type NameRecord = {
  id: string;
  user_id: string;
  name: string;
  last_name: string | null;
  meaning: string;
  origin: string;
  status: 'liked' | 'maybe' | 'disliked';
  search_context: Record<string, any>;
  created_at: string;
};
```

### Data Flow

1. **Data Fetching**:
   - Names are fetched from Supabase when online
   - Cached names are used when offline
   - Fetching logic is in the `useNames` hook

2. **Data Modification**:
   - New names created locally
   - Status updates (like/dislike/maybe) are saved
   - Operations queue up when offline
   - Synced with backend when online

3. **Caching Strategy**:
   - Names cached in AsyncStorage
   - Pending operations stored in AsyncStorage
   - Cached data used when offline

## Network Handling

### Network Status Detection

- Custom `checkConnectivity` function tests real connectivity
- Network status is cached to prevent excessive checks
- Exponential backoff for retrying network operations

### Offline Mode Handling

1. **Automatic Detection**:
   - App detects when device goes offline
   - Falls back to cached data and offline mode

2. **Manual Testing**:
   - Debug flag to force offline mode
   - Test screen to toggle offline state

3. **Operation Queueing**:
   - Operations stored in a queue when offline
   - Queue synced when device comes back online
   - Conflict resolution for synced operations

### Retry Mechanism

- Built-in retry with exponential backoff
- Configurable retry count and delay
- Proper error handling for different types of errors

## UI Components

### Screens

- **Home Screen** - Main dashboard
- **Names Screen** - Browse and search names
- **Likes Screen** - View saved/liked names
- **Test Screen** - For testing app functionality

### Core Components

- **Name Card** - Displays name information
- **Status Buttons** - For liking/disliking names
- **Network Status Indicator** - Shows online/offline status

### Styling

- Uses a custom theme with consistent colors
- Linear gradients for backgrounds
- Safe area handling for different devices

## Navigation

- Uses Expo Router for navigation
- Tab-based navigation for main screens
- Stack navigation for detailed views

## Development & Testing

### Development Environment

- Expo development server
- React Native development tools
- AsyncStorage for data persistence

### Testing Utilities

The app includes a dedicated test screen (`app/test.tsx`) that provides:

- Authentication status check
- Network connectivity testing
- Force offline mode toggle
- Cache clearing
- Database connection testing
- Pending operations management

## Known Issues & Troubleshooting

### Supabase Connection Issues

The app has faced several challenges with Supabase:

1. **Anonymous Authentication Issues**:
   - Error: "Anonymous sign-ins are disabled"
   - This is a Supabase configuration issue - anonymous auth needs to be enabled in the Supabase dashboard
   - Workaround: We've implemented a robust offline mode that creates fake sessions

2. **Network Request Failures**:
   - Intermittent "Network request failed" errors
   - Added retry logic with exponential backoff
   - Implemented better error handling

3. **Timeout Issues**:
   - Some operations would time out
   - Added custom timeout handling with AbortController
   - Set reasonable timeouts for operations

4. **CORS Issues**:
   - CORS restrictions in development environment
   - Added proper headers in the app.json configuration

5. **Row-Level Security (RLS) Policy Errors**:
   - Error: "new row violates row-level security policy for table 'name_records'"
   - This happens when trying to insert data but the RLS policy is preventing it
   - Solution: Configure proper RLS policies in Supabase dashboard:
     1. Go to Authentication > Policies
     2. For the `name_records` table, add a policy that allows authenticated users to insert/update/delete their own records
     3. Example policy for INSERT: `(auth.uid() = user_id)`
     4. Example policy for SELECT: `(auth.uid() = user_id)`
   - Alternatively, you can temporarily disable RLS for testing (not recommended for production)

### Offline Mode Challenges

1. **Synchronization Conflicts**:
   - Handling conflicts when operations performed offline are synced
   - Solution: Queue-based system with timestamps

2. **Session Management**:
   - Maintaining authentication state offline
   - Solution: Local anonymous ID storage and fake session creation

## Environment Configuration

### Environment Variables

The app uses environment variables for configuration:

```
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App Configuration
EXPO_PUBLIC_ENV=development
```

### Debug Configuration

Runtime debugging flags available in `utils/appConfig.ts`:

```typescript
export const DEBUG_CONFIG = {
  FORCE_OFFLINE_MODE: false,
  LOG_NETWORK_REQUESTS: true,
  NETWORK_TIMEOUT: 10000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
};
```

## Setting Up the Project

1. **Clone the repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
Create a `.env` file with the necessary variables

4. **Start the development server**
   ```bash
    npx expo start
   ```

5. **Enable Anonymous Auth in Supabase**
   - Go to Authentication > Settings > Auth Providers
   - Enable "Anonymous Sign-In"

## Future Enhancements

1. **User Accounts**:
   - Email/password authentication
   - Profile customization

2. **Advanced Name Search**:
   - Filter by origin, meaning, etc.
   - Phonetic matching

3. **Name Sharing**:
   - Share liked names with partners
   - Export name lists

4. **Improved Offline Support**:
   - Better conflict resolution
   - Background syncing

5. **AI Name Suggestions**:
   - Based on user preferences
   - Similar names recommendations

## Contribution

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.
