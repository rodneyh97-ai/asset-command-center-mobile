import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { FEEDBACK_MODES } from '../constants/modes';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home: undefined;
  Feedback: { modeId: string };
  Settings: undefined;
};

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <View style={styles.hero}>
          <Text style={styles.brandTag}>REALITYCHECK AI</Text>
          <Text style={styles.heroTitle}>Truth before{'\n'}reality does.</Text>
          <Text style={styles.heroSubtitle}>
            Bring your ideas, plans, decisions, and moves.{'\n'}Get honest feedback before it's too late.
          </Text>
        </View>

        {/* Mode grid */}
        <View style={styles.grid}>
          {FEEDBACK_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={styles.card}
              onPress={() => navigation.navigate('Feedback', { modeId: mode.id })}
              activeOpacity={0.75}
            >
              <Text style={styles.cardEmoji}>{mode.emoji}</Text>
              <Text style={styles.cardTitle}>{mode.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.footer}>Powered by Claude (Anthropic)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  hero: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  brandTag: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    letterSpacing: 4,
    color: COLORS.accent,
    marginBottom: SPACING.sm,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: '900',
    color: COLORS.text,
    lineHeight: FONT_SIZES.xxxl * 1.1,
    marginBottom: SPACING.md,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: FONT_SIZES.md * 1.6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  card: {
    width: '47.5%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'flex-start',
    minHeight: 100,
    justifyContent: 'space-between',
  },
  cardEmoji: {
    fontSize: 32,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  footer: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
