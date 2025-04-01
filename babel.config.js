module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'], // Assuming source code is in ./src
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            // This needs to match the 'paths' in tsconfig.json
            "@/*": ["./src/*"], // Matches '@/' to './src/'
            // Add alias for root assets folder
            "@assets": ["./assets"],
            // We can likely remove the specific aliases below if '@/*' covers them
            // "@components/*": ["./src/components/*"], 
            // "@utils/*": ["./src/utils/*"],
            // "@constants/*": ["./src/constants/*"],
            // "@types/*": ["./src/types/*"],
          }
        }
      ]
    ]
  };
}; 