import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { FeedbackResult } from '../services/claude';
import { gradeColor } from '../utils/gradeColor';

interface Props {
  result: FeedbackResult;
  innerRef?: React.Ref<View>;
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

interface ScoreBarProps {
  label: string;
  score: number;
  color: string;
}

const BAR_WIDTH = 120;

function ScoreBar({ label, score, color }: ScoreBarProps) {
  const fillWidth = (score / 100) * BAR_WIDTH;
  return (
    <View style={barStyles.container}>
      <View style={barStyles.labelRow}>
        <Text style={barStyles.label}>{label}</Text>
        <Text style={[barStyles.score, { color }]}>{score}</Text>
      </View>
      <View style={[barStyles.track, { width: BAR_WIDTH }]}>
        <View style={[barStyles.fill, { width: fillWidth, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: { alignItems: 'flex-start' },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  label: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: COLORS.textSecondary,
    marginRight: SPACING.xs,
  },
  score: { fontSize: FONT_SIZES.sm, fontWeight: '800' },
  track: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});

export default function ResultCard({ result, innerRef }: Props) {
  const gColor = gradeColor(result.grade);
  const tColor = truthScoreColor(result.truth_score);
  const rColor = riskScoreColor(result.risk_score);

  return (
    <View ref={innerRef} style={styles.card}>
      <View style={styles.gradeBadgeWrapper}>
        <View style={[styles.gradeBadge, { backgroundColor: gColor + '26', borderColor: gColor }]}>
          <Text style={[styles.gradeText, { color: gColor }]}>{result.grade}</Text>
        </View>
      </View>

      <View style={styles.scoreRow}>
        <ScoreBar label="TRUTH" score={result.truth_score} color={tColor} />
        <ScoreBar label="RISK" score={result.risk_score} color={rColor} />
      </View>

      <View style={styles.verdictBox}>
        <Text style={styles.verdictText}>&ldquo;{result.verdict}&rdquo;</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>BIGGEST WEAKNESS</Text>
        <Text style={styles.sectionBody}>{result.biggest_weakness}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>HIDDEN RISK</Text>
        <Text style={styles.sectionBody}>{result.hidden_risk}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>BLIND SPOTS</Text>
        {result.blind_spots.map((spot, i) => (
          <Text key={i} style={styles.bulletItem}>
            {'• '}
            {spot}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>BETTER VERSION</Text>
        <Text style={styles.sectionBody}>{result.better_version}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>NEXT ACTION</Text>
        <View
          style={[
            styles.nextActionBox,
            { backgroundColor: COLORS.accent + '26', borderColor: COLORS.accent },
          ]}
        >
          <Text style={styles.nextActionText}>{result.next_action}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
  gradeText: { fontSize: 40, fontWeight: '900', letterSpacing: 1 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: SPACING.md },
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
  nextActionBox: { borderWidth: 1, borderRadius: 10, padding: SPACING.md },
  nextActionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: FONT_SIZES.md * 1.6,
    fontWeight: '600',
  },
});
