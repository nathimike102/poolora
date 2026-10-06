/**
 * components/Icon3D.tsx
 *
 * Realistic 3D renders (cars, a kombi, a parcel, a shield…) used as the app's
 * main icons, in the style of Uber's and Rapido's service tiles. Line icons
 * (components/Icon) stay for small controls such as back and close.
 */

import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

import { useIsDark } from '../theme/themed';

// Studio renders made for Poolora (see assets/3d/real/README.md)
const ICONS = {
  autoRickshaw: require('../../assets/3d/real/auto_rickshaw.png'),
  automobile: require('../../assets/3d/real/automobile.png'),
  bell: require('../../assets/3d/real/bell.png'),
  briefcase: require('../../assets/3d/real/briefcase.png'),
  bus: require('../../assets/3d/real/bus.png'),
  bustsInSilhouette: require('../../assets/3d/real/busts_in_silhouette.png'),
  calendar: require('../../assets/3d/real/calendar.png'),
  gear: require('../../assets/3d/real/gear.png'),
  handshake: require('../../assets/3d/real/handshake.png'),
  herb: require('../../assets/3d/real/herb.png'),
  identificationCard: require('../../assets/3d/real/identification_card.png'),
  minibus: require('../../assets/3d/real/minibus.png'),
  moneyBag: require('../../assets/3d/real/money_bag.png'),
  motorcycle: require('../../assets/3d/real/motorcycle.png'),
  oncomingAutomobile: require('../../assets/3d/real/oncoming_automobile.png'),
  package: require('../../assets/3d/real/package.png'),
  purse: require('../../assets/3d/real/purse.png'),
  receipt: require('../../assets/3d/real/receipt.png'),
  roundPushpin: require('../../assets/3d/real/round_pushpin.png'),
  shield: require('../../assets/3d/real/shield.png'),
  speechBalloon: require('../../assets/3d/real/speech_balloon.png'),
  spiralCalendar: require('../../assets/3d/real/spiral_calendar.png'),
  sportUtilityVehicle: require('../../assets/3d/real/sport_utility_vehicle.png'),
  star: require('../../assets/3d/real/star.png'),
  telephoneReceiver: require('../../assets/3d/real/telephone_receiver.png'),
  worldMap: require('../../assets/3d/real/world_map.png'),
} as const;

// The few whose dark parts would sink into a dark card have a lighter version
const DARK: Partial<Record<keyof typeof ICONS, number>> = {
  purse: require('../../assets/3d/real/purse_dark.png'),
  telephoneReceiver: require('../../assets/3d/real/telephone_receiver_dark.png'),
};

export type Icon3DName = keyof typeof ICONS;

interface Props {
  name: Icon3DName;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

/** Decorative: the label next to it says what it is, so screen readers skip it */
export function Icon3D({ name, size = 48, style }: Props) {
  const isDarkMode = useIsDark();
  return (
    <Image
      source={(isDarkMode && DARK[name]) || ICONS[name]}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
