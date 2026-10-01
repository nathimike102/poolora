/**
 * components/RatingForm.tsx
 *
 * Rating a finished trip (UC-R06): an overall score, then optional scores
 * for behaviour, cleanliness and punctuality, quick tags, a written review
 * (public once our team approves it) and a private problem report.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '../context/AppContext';
import { Icon } from './Icon';
import { errorHandler } from '../utils/errorHandler';
import type { RatingCategory, RatingInput, RatingIssue } from '../services/ratingService';
import { REGION } from '../utils/region';

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

/** UI labels mapped to the rating tags the backend accepts */
const RATING_TAGS: { label: string; value: string }[] = [
  { label: 'On time', value: 'punctuality' },
  { label: 'Safe driving', value: 'driving' },
  { label: 'Clean car', value: 'cleanliness' },
  { label: 'Polite', value: 'politeness' },
  { label: 'Good communication', value: 'communication' },
];

const CATEGORIES: { key: RatingCategory; label: string }[] = [
  { key: 'behavior', label: 'Driver behaviour' },
  { key: 'cleanliness', label: 'Vehicle cleanliness' },
  { key: 'punctuality', label: 'Punctuality' },
];

const ISSUES: { key: RatingIssue; label: string }[] = [
  { key: 'safety', label: 'A safety problem' },
  { key: 'route', label: 'Route or timing problem' },
  { key: 'payment', label: 'Payment problem' },
];

