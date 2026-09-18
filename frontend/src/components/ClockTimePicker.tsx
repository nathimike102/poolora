/**
 * components/ClockTimePicker.tsx
 *
 * Material-style analog clock time picker.
 * - Tap/drag on the clock face to select hour, then minute.
 * - After releasing the hour selection the picker auto-advances to minute mode.
 * - Tapping the HH or MM digit in the header also switches modes.
 * - AM / PM chips toggle the period.
 * - CANCEL dismisses without change; OK calls onConfirm with "HH:mm" (24-h).
 *
 * Dependencies already in the project:
 *   react-native-svg  ·  ../context/AppContext  ·  ../theme
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { Typography, Spacing, Radius, Shadow } from '../theme';

// ── Clock geometry ────────────────────────────────────────────────────────────

const CLOCK_SIZE   = 260;
const CENTER       = CLOCK_SIZE / 2;   // 130
const FACE_RADIUS  = 112;              // outer edge of the clock face circle
const HAND_RADIUS  = 84;              // where numbers sit & hand tip lands
const SEL_RADIUS   = 18;              // radius of the selection highlight dot
const CENTER_DOT_R = 5;               // radius of the pivot dot

// Ordered so index i maps to angle i×30° from 12 o'clock (top, clockwise).
const HOURS   = [12,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11] as const;
const MINUTES = [ 0,  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const;

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** Clockwise angle from 12 o'clock for a touch at (touchX, touchY). */
function clockAngle(touchX: number, touchY: number): number {
  const rad = Math.atan2(touchY - CENTER, touchX - CENTER);
  return (rad * 180 / Math.PI + 90 + 360) % 360;
}

/** SVG coordinates for a point at `radius` and `angleDeg` from 12 o'clock. */
function polarXY(angleDeg: number, radius: number) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

// ── Time parsing ──────────────────────────────────────────────────────────────

