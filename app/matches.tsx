import React from 'react';
import { View, Text } from 'react-native';
import styles from '@/styles/styles';
import Colors from '@/constants/Colors';

const Matches = () => {
  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: Colors.neutral.white }]}>
        <Text style={styles.headerTitle}>Matches</Text>
      </View>
    </View>
  );
};

export default Matches; 