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
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { FEEDBACK_MODES } from '../constants/modes';
import { getFeedback, FeedbackResult } from '../services/claude';
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
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // ASCII controls (keep \t \n \r)
    .replace(/\u00AD/g, '')                                    // soft hyphen
    .replace(/[\u200B-\u200F]/g, '')                          // zero-width + directional marks
    .replace(/[\u202A-\u202E]/g, '')                          // LRE RLE PDF LRO RLO
    .replace(/[\u2060-\u206F]/g, '')                          // word joiner + deprecated format
    .replace(/[\u2028\u2029]/g, '\n')                        // line/paragraph separators -> \n
    .replace(/[\uFE00-\uFE0F]/g, '')                          // variation selectors
    .replace(/\uFEFF/g, '')                                    // BOM
    .replace(/[\uFFF9-\uFFFD]/g, '')                          // interlinear annotations + specials
    .replace(/[\u{E0000}-\u{E01EF}]/gu, '');                  // tag block + variation selectors supp.
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

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A' || grade === 'A-') return '#4CAF50';
  if (grade === 'B+' || grade === 'B' || grade === 'B-') return '#2196F3';
  if (grade === 'C+' || grade === 'C' || grade === 'C-') return '#FF9800';
  if (grade === 'D') return '#F44336';
  return '#B71C1C'; // F
}

function truthScoreColor(score: number): string {
  if (score >= 70) return '#4CAF50';
  if (score >= 40) return '#FF9800';
  return '#F44336';
}

function riskScoreColor(score: number): string {
  if (score < 30) return '#4CAF50';
  if (score < 60) return '#FF9800';
  return '#F44336';
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

interface ScoreBarProps {
  label: string;
  score: number;
  color: string;
}

const BAR_WIDTH = 120;

function ScoreBar({ label, score, color }: ScoreBarProps) {
  const fillWidth = (score / 100) * BAR_WIDTH;
  return (
    <View style={scoreBarStyles.container}>
      <View style={scoreBarStyles.labelRow}>
        <Text style={scoreBarStyles.label}>{label}</Text>
        <Text style={[scoreBarStyles.score, { color }]}>{score}</Text>
      </View>
      <View style={[scoreBarStyles.track, { width: BAR_WIDTH }]}>
        <View style={[scoreBarStyles.fill, { width: fillWidth, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const scoreBarStyles = StyleSheet.create({
  container: { alignItems: 'flex-start' },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  label: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: COLORS.textSecondary,
    marginRight: SPACING.xs,
  },
  score: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
  },
  track: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
});

export default function FeedbackScreen({ navigation, route }: Props) {
  const { modeId } = route.params;

  const [input, setInput] = useState('');
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isBackground, setIsBackground] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
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
      await Share.share({ message: formatShareText(result, mode.title) });
    } catch {
      // Share dialog dismissed or unavailable — no action needed
    }
  };

  const renderResultCard = (res: FeedbackResult) => {
    const gColor = gradeColor(res.grade);
    const tColor = truthScoreColor(res.truth_score);
    const rColor = riskScoreColor(res.risk_score);

    return (
      <View style={styles.resultCard}>
        {/* Grade badge */}
        <View style={styles.gradeBadgeWrapper}>
          <View
            style={[
              styles.gradeBadge,
              {
                backgroundColor: gColor + '26', // ~15% opacity
                borderColor: gColor,
              },
            ]}
          >
            <Text style={[styles.gradeText, { color: gColor }]}>{res.grade}</Text>
          </View>
        </View>

        {/* Score row */}
        <View style={styles.scoreRow}>
          <ScoreBar label="TRUTH" score={res.truth_score} color={tColor} />
          <ScoreBar label="RISK" score={res.risk_score} color={rColor} />
        </View>

        {/* Verdict */}
        <View style={styles.verdictBox}>
          <Text style={styles.verdictText}>&ldquo;{res.verdict}&rdquo;</Text>
        </View>

        {/* Biggest Weakness */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BIGGEST WEAKNESS</Text>
          <Text style={styles.sectionBody}>{res.biggest_weakness}</Text>
        </View>

        {/* Hidden Risk */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HIDDEN RISK</Text>
          <Text style={styles.sectionBody}>{res.hidden_risk}</Text>
        </View>

        {/* Blind Spots */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BLIND SPOTS</Text>
          {res.blind_spots.map((spot, i) => (
            <Text key={i} style={styles.bulletItem}>
              {'• '}
              {spot}
            </Text>
          ))}
        </View>

        {/* Better Version */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BETTER VERSION</Text>
          <Text style={styles.sectionBody}>{res.better_version}</Text>
        </View>

        {/* Next Action — highlighted box */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NEXT ACTION</Text>
          <View
            style={[
              styles.nextActionBox,
              {
                backgroundColor: COLORS.accent + '26', // ~15% opacity
                borderColor: COLORS.accent,
              },
            ]}
          >
            <Text style={styles.nextActionText}>{res.next_action}</Text>
          </View>
        </View>
      </View>
    );
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
            placeholder="Type or paste here..."
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
                renderResultCard(result)
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
  // Result card
  resultCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  gradeBadgeWrapper: { alignItems: 'center', marginBottom: SPACING.md },
  gradeBadge: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.md,
  },
  verdictBox: { marginBottom: SPACING.md },
  verdictText: {
    fontSize: FONT_SIZES.lg,
    fontStyle: 'italic',
    color: COLORS.accent,
    lineHeight: FONT_SIZES.lg * 1.5,
    textAlign: 'center',
  },
  section: { marginBottom: SPACING.md },
  sectionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    letterSpacing: 2,
    color: COLORS.accent,
    marginBottom: SPACING.xs,
  },
  sectionBody: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: FONT_SIZES.md * 1.6,
  },
  bulletItem: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: FONT_SIZES.md * 1.6,
    marginBottom: 2,
  },
  nextActionBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: SPACING.md,
  },
  nextActionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: FONT_SIZES.md * 1.6,
    fontWeight: '600',
  },
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
