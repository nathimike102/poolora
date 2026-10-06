/**
 * components/Text.tsx
 *
 * React Native's Text and TextInput drawn in the app's font (theme/fonts).
 * Screens import these instead of react-native's, and style text as usual:
 * the fontWeight picks the matching font file. Text with its own fontFamily
 * (a monospace code, say) is left alone.
 */

import React, { createContext, forwardRef, useContext } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { appFontStyle, appFontWeight, appFontsLoaded } from '../theme/fonts';
import { useThemeColor, type AnyColor } from '../theme/themed';

/** What nested text inherits from the text around it, as in React Native */
interface Inherited {
  weight: ReturnType<typeof appFontWeight>;
  italic: boolean;
  /** The outer text set its own fontFamily, which nested text keeps */
  ownFamily: boolean;
}

const Outer = createContext<Inherited | null>(null);

function resolve(style: TextProps['style'], outer: Inherited | null): Inherited {
  const flat: TextStyle = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily || outer?.ownFamily) return { weight: 400, italic: false, ownFamily: true };
  return {
    weight: flat.fontWeight !== undefined ? appFontWeight(flat.fontWeight) : outer?.weight ?? 400,
    italic: flat.fontStyle !== undefined ? flat.fontStyle === 'italic' : outer?.italic ?? false,
    ownFamily: false,
  };
}

export const Text = forwardRef<RNText, TextProps>(function Text({ style, children, ...rest }, ref) {
  const outer = useContext(Outer);
  if (!appFontsLoaded()) {
    return <RNText ref={ref} style={style} {...rest}>{children}</RNText>;
  }
  const own = resolve(style, outer);
  return (
    <RNText ref={ref} style={own.ownFamily ? style : [style, appFontStyle(own.weight, own.italic)]} {...rest}>
      <Outer.Provider value={own}>{children}</Outer.Provider>
    </RNText>
  );
});

/** The input's own colours may be theme colours (tk), resolved here */
type ThemedInputProps = Omit<TextInputProps, 'placeholderTextColor' | 'selectionColor' | 'cursorColor'> & {
  placeholderTextColor?: AnyColor;
  selectionColor?: AnyColor;
  cursorColor?: AnyColor;
};

export const TextInput = forwardRef<RNTextInput, ThemedInputProps>(function TextInput(
  { style, placeholderTextColor, selectionColor, cursorColor, ...rest },
  ref,
) {
  const colors = {
    placeholderTextColor: useThemeColor(placeholderTextColor),
    selectionColor: useThemeColor(selectionColor),
    cursorColor: useThemeColor(cursorColor),
  };
  if (!appFontsLoaded()) return <RNTextInput ref={ref} style={style} {...colors} {...rest} />;
  const own = resolve(style, null);
  return <RNTextInput ref={ref} style={own.ownFamily ? style : [style, appFontStyle(own.weight, own.italic)]} {...colors} {...rest} />;
});

// Refs keep their react-native types: useRef<TextInput>(null) still works
export type Text = RNText;
export type TextInput = RNTextInput;
