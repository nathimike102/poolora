/**
 * components/OptionsSheet.tsx
 *
 * A short list of actions that slides up from the bottom, in the app's colours.
 * Replaces Alert.alert used as a menu, which Android draws as a plain grey
 * dialog that ignores the dark theme.
 */

import React from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from './Icon';
import { tc, tk } from '../theme/themed';

export interface SheetOption {
  label: string;
  icon?: IconName;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: SheetOption[];
  closeLabel: string;
  onClose: () => void;
}

export function OptionsSheet({ visible, title, subtitle, options, closeLabel, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={closeLabel} accessibilityRole="button" />
      <View style={[
        styles.sheet,
        { paddingBottom: insets.bottom + 12 },
        tc.backgroundColor_surface,
        tc.borderColor_border
      ]}>
        <View style={[styles.handle, tc.backgroundColor_border]} />
        <Text style={[styles.title, tc.color_text]} accessibilityRole="header" numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, tc.color_textSec]}>{subtitle}</Text> : null}
        {options.map((o) => (
          <Pressable
            key={o.label}
            onPress={() => {
              onClose();
              o.onPress();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.option,
              tc.borderTopColor_border,
              pressed ? tc.backgroundColor_surfaceVariant : {
                backgroundColor: 'transparent'
              }
            ]}
          >
            {o.icon ? <Icon name={o.icon} size={20} color={tk.primary} /> : null}
            <Text style={[styles.optionText, tc.color_text]}>{o.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} accessibilityRole="button" style={[styles.close, tc.backgroundColor_surfaceVariant]}>
          <Text style={[styles.closeText, tc.color_text]}>{closeLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 20, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 2, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4 },
  optionText: { fontSize: 16, fontWeight: '600' },
  close: { marginTop: 12, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 16, fontWeight: '700' },
});
