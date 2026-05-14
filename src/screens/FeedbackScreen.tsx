import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  AppState,
  AppStateStatus,
  Share,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { FEEDBACK_MODES } from '../constants/modes';
import { getFeedback, FeedbackResult } from '../services/claude';
import { saveEntry } from '../services/history';
import ResultCard from '../components/ResultCard';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

type RootStackParamList = {
  Home: undefined;
  Feedback: { modeId: string };
  Settings: undefined;
};

type FeedbackScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Feedback'>;
type FeedbackScreenRouteProp = RouteProp<RootStackParamList, 'Feedback'>;

interface Props {
  navigation: FeedbackScreenNavigationProp;
  route: FeedbackScreenRouteProp;
}

const MAX_INPUT_CHARS = 4000;
const REQUEST_TIMEOUT_MS = 30_000;
const RATE_LIMIT_MS = 3_000;

// Strip dangerous Unicode using only \uXXXX escapes — zero literal invisible chars in source.
// Covers: null bytes, ASCII controls, soft hyphen, zero-width/directional/format chars,
// line+paragraph separators, variation selectors, BOM, interlinear annotations,
// and the Unicode tag block (U+E0000-U+E01EF) used in prompt-injection attacks.
function sanitizeText(text: string): string {
  return text
    .replace(/\x00/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\u00AD/g, '')
    .replace(/[\u200B-\u200F]/g, '')
    .replace(/[\u202A-\u202E]/g, '')
    .replace(/[\u2060-\u206F]/g, '')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/[\uFE00-\uFE0F]/g, '')
    .replace(/\uFEFF/g, '')
    .replace(/[\uFFF9-\uFFFD]/g, '')
    .replace(/[\u{E0000}-\u{E01EF}]/gu, '');
}

// Anthropic SDK wraps all signal aborts as APIUserAbortError (not the Web API AbortError).
// Abort classification (timeout vs. user-triggered) is done via timedOutRef in the component.
function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'APIUserAbortError' || err.name === 'AbortError')
  );
}

function mapError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (message === 'NO_API_KEY') return '';
  if (message === 'PARSE_ERROR') return "Couldn't read the response. Please try again.";
  if (message.includes('401') || message.toLowerCase().includes('authentication')) {
    return 'Invalid API key. Check your key in Settings.';
  }
  if (message.includes('429')) return 'Rate limit reached. Wait a moment and try again.';
  if (message.includes('500') || message.includes('529')) {
    return 'Anthropic servers are having issues. Try again shortly.';
  }
  if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

function formatShareText(result: FeedbackResult, modeTitle: string): string {
  return `REALITYCHECK AI — ${modeTitle}
Grade: ${result.grade}  |  Truth: ${result.truth_score}/100  |  Risk: ${result.risk_score}/100

"${result.verdict}"

BIGGEST WEAKNESS
${result.biggest_weakness}

HIDDEN RISK
${result.hidden_risk}

BLIND SPOTS
• ${result.blind_spots[0]}
• ${result.blind_spots[1]}
• ${result.blind_spots[2]}

BETTER VERSION
${result.better_version}

NEXT ACTION
${result.next_action}

— "AI that tells you the truth before reality does."
realitycheckAI.app`;
}

