/**
 * components/ThemedSvg.tsx
 *
 * react-native-svg shapes whose fill, stroke and stop colours may be theme
 * colours (tk). Each shape resolves its own colours, so a theme change
 * re-renders the shape, not the screen drawing it. Import from here instead of
 * react-native-svg; anything not listed is re-exported unchanged.
 */

import React from 'react';
import * as RNSvg from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

import { isThemeColor, type AnyColor } from '../theme/themed';

type Themed<P> = Omit<P, 'fill' | 'stroke' | 'color' | 'stopColor'> & {
  fill?: AnyColor;
  stroke?: AnyColor;
  color?: AnyColor;
  stopColor?: AnyColor;
};

function themed<P extends object>(Shape: React.ComponentType<P>, name: string) {
  function ThemedShape({ fill, stroke, color, stopColor, ...rest }: Themed<P>) {
    const { theme } = useUnistyles();
    const pick = (v: AnyColor | undefined) => (isThemeColor(v) ? theme.colors[v.themeColor] : v);
    const colors = Object.fromEntries(
      Object.entries({ fill: pick(fill), stroke: pick(stroke), color: pick(color), stopColor: pick(stopColor) }).filter(([, v]) => v !== undefined),
    );
    return <Shape {...(rest as P)} {...colors} />;
  }
  ThemedShape.displayName = `Themed${name}`;
  return ThemedShape;
}

const Svg = themed(RNSvg.default as unknown as React.ComponentType<RNSvg.SvgProps>, 'Svg');
export default Svg;
export const Path = themed(RNSvg.Path as unknown as React.ComponentType<RNSvg.PathProps>, 'Path');
export const Circle = themed(RNSvg.Circle as unknown as React.ComponentType<RNSvg.CircleProps>, 'Circle');
export const Rect = themed(RNSvg.Rect as unknown as React.ComponentType<RNSvg.RectProps>, 'Rect');
export const Line = themed(RNSvg.Line as unknown as React.ComponentType<RNSvg.LineProps>, 'Line');
export const Polyline = themed(RNSvg.Polyline as unknown as React.ComponentType<RNSvg.PolylineProps>, 'Polyline');
export const Stop = themed(RNSvg.Stop as unknown as React.ComponentType<RNSvg.StopProps>, 'Stop');
export const G = themed(RNSvg.G as unknown as React.ComponentType<RNSvg.GProps>, 'G');
export const Text = themed(RNSvg.Text as unknown as React.ComponentType<RNSvg.TextProps>, 'Text');
export { Defs, LinearGradient, RadialGradient } from 'react-native-svg';
