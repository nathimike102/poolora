/**
 * components/BackButton.tsx
 *
 * Reusable back-navigation button: a plain arrow, as on Uber. `floating`
 * gives it a raised round backing for when it sits over a map.
 */

import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from './Icon';
import { Shadow } from '../theme';
import { useTranslation } from 'react-i18next';
import { tc, tk } from '../theme/themed';

interface BackButtonProps {
  onPress?: () => void;
  floating?: boolean;
}

export function BackButton({ onPress, floating }: BackButtonProps) {
  const navigation = useNavigation();
  const { t } = useTranslation();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.goBack();
    }
  };

  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('backButton.goBack')}
      testID="back-button"
      onPress={handlePress}
      style={floating ? [styles.button, tc.backgroundColor_surface, Shadow.md] : styles.button}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon
        name="arrow-left"
        size={26}
        color={tk.text}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
