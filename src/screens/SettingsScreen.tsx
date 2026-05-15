import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { FREE_DAILY_LIMIT } from '../constants/config';
import { getUsageCount, getRemainingChecks, isPremium } from '../services/usage';
import { submitSuggestion } from '../services/suggestions';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [usageCount, setUsageCount] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [premium, setPremium] = useState(false);
  const [suggestionTitle, setSuggestionTitle] = useState('');
  const [suggestionDesc, setSuggestionDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getUsageCount(), getRemainingChecks(), isPremium()]).then(
        ([count, rem, prem]) => {
          setUsageCount(count);
          setRemaining(rem);
          setPremium(prem);
        },
      );
    }, []),
  );

  const handleSuggestMode = async () => {
    if (submitting) return;
    const t = suggestionTitle.trim();
    const d = suggestionDesc.trim();

    if (t.length < 3) {
      Alert.alert('Too short', 'Give your mode a name (at least 3 characters).');
      return;
    }
    if (d.length < 10) {
      Alert.alert('Too short', 'Describe what the mode should do (at least 10 characters).');
      return;
    }

    setSubmitting(true);
    const result = await submitSuggestion({ title: t, description: d });
    setSubmitting(false);

    if (result.ok) {
      setSuggestionTitle('');
      setSuggestionDesc('');
      Alert.alert(
        'Suggestion Sent!',
        'Thanks. Popular suggestions get reviewed weekly and added to the app.',
        [{ text: 'Great' }],
      );
    } else {
      const msg =
        result.error === 'SUGGESTION_LIMIT'
          ? 'You\'ve sent 3 suggestions today. Come back tomorrow!'
          : 'Could not submit. Check your connection and try again.';
      Alert.alert('Could not submit', msg);
    }
  };

  const usagePercent = FREE_DAILY_LIMIT > 0 ? (usageCount / FREE_DAILY_LIMIT) * 100 : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Settings</Text>

          {/* Usage */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TODAY'S USAGE</Text>
            {premium ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Status</Text>
                <Text style={[styles.rowValue, { color: '#4CAF50' }]}>Unlimited ✓</Text>
              </View>
            ) : (
              <>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Checks used</Text>
                  <Text style={styles.rowValue}>
                    {usageCount} of {FREE_DAILY_LIMIT}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(usagePercent, 100)}%` as `${number}%`,
                        backgroundColor: usagePercent >= 100 ? COLORS.error : COLORS.accent,
                      },
                    ]}
                  />
                </View>
                {remaining === 0 ? (
                  <Text style={styles.limitNote}>Limit reached — resets at midnight</Text>
                ) : (
                  <Text style={styles.limitNote}>
                    {remaining} check{remaining === 1 ? '' : 's'} left today · resets at midnight
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => navigation.navigate('Paywall' as never)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.upgradeButtonText}>Get Unlimited Access →</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Suggest a Mode */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SUGGEST A MODE</Text>
            <Text style={styles.sectionDesc}>
              Have an idea for a new reality check? Top suggestions get added to the app.
            </Text>
            <TextInput
              style={styles.input}
              value={suggestionTitle}
              onChangeText={setSuggestionTitle}
              placeholder="Mode name (e.g. Cover Letter Review)"
              placeholderTextColor={COLORS.textMuted}
              maxLength={100}
              editable={!submitting}
            />
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={suggestionDesc}
              onChangeText={setSuggestionDesc}
              placeholder="What should it do? What kind of feedback should it give?"
              placeholderTextColor={COLORS.textMuted}
              maxLength={500}
              multiline
              textAlignVertical="top"
              editable={!submitting}
            />
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSuggestMode}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Submitting...' : 'Submit Suggestion'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* About */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Powered by</Text>
              <Text style={styles.rowValue}>Claude (Anthropic)</Text>
            </View>
          </View>

          <Text style={styles.footer}>RealityCheck AI</Text>
          <Text style={styles.footerSub}>AI that tells you the truth before reality does.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    letterSpacing: 2,
    color: COLORS.accent,
    marginBottom: SPACING.sm,
  },
  sectionDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: FONT_SIZES.sm * 1.5,
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  rowLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  rowValue: { fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: '600' },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    marginVertical: SPACING.sm,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3 },
  limitNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  upgradeButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  upgradeButtonText: { color: COLORS.text, fontSize: FONT_SIZES.sm, fontWeight: '800', letterSpacing: 0.3 },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.sm,
  },
  inputMulti: { minHeight: 80, lineHeight: FONT_SIZES.sm * 1.5 },
  submitButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: COLORS.text, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  footer: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 2,
  },
  footerSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
