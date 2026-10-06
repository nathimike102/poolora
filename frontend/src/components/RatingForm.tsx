/**
 * components/RatingForm.tsx
 *
 * Rating a finished trip (UC-R06): an overall score, then optional scores
 * for behaviour, cleanliness and punctuality, quick tags, a written review
 * (public once our team approves it) and a private problem report.
 */

import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { ActivityIndicator } from './Themed';
import { Text, TextInput } from './Text';
import Svg, { Path } from './ThemedSvg';

import { Icon } from './Icon';
import { errorHandler } from '../utils/errorHandler';
import type { RatingCategory, RatingInput, RatingIssue } from '../services/ratingService';
import { REGION } from '../utils/region';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { tc, tk } from '../theme/themed';

/** Words for 1 to 5 stars are in the catalogue under ratingForm.levels */

/** UI labels mapped to the rating tags the backend accepts */
const RATING_TAGS: { label: string; value: string }[] = [
  { get label() { return i18n.t('ratingForm.tags.punctuality'); }, value: 'punctuality' },
  { get label() { return i18n.t('ratingForm.tags.driving'); }, value: 'driving' },
  { get label() { return i18n.t('ratingForm.tags.cleanliness'); }, value: 'cleanliness' },
  { get label() { return i18n.t('ratingForm.tags.politeness'); }, value: 'politeness' },
  { get label() { return i18n.t('ratingForm.tags.communication'); }, value: 'communication' },
];

const CATEGORIES: { key: RatingCategory; label: string }[] = [
  { key: 'behavior', get label() { return i18n.t('ratingForm.categories.behavior'); } },
  { key: 'cleanliness', get label() { return i18n.t('ratingForm.categories.cleanliness'); } },
  { key: 'punctuality', get label() { return i18n.t('ratingForm.categories.punctuality'); } },
];

const ISSUES: { key: RatingIssue; label: string }[] = [
  { key: 'safety', get label() { return i18n.t('ratingForm.issues.safety'); } },
  { key: 'route', get label() { return i18n.t('ratingForm.issues.route'); } },
  { key: 'payment', get label() { return i18n.t('ratingForm.issues.payment'); } },
];

export function StarRating({ value, onChange, size = 36, label }: { value: number; onChange: (v: number) => void; size?: number; label?: string }) {
  const { t } = useTranslation();
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
          accessibilityLabel={s === 1 ? t('ratingForm.starOne', { prefix: label ? `${label}, ` : '' }) : t('ratingForm.starMany', { prefix: label ? `${label}, ` : '', count: s })}
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
  { value: 5, get label() { return i18n.t('ratingForm.safe.yes'); } },
  { value: 3, get label() { return i18n.t('ratingForm.safe.mostly'); } },
  { value: 1, get label() { return i18n.t('ratingForm.safe.no'); } },
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
  const { t } = useTranslation();
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
      <Text style={[{ fontSize: 20, fontWeight: '800', textAlign: 'center' }, tc.color_text]} accessibilityRole="header">
        How was your ride with {rateeName}?
      </Text>
      <View style={[styles.card, tc.backgroundColor_surface, tc.borderColor_border]}>
        <StarRating value={score} onChange={setScore} label={t('ratingForm.overall')} />
        {score > 0 && <Text style={[{ fontSize: 14, marginTop: 8 }, tc.color_textSec]}>{t(`ratingForm.levels.${score}`)}</Text>}
      </View>

      {score > 0 && (
        <>
          <View style={[
            styles.card,
            styles.left,
            tc.backgroundColor_surface,
            tc.borderColor_border
          ]}>
            {CATEGORIES.map(cat => (
              <View key={cat.key} style={styles.catRow}>
                <Text style={[{ flex: 1, fontSize: 14 }, tc.color_text]}>{cat.label}</Text>
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
                  style={[
                    styles.chip,
                    selected ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface,
                    selected ? tc.borderColor_primary : tc.borderColor_border
                  ]}
                >
                  <Text style={[{ fontSize: 13, fontWeight: selected ? '600' : '400' }, selected ? tc.color_primary : tc.color_text]}>{tag.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={500}
            placeholder={t('ratingForm.writeAReviewOptional')}
            placeholderTextColor={tk.textSec}
            accessibilityLabel={t('ratingForm.review')}
            style={[
              styles.input,
              tc.borderColor_border,
              tc.color_text,
              tc.backgroundColor_surface
            ]}
          />
          {comment.trim() ? (
            <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{t('ratingForm.reviewsAppearOnTheDrivers')}</Text>
          ) : null}

          <Text style={[{ fontSize: 15, fontWeight: '700', marginTop: 4 }, tc.color_text]}>{t('ratingForm.didYouFeelSafe')}</Text>
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
                  style={[
                    styles.chip,
                    selected ? tc.backgroundColor_primaryLight : tc.backgroundColor_surface,
                    selected ? tc.borderColor_primary : tc.borderColor_border
                  ]}
                >
                  <Text style={[{ fontSize: 13, fontWeight: selected ? '600' : '400' }, selected ? tc.color_primary : tc.color_text]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[{ fontSize: 12 }, tc.color_textSec]}>{t('ratingForm.safePrivate', { name: rateeName })}</Text>

          <Text style={[{ fontSize: 15, fontWeight: '700', marginTop: 4 }, tc.color_text]}>{t('ratingForm.anythingWrong')}</Text>
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
                <Icon name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={checked ? tk.primary : tk.textSec} />
                <Text style={[{ fontSize: 14 }, tc.color_text]}>{issue.label}</Text>
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
                placeholder={t('ratingForm.whatHappenedOnlyOurTeam')}
                placeholderTextColor={tk.textSec}
                accessibilityLabel={t('ratingForm.whatHappened')}
                style={[
                  styles.input,
                  tc.borderColor_border,
                  tc.color_text,
                  tc.backgroundColor_surface
                ]}
              />
              {issues.includes('safety') ? (
                <Text style={[{ fontSize: 13 }, tc.color_error]}>
                  Our safety team is alerted as soon as you submit. If you are in danger now, call {REGION.emergency.general}.
                </Text>
              ) : null}
            </>
          )}
        </>
      )}

      {error ? <Text style={[{ textAlign: 'center' }, tc.color_error]} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Pressable
        onPress={submit}
        disabled={!score || sending}
        accessibilityRole="button"
        accessibilityState={{ disabled: !score || sending }}
        style={[styles.cta, score ? tc.backgroundColor_primary : tc.backgroundColor_border]}
      >
        {sending ? <ActivityIndicator color={tk.textOnPrimary} /> : (
          <Text style={[{ fontSize: 16, fontWeight: '700' }, score ? tc.color_textOnPrimary : tc.color_textSec]}>{t('ratingForm.submitRating')}</Text>
        )}
      </Pressable>
      {onSkip ? (
        <Pressable onPress={onSkip} accessibilityRole="button" style={styles.textBtn}>
          <Text style={[{ fontSize: 14 }, tc.color_textSec]}>{t('ratingForm.skipForNow')}</Text>
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
