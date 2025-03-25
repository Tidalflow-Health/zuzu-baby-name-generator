/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// Color palette for the Zuzu Baby Name Generator app
// Organized for maximum usability and cohesion with proper contrast ratios

const Colors = {
  // Primary brand colors
  primary: {
    main: '#FF5BA1', // Zuzu brand pink
    light: '#FFA1C5', // Lighter pink for gradients
    dark: '#D1487F', // Darker pink for better contrast on text/buttons
  },

  // Secondary accent colors
  secondary: {
    peach: '#F39F86', // Existing peach color
    yellow: '#F9D976', // Existing yellow color
    mint: '#A5E8D0', // Added mint accent for variety
  },

  // Background gradients (consistent across app)
  gradients: {
    background: ['#F9D976', '#F39F86'], // Yellow to peach (main app background)
    card: ['#FF5BA1', '#FFA1C5'], // Primary to light pink (name cards)
    button: ['#FF5BA1', '#D1487F'], // Primary to dark pink (interactive elements)
  },

  // Neutrals for text, backgrounds, and UI elements
  neutral: {
    white: '#FFFFFF',
    offWhite: '#F8F8F8',
    lightGray: '#EEEEEE',
    gray: '#AAAAAA',
    darkGray: '#555555',
    black: '#222222',
  },

  // Feedback colors for user interactions
  feedback: {
    success: '#5DD39E', // Green
    error: '#FF6B6B', // Red
    warning: '#FFD166', // Yellow
    info: '#5BC0DE', // Blue
  },

  // Semantic colors for specific functions
  semantic: {
    like: '#FF5BA1', // Primary pink
    dislike: '#555555', // Dark gray
    maybe: '#5BC0DE', // Info blue
  },

  // High contrast text colors for accessibility
  text: {
    onLight: '#222222', // Dark text on light backgrounds
    onDark: '#FFFFFF', // White text on dark backgrounds
    muted: '#AAAAAA', // Muted text for secondary information
    accent: '#FF5BA1', // Primary accent for important text
  }
};

export default Colors;