function parseTime24(t: string): { hour: number; minute: number; isPm: boolean } {
  const [hStr = '9', mStr = '0'] = t.split(':');
  const h24 = Math.max(0, Math.min(23, parseInt(hStr, 10)));
  const min  = Math.max(0, Math.min(59, parseInt(mStr, 10)));
  return {
    hour:   h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24,
    minute: Math.round(min / 5) * 5 % 60,
    isPm:   h24 >= 12,
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ClockTimePickerProps {
  visible:     boolean;
  initialTime: string;                    // "HH:mm" 24-hour
  onConfirm:   (time: string) => void;    // called with "HH:mm" 24-hour
  onDismiss:   () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ClockTimePicker({
  visible,
  initialTime,
  onConfirm,
  onDismiss,
}: ClockTimePickerProps) {
  const { c } = useApp();

  const [hour,   setHour]   = useState(9);
  const [minute, setMinute] = useState(0);
  const [isPm,   setIsPm]   = useState(false);
  const [mode,   setMode]   = useState<'hours' | 'minutes'>('hours');

  // Re-initialise whenever the modal becomes visible.
  useEffect(() => {
    if (visible) {
      const p = parseTime24(initialTime);
      setHour(p.hour);
      setMinute(p.minute);
      setIsPm(p.isPm);
      setMode('hours');
    }
  }, [visible, initialTime]);

  // ── Touch gestures ──────────────────────────────────────────────────────────

  const handleTouch = useCallback((e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const idx = Math.round(clockAngle(locationX, locationY) / 30) % 12;
    if (mode === 'hours') {
      setHour(HOURS[idx]);
    } else {
      setMinute(MINUTES[idx]);
    }
  }, [mode]);

  // Auto-advance from hour to minute selection on finger lift.
  const handleRelease = useCallback(() => {
    if (mode === 'hours') setMode('minutes');
  }, [mode]);

  // ── Confirm ─────────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    let h24 = hour;
    if (isPm  && hour !== 12) h24 = hour + 12;
    if (!isPm && hour === 12) h24 = 0;
    onConfirm(
      `${h24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    );
  }, [hour, minute, isPm, onConfirm]);

  // ── Derived clock geometry ──────────────────────────────────────────────────

  const handAngle = mode === 'hours'
    ? (HOURS as readonly number[]).indexOf(hour) * 30
    : (minute / 5) * 30;
  const handTip = polarXY(handAngle, HAND_RADIUS);

  const displayH = hour.toString().padStart(2, '0');
  const displayM = minute.toString().padStart(2, '0');

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: c.surface }, Shadow.lg]}>

          {/* ── Header ──────────────────────────────────────────────── */}
          <View style={[styles.header, { backgroundColor: c.primary }]}>
            <Text style={styles.headerLabel}>SELECT TIME</Text>

            <View style={styles.timeRow}>
              {/* Hour — tap to switch to hour-selection mode */}
              <TouchableOpacity accessibilityRole="button" testID="hour-btn" onPress={() => setMode('hours')}>
                <Text style={[
                  styles.timeDigit,
                  mode === 'hours' ? styles.digitActive : styles.digitDim,
                ]}>
                  {displayH}
                </Text>
              </TouchableOpacity>

              <Text style={styles.colon}>:</Text>

              {/* Minute — tap to switch to minute-selection mode */}
              <TouchableOpacity accessibilityRole="button" testID="minute-btn" onPress={() => setMode('minutes')}>
                <Text style={[
                  styles.timeDigit,
                  mode === 'minutes' ? styles.digitActive : styles.digitDim,
                ]}>
                  {displayM}
                </Text>
              </TouchableOpacity>

              {/* AM / PM */}
              <View style={styles.amPmCol}>
                <TouchableOpacity accessibilityRole="button"
                  testID="am-chip"
                  onPress={() => setIsPm(false)}
                  style={[styles.amPmChip, !isPm && styles.amPmChipActive]}
                >
                  <Text style={styles.amPmText}>AM</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button"
                  testID="pm-chip"
                  onPress={() => setIsPm(true)}
                  style={[styles.amPmChip, isPm && styles.amPmChipActive]}
                >
                  <Text style={styles.amPmText}>PM</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Clock face ──────────────────────────────────────────── */}
          <View style={styles.clockWrap}>
            {/* SVG renders the visual clock — touch is handled by the overlay below */}
            <Svg width={CLOCK_SIZE} height={CLOCK_SIZE}>
              {/* Background circle */}
              <Circle cx={CENTER} cy={CENTER} r={FACE_RADIUS} fill={c.surfaceVariant} />

              {/* Hand */}
              <Line
                x1={CENTER} y1={CENTER}
                x2={handTip.x} y2={handTip.y}
                stroke={c.primary} strokeWidth={2.5} strokeLinecap="round"
              />

              {/* Centre pivot dot (drawn after the hand so it sits on top) */}
              <Circle cx={CENTER} cy={CENTER} r={CENTER_DOT_R} fill={c.primary} />

              {/* Selection highlight at the hand tip */}
              <Circle cx={handTip.x} cy={handTip.y} r={SEL_RADIUS} fill={c.primary} />

              {/* Number labels */}
              {mode === 'hours'
                ? HOURS.map((h, i) => {
                    const { x, y } = polarXY(i * 30, HAND_RADIUS);
                    return (
                      <SvgText
                        key={h}
                        x={x} y={y + 5}
                        textAnchor="middle"
                        fontSize={13}
                        fontWeight={h === hour ? '700' : '500'}
                        fill={h === hour ? '#ffffff' : c.text}
                      >
                        {h}
                      </SvgText>
                    );
                  })
                : MINUTES.map((m, i) => {
                    const { x, y } = polarXY(i * 30, HAND_RADIUS);
                    return (
                      <SvgText
                        key={m}
                        x={x} y={y + 5}
                        textAnchor="middle"
                        fontSize={12}
                        fontWeight={m === minute ? '700' : '500'}
                        fill={m === minute ? '#ffffff' : c.text}
                      >
                        {m.toString().padStart(2, '0')}
                      </SvgText>
                    );
                  })
              }
            </Svg>

            {/*
              Transparent touch overlay — sits on top of the SVG and intercepts
              all gesture events. locationX/Y are relative to this View which is
              exactly CLOCK_SIZE × CLOCK_SIZE, matching the SVG coordinate space.
            */}
            <View
              testID="clock-touch-overlay"
              style={StyleSheet.absoluteFill}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={handleTouch}
              onResponderMove={handleTouch}
              onResponderRelease={handleRelease}
            />
          </View>

          {/* ── Mode hint ────────────────────────────────────────────── */}
          <Text style={[styles.modeHint, { color: c.textSec }]}>
            {mode === 'hours' ? 'Select hour' : 'Select minute'}
          </Text>

          {/* ── Action buttons ───────────────────────────────────────── */}
          <View style={[styles.actions, { borderTopColor: c.border }]}>
            <TouchableOpacity accessibilityRole="button"
              style={styles.actionBtn}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, { color: c.textSec }]}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
              testID="confirm-btn"
              style={styles.actionBtn}
              onPress={handleConfirm}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnText, { color: c.primary, fontWeight: Typography.bold }]}>
                OK
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  dialog: {
    width: 320,
    borderRadius: Radius['3xl'],
    overflow: 'hidden',
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeDigit: {
    fontSize: 54,
    lineHeight: 62,
    fontWeight: Typography.bold,
  },
  digitActive: {
    color: '#ffffff',
  },
  digitDim: {
    color: 'rgba(255,255,255,0.45)',
  },
  colon: {
    fontSize: 50,
    fontWeight: Typography.bold,
    color: 'rgba(255,255,255,0.6)',
    marginHorizontal: 2,
    marginBottom: 4,
  },
  amPmCol: {
    marginLeft: Spacing.lg,
    gap: Spacing.xs,
  },
  amPmChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  amPmChipActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  amPmText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: 'rgba(255,255,255,0.85)',
  },

  // ── Clock ────────────────────────────────────────────────────────
  clockWrap: {
    alignSelf: 'center',
    width: CLOCK_SIZE,
    height: CLOCK_SIZE,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },

  // ── Hint & actions ───────────────────────────────────────────────
  modeHint: {
    textAlign: 'center',
    fontSize: Typography.sm,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  btnText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    letterSpacing: 0.5,
  },
});