export default function FeedbackScreen({ navigation, route }: Props) {
  const { modeId } = route.params;

  const [input, setInput] = useState('');
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isBackground, setIsBackground] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const cardRef = useRef<View>(null);
  const abortRef = useRef<AbortController | null>(null);
  const submittingRef = useRef(false);
  const lastRequestRef = useRef<number>(0);
  const timedOutRef = useRef(false);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setIsBackground(state !== 'active');
    });
    return () => sub.remove();
  }, []);

  const mode = FEEDBACK_MODES.find((m) => m.id === modeId);
  if (!mode) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: COLORS.error, padding: SPACING.lg }}>Invalid mode.</Text>
      </SafeAreaView>
    );
  }

  const handleGetFeedback = async () => {
    // Lock synchronously BEFORE any await — closes the race window between tap and lock
    if (submittingRef.current) return;

    if (!input.trim()) {
      Alert.alert('Nothing to review', 'Please enter some text first.');
      return;
    }

    const now = Date.now();
    if (now - lastRequestRef.current < RATE_LIMIT_MS) {
      Alert.alert('Slow down', 'Please wait a moment before requesting again.');
      return;
    }

    submittingRef.current = true;
    lastRequestRef.current = now;
    timedOutRef.current = false;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => {
      timedOutRef.current = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Double-trim: sanitize strips control chars that trim() misses, then trim again
      // in case stripping left only whitespace at the edges.
      const sanitizedInput = sanitizeText(input.trim()).trim();
      const feedbackResult = await getFeedback(mode.systemPrompt, sanitizedInput, controller.signal);
      setResult(feedbackResult);
      saveEntry({
        id: String(Date.now()),
        timestamp: Date.now(),
        modeId: mode.id,
        modeTitle: mode.title,
        modeEmoji: mode.emoji,
        inputPreview: sanitizedInput.slice(0, 100),
        result: feedbackResult,
      });
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 200);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'NO_API_KEY') {
        Alert.alert(
          'API Key Required',
          'Add your Anthropic API key in Settings before using the app.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
          ],
        );
      } else if (isAbortError(err)) {
        if (timedOutRef.current) {
          setError('Request timed out. Check your connection and try again.');
        }
        // else: user-triggered abort (unmount or new request started) — suppress
      } else {
        const mapped = mapError(err);
        if (mapped) setError(mapped);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleShare = async () => {
    if (!result) return;
    try {
      // Try visual share (requires native module — works in EAS/production builds)
      const uri = await captureRef(cardRef, { format: 'png', quality: 1.0, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Reality Check' });
    } catch {
      // Fall back to text share (e.g., in Expo Go where view capture is unavailable)
      try {
        await Share.share({ message: formatShareText(result, mode.title) });
      } catch {
        // Share dialog dismissed or unavailable — no action needed
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modeHeader}>
            <Text style={styles.modeEmoji}>{mode.emoji}</Text>
            <Text style={styles.modeTitle}>{mode.title}</Text>
          </View>

          <Text style={styles.promptLabel}>{mode.prompt}</Text>

          <TextInput
            style={styles.textInput}
            multiline
            value={input}
            onChangeText={setInput}
            placeholder={mode.placeholder}
            placeholderTextColor={COLORS.textMuted}
            textAlignVertical="top"
            editable={!loading}
            maxLength={MAX_INPUT_CHARS}
          />

          {input.length >= MAX_INPUT_CHARS * 0.9 && (
            <Text style={styles.charWarning}>
              {input.length}/{MAX_INPUT_CHARS} characters
            </Text>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleGetFeedback}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.buttonRow}>
                <ActivityIndicator color={COLORS.text} size="small" />
                <Text style={styles.buttonText}>  Thinking...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Get Honest Feedback</Text>
            )}
          </TouchableOpacity>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {result ? (
            <View style={styles.feedbackBox}>
              <View style={styles.feedbackDivider} />
              <Text style={styles.feedbackLabel}>REALITY CHECK</Text>
              {isBackground ? (
                <View style={styles.blurOverlay}>
                  <Text style={styles.blurText}>Content hidden</Text>
                </View>
              ) : (
                <ResultCard result={result} innerRef={cardRef} />
              )}
              {!isBackground && (
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleShare}
                  activeOpacity={0.8}
                >
                  <Text style={styles.shareButtonText}>Share Reality Check</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  modeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  modeEmoji: { fontSize: 28, marginRight: SPACING.sm },
  modeTitle: { fontSize: FONT_SIZES.xl, fontWeight: '800', color: COLORS.text },
  promptLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    minHeight: 160,
    lineHeight: FONT_SIZES.md * 1.5,
    marginBottom: SPACING.xs,
  },
  charWarning: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginBottom: SPACING.sm,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    minHeight: 52,
  },
  buttonDisabled: { backgroundColor: COLORS.accentDark },
  buttonRow: { flexDirection: 'row', alignItems: 'center' },
  buttonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  errorBox: {
    backgroundColor: '#2A1010',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: { color: COLORS.error, fontSize: FONT_SIZES.sm, lineHeight: FONT_SIZES.sm * 1.5 },
  feedbackBox: { marginTop: SPACING.sm },
  feedbackDivider: {
    height: 2,
    backgroundColor: COLORS.accent,
    width: 40,
    marginBottom: SPACING.sm,
    borderRadius: 1,
  },
  feedbackLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    letterSpacing: 3,
    color: COLORS.accent,
    marginBottom: SPACING.md,
  },
  blurOverlay: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  blurText: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm, fontWeight: '600', letterSpacing: 1 },
  shareButton: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  shareButtonText: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
