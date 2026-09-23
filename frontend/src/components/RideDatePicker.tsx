/**
 * components/RideDatePicker.tsx
 *
 * Bottom-sheet date picker with calendar grid and quick-pick chips.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  Modal,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Typography, Spacing, Radius } from '../theme';

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate()     === b.getDate()  &&
    a.getMonth()    === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Split a flat array into rows of `size` */
function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    rows.push(arr.slice(i, i + size));
  }
  return rows;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RideDatePickerProps {
  visible: boolean;
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  day: number | null;
  date: Date | null;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  isSunday: boolean;
  isSaturday: boolean;
  onPress: () => void;
  primaryColor: string;
  primaryLight: string;
  errorColor: string;
  borderColor: string;
  textColor: string;
  testID?: string;
}

function DayCell({
  day, isToday, isSelected, isDisabled, isSunday, isSaturday,
  onPress, primaryColor, primaryLight, errorColor, borderColor, textColor, testID,
}: DayCellProps) {
  const scale = useRef(new Animated.Value(1)).current;
  if (!day) return <View style={styles.dayCellEmpty} />;

  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  };

  const cellBg = isSelected ? primaryColor : isToday ? primaryLight : 'transparent';
  const cellColor = isSelected
    ? '#FFFFFF'
    : isDisabled
    ? borderColor
    : isToday
    ? primaryColor
    : isSunday
    ? errorColor
    : isSaturday
    ? '#6B7280'
    : textColor;

  return (
    <Animated.View style={[styles.dayCellWrapper, { transform: [{ scale }] }]}>
      <TouchableOpacity accessibilityRole="button"
        testID={testID}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}
        style={[
          styles.dayCell,
          { backgroundColor: cellBg },
          isToday && !isSelected && {
            borderWidth: 1.5,
            borderColor: primaryColor,
          },
        ]}
      >
        <Text
          style={[
            styles.dayCellText,
            { color: cellColor },
            (isSelected || isToday) && styles.dayCellTextBold,
          ]}
        >
          {day}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Quick-pick chip ──────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  primaryColor: string;
  primaryLight: string;
  borderColor: string;
  bgColor: string;
  textSecColor: string;
}

