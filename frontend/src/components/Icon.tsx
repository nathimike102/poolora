/**
 * components/Icon.tsx
 *
 * The app's single icon primitive (Material Community Icons). Use this instead
 * of emoji so icons render consistently, follow theme colours and stay out of
 * the screen reader unless they carry meaning on their own.
 */

import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useThemeColor, type AnyColor } from '../theme/themed';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  /** A colour or a theme colour (tk.textSec) */
  color: AnyColor;
  /** Only set when the icon conveys information not present in nearby text. */
  label?: string;
}

export function Icon({ name, size = 20, color, label }: IconProps) {
  const resolved = useThemeColor(color);
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={resolved}
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}
