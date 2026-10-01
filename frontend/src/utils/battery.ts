/**
 * utils/battery.ts
 *
 * The battery level sent with each position during a ride or an SOS. When a
 * phone goes quiet, it tells the safety team whether it probably ran out
 * (near 0%) or was switched off or taken (charge left).
 */

import * as Battery from 'expo-battery';

/** 0 to 1, or undefined when the phone will not say (simulators, some tablets) */
export async function batteryLevel(): Promise<number | undefined> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return level >= 0 && level <= 1 ? level : undefined;
  } catch {
    return undefined;
  }
}