function QuickChip({
  label, isSelected, onPress,
  primaryColor, primaryLight, borderColor, bgColor, textSecColor,
}: ChipProps) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity accessibilityRole="button"
        testID={`quick-chip-${label}`}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }).start()}
        activeOpacity={1}
        style={[
          styles.chip,
          {
            borderColor: isSelected ? primaryColor : borderColor,
            backgroundColor: isSelected ? primaryLight : bgColor,
          },
        ]}
      >
        <Text style={[styles.chipLabel, { color: isSelected ? primaryColor : textSecColor }]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RideDatePicker({
  visible,
  selectedDate,
  onSelect,
  onClose,
}: RideDatePickerProps) {
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const today = startOfDay(new Date());
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 60);

  const [viewYear, setViewYear] = React.useState(
    selectedDate ? selectedDate.getFullYear() : today.getFullYear(),
  );
  const [viewMonth, setViewMonth] = React.useState(
    selectedDate ? selectedDate.getMonth() : today.getMonth(),
  );

  // ── Slide animation ────────────────────────────────────────────────────────
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 28,
        stiffness: 320,
      }).start();
    }
  }, [visible, slideY]);

  const handleClose = useCallback(() => {
    Animated.spring(slideY, {
      toValue: SCREEN_H,
      useNativeDriver: true,
      damping: 28,
      stiffness: 320,
    }).start(() => {
      slideY.setValue(SCREEN_H);
      onClose();
    });
  }, [slideY, onClose]);

  // ── Month navigation ───────────────────────────────────────────────────────
  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  const prevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows = chunk(cells, 7);

  const handleDay = (day: number | null) => {
    if (!day) return;
    const d = new Date(viewYear, viewMonth, day);
    if (d < today || d > maxDate) return;
    onSelect(d);
    handleClose();
  };

  const formatHeader = (date: Date): string => {
    const diff = Math.round((startOfDay(date).getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // Quick-pick offsets
  const quickDates = [0, 1, 2, 3, 6, 7].map(offset => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    return {
      date: d,
      label:
        offset === 0 ? 'Today' :
        offset === 1 ? 'Tomorrow' :
        d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
    };
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <TouchableOpacity accessibilityRole="button"
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      />

      {/* Bottom sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: c.surface, paddingBottom: Spacing['2xl'] + insets.bottom },
          { transform: [{ translateY: slideY }] },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <View>
              <Text style={[styles.title, { color: c.text }]}>Select Date</Text>
              {selectedDate && (
                <Text style={[styles.selectedLabel, { color: c.primary }]}>
                  {formatHeader(selectedDate)}
                </Text>
              )}
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close date picker"
              onPress={handleClose}
              style={[styles.closeBtn, { backgroundColor: c.bg }]}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill={c.textSec}>
                <Path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous month"
              testID="prev-month"
              onPress={prevMonth}
              disabled={!canGoPrev}
              style={[
                styles.monthNavBtn,
                { backgroundColor: canGoPrev ? c.primaryLight : c.surfaceVariant },
                !canGoPrev && styles.monthNavBtnDisabled,
              ]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24"
                fill={canGoPrev ? c.primary : c.textSec}
              >
                <Path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
              </Svg>
            </TouchableOpacity>

            <Text style={[styles.monthLabel, { color: c.text }]}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>

            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next month"
              testID="next-month"
              onPress={nextMonth}
              style={[styles.monthNavBtn, { backgroundColor: c.primaryLight }]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill={c.primary}>
                <Path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeaderRow}>
            {DAYS.map(d => (
              <Text key={d} style={[styles.dayHeader, { color: c.textSec }]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.calendarGrid}>
            {rows.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.calendarRow}>
                {row.map((day, colIdx) => {
                  const cellDate = day ? new Date(viewYear, viewMonth, day) : null;
                  const isToday   = cellDate ? isSameDay(cellDate, today)   : false;
                  const isSelected = cellDate && selectedDate ? isSameDay(cellDate, selectedDate) : false;
                  const isPast     = cellDate ? cellDate < today    : false;
                  const isFuture   = cellDate ? cellDate > maxDate  : false;
                  const isDisabled = isPast || isFuture;
                  const isSunday   = cellDate ? cellDate.getDay() === 0 : false;
                  const isSaturday = cellDate ? cellDate.getDay() === 6 : false;

                  return (
                    <DayCell
                      key={colIdx}
                      day={day}
                      date={cellDate}
                      isToday={isToday}
                      isSelected={isSelected}
                      isDisabled={isDisabled}
                      isSunday={isSunday}
                      isSaturday={isSaturday}
                      onPress={() => handleDay(day)}
                      testID={`day-${day}`}
                      primaryColor={c.primary}
                      primaryLight={c.primaryLight}
                      errorColor={c.error}
                      borderColor={c.border}
                      textColor={c.text}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          {/* Quick-pick chips */}
          <View style={styles.chipsRow}>
            {quickDates.map(({ date, label }) => (
              <QuickChip
                key={label}
                label={label}
                isSelected={selectedDate ? isSameDay(date, selectedDate) : false}
                onPress={() => { onSelect(date); handleClose(); }}
                primaryColor={c.primary}
                primaryLight={c.primaryLight}
                borderColor={c.border}
                bgColor={c.bg}
                textSecColor={c.textSec}
              />
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: Radius['4xl'],
    borderTopRightRadius: Radius['4xl'],
    paddingBottom: Spacing['2xl'],
    maxHeight: '90%',
  },

  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },

  // Title
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 10,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography['3xl'],
    fontWeight: Typography.extrabold,
  },
  selectedLabel: {
    fontSize: Typography.base,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Month navigation
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavBtnDisabled: {
    opacity: 0.4,
  },
  monthLabel: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
  },

  // Day headers
  dayHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginBottom: 6,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    paddingVertical: 4,
  },

  // Calendar grid
  calendarGrid: {
    paddingHorizontal: Spacing.md,
    gap: 2,
  },
  calendarRow: {
    flexDirection: 'row',
  },

  // Day cell
  dayCellWrapper: {
    flex: 1,
  },
  dayCellEmpty: {
    flex: 1,
    height: 40,
  },
  dayCell: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 1,
  },
  dayCellText: {
    fontSize: Typography.md,
    fontWeight: Typography.medium,
  },
  dayCellTextBold: {
    fontWeight: Typography.extrabold,
  },

  // Quick-pick chips
  chipsRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  chipLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
});
