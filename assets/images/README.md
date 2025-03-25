# App Images

This directory contains all the images used in the Zuzu Baby Name Generator app.

## Usage

- Place your `ZuzuLogo.png` file in this folder
- Use the logo in your app by importing it like this:

```js
import { Image } from 'react-native';

// In your component
<Image source={require('../../assets/images/ZuzuLogo.png')} style={styles.logo} />
```

## Image Guidelines

- Use PNG format for logos and icons with transparency
- Use appropriate naming conventions (e.g., logo-small.png, logo-large.png)
- Consider providing @2x and @3x versions for different screen densities 