export function StarRating({ value, onChange, size = 36, label }: { value: number; onChange: (v: number) => void; size?: number; label?: string }) {
  return (
    <View
      style={styles.starRow}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 5, now: value }}
    >
      {[1, 2, 3, 4, 5].map(s => (
        <Pressable
          key={s}
          onPress={() => onChange(s)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${label ? `${label}, ` : ''}${s} ${s === 1 ? 'star' : 'stars'}`}
        >
          <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
              fill={s <= value ? '#FFB300' : '#D1D5DB'}
            />
          </Svg>
        </Pressable>
      ))}
    </View>
  );
}

/** A plain question gets honest answers; stored as 5, 3 and 1 */
const SAFETY_ANSWERS = [
  { value: 5, label: 'Yes' },
  { value: 3, label: 'Mostly' },
  { value: 1, label: 'No' },
];

export function RatingForm({
  rateeName,
  onSubmit,
  onSkip,
}: {
  rateeName: string;
  onSubmit: (input: RatingInput) => Promise<unknown>;
  onSkip?: () => void;
}) {
  const { c } = useApp();
  const [score, setScore] = useState(0);
  const [categories, setCategories] = useState<Partial<Record<RatingCategory, number>>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [issues, setIssues] = useState<RatingIssue[]>([]);
  const [issueDetails, setIssueDetails] = useState('');
  const [safety, setSafety] = useState<number | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

  const submit = async () => {
    if (!score) return;
    setSending(true);
    setError('');
    try {
      await onSubmit({ score, categories, tags, comment, issues, issueDetails, safety });
    } catch (e) {
      setError(errorHandler.process(e).message);
      setSending(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }} accessibilityRole="header">
        How was your ride with {rateeName}?
      </Text>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <StarRating value={score} onChange={setScore} label="Overall" />
        {score > 0 && <Text style={{ fontSize: 14, color: c.textSec, marginTop: 8 }}>{RATING_LABELS[score]}</Text>}
      </View>

      {score > 0 && (
        <>
          <View style={[styles.card, styles.left, { backgroundColor: c.surface, borderColor: c.border }]}>
            {CATEGORIES.map(cat => (
              <View key={cat.key} style={styles.catRow}>
                <Text style={{ flex: 1, fontSize: 14, color: c.text }}>{cat.label}</Text>
                <StarRating
                  size={24}
                  label={cat.label}
                  value={categories[cat.key] ?? 0}
                  onChange={v => setCategories(prev => ({ ...prev, [cat.key]: v }))}
                />
              </View>
            ))}
          </View>

          <View style={styles.tags}>
            {RATING_TAGS.map(tag => {
              const selected = tags.includes(tag.value);
              return (
                <Pressable
                  key={tag.value}
                  onPress={() => setTags(prev => toggle(prev, tag.value))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  style={[styles.chip, { backgroundColor: selected ? c.primaryLight : c.surface, borderColor: selected ? c.primary : c.border }]}
                >
                  <Text style={{ fontSize: 13, color: selected ? c.primary : c.text, fontWeight: selected ? '600' : '400' }}>{tag.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={500}
            placeholder="Write a review (optional)"
            placeholderTextColor={c.textSec}
            accessibilityLabel="Review"
            style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          />
          {comment.trim() ? (
            <Text style={{ fontSize: 12, color: c.textSec }}>Reviews appear on the driver's profile after our team checks them.</Text>
          ) : null}

          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginTop: 4 }}>Did you feel safe?</Text>
          <View style={styles.tags} accessibilityRole="radiogroup">
            {SAFETY_ANSWERS.map(a => {
              const selected = safety === a.value;
              return (
                <Pressable
                  key={a.value}
                  onPress={() => {
                    setSafety(a.value);
                    // "No" is a safety report: open the box to say what happened
                    if (a.value === 1) setIssues(prev => (prev.includes('safety') ? prev : [...prev, 'safety']));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[styles.chip, { backgroundColor: selected ? c.primaryLight : c.surface, borderColor: selected ? c.primary : c.border }]}
                >
                  <Text style={{ fontSize: 13, color: selected ? c.primary : c.text, fontWeight: selected ? '600' : '400' }}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontSize: 12, color: c.textSec }}>Private: only Poolora's safety team sees this answer, never {rateeName}.</Text>

          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, marginTop: 4 }}>Anything wrong?</Text>
          {ISSUES.map(issue => {
            const checked = issues.includes(issue.key);
            return (
              <Pressable
                key={issue.key}
                onPress={() => setIssues(prev => toggle(prev, issue.key))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                style={styles.checkRow}
              >
                <Icon name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={checked ? c.primary : c.textSec} />
                <Text style={{ fontSize: 14, color: c.text }}>{issue.label}</Text>
              </Pressable>
            );
          })}
          {issues.length > 0 && (
            <>
              <TextInput
                value={issueDetails}
                onChangeText={setIssueDetails}
                multiline
                maxLength={1000}
                placeholder="What happened? Only our team sees this."
                placeholderTextColor={c.textSec}
                accessibilityLabel="What happened"
                style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
              />
              {issues.includes('safety') ? (
                <Text style={{ fontSize: 13, color: c.error }}>
                  Our safety team is alerted as soon as you submit. If you are in danger now, call {REGION.emergency.general}.
                </Text>
              ) : null}
            </>
          )}
        </>
      )}

      {error ? <Text style={{ color: c.error, textAlign: 'center' }} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Pressable
        onPress={submit}
        disabled={!score || sending}
        accessibilityRole="button"
        accessibilityState={{ disabled: !score || sending }}
        style={[styles.cta, { backgroundColor: score ? c.primary : c.border }]}
      >
        {sending ? <ActivityIndicator color={c.textOnPrimary} /> : (
          <Text style={{ fontSize: 16, fontWeight: '700', color: score ? c.textOnPrimary : c.textSec }}>Submit rating</Text>
        )}
      </Pressable>
      {onSkip ? (
        <Pressable onPress={onSkip} accessibilityRole="button" style={styles.textBtn}>
          <Text style={{ fontSize: 14, color: c.textSec }}>Skip for now</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  card: { alignItems: 'center', padding: 20, borderRadius: 20, borderWidth: 1 },
  left: { alignItems: 'stretch', gap: 6, paddingVertical: 12 },
  starRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 15 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  cta: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  textBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
