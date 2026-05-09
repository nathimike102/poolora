/**
 * components/BackButton.tsx
 *
 * Reusable back-navigation button.
 */

import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Shadow } from '../theme';
import { useApp } from '../context/AppContext';

interface BackButtonProps {
  onPress?: () => void;
}

export function BackButton({ onPress }: BackButtonProps) {
  const navigation = useNavigation();
  const { c } = useApp();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.goBack();
    }
  };

  return (
    <TouchableOpacity
      testID="back-button"
      onPress={handlePress}
      style={[
        styles.button,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
        },
        Shadow.sm,
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MaterialCommunityIcons
        name="arrow-left"
        size={22}
        color={c.text}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
