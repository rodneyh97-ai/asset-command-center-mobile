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
} from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { FeedbackMode } from '../constants/modes';
import { getApiKey } from '../services/storage';
import { getFeedback } from '../services/claude';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

type RootStackParamList = {
  Home: undefined;
  Feedback: { mode: FeedbackMode };
  Settings: undefined;
};

type FeedbackScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Feedback'>;
type FeedbackScreenRouteProp = RouteProp<RootStackParamList, 'Feedback'>;

interface Props {
  navigation: FeedbackScreenNavigationProp;
  route: FeedbackScreenRouteProp;
}

export default function FeedbackScreen({ navigation, route }: Props) {
  const { mode } = route.params;
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const handleGetFeedback = async () => {
    if (!input.trim()) {
      Alert.alert('Nothing to review', 'Please enter some text first.');
      return;
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      Alert.alert(
        'API Key Required',
        'You need to add your Anthropic API key in Settings before using the app.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Settings',
            onPress: () => navigation.navigate('Settings'),
          },
        ],
      );
      return;
    }

    setLoading(true);
    setError('');
    setFeedback('');

    try {
      const result = await getFeedback(apiKey, mode.systemPrompt, input.trim());
      setFeedback(result);
      // Scroll to the feedback section after a brief delay
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      if (message.includes('401') || message.includes('authentication')) {
        setError('Invalid API key. Check your key in Settings.');
      } else if (message.includes('429')) {
        setError('Rate limited. Wait a moment and try again.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderFeedback = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <Text key={i} style={styles.sectionHeader}>
            {line.replace(/\*\*/g, '')}
          </Text>
        );
      }
      if (line.startsWith('**') && line.includes('**:')) {
        const parts = line.split('**:');
        const header = parts[0].replace(/\*\*/g, '');
        const rest = parts[1] || '';
        return (
          <Text key={i} style={styles.feedbackLine}>
            <Text style={styles.sectionHeaderInline}>{header}:</Text>
            {rest}
          </Text>
        );
      }
      if (line.trim() === '') {
        return <View key={i} style={styles.spacer} />;
      }
      return (
        <Text key={i} style={styles.feedbackLine}>
          {line}
        </Text>
      );
    });
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
          {/* Mode header */}
          <View style={styles.modeHeader}>
            <Text style={styles.modeEmoji}>{mode.emoji}</Text>
            <Text style={styles.modeTitle}>{mode.title}</Text>
          </View>

          {/* Prompt label */}
          <Text style={styles.promptLabel}>{mode.prompt}</Text>

          {/* Text input */}
          <TextInput
            style={styles.textInput}
            multiline
            value={input}
            onChangeText={setInput}
            placeholder="Type or paste here..."
            placeholderTextColor={COLORS.textMuted}
            textAlignVertical="top"
            editable={!loading}
          />

          {/* CTA button */}
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

          {/* Error state */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Feedback response */}
          {feedback ? (
            <View style={styles.feedbackBox}>
              <View style={styles.feedbackDivider} />
              <Text style={styles.feedbackLabel}>HONEST FEEDBACK</Text>
              <View style={styles.feedbackContent}>{renderFeedback(feedback)}</View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modeEmoji: {
    fontSize: 28,
    marginRight: SPACING.sm,
  },
  modeTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
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
    marginBottom: SPACING.md,
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
  buttonDisabled: {
    backgroundColor: COLORS.accentDark,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    lineHeight: FONT_SIZES.sm * 1.5,
  },
  feedbackBox: {
    marginTop: SPACING.sm,
  },
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
  feedbackContent: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
  },
  sectionHeader: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.accent,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    letterSpacing: 0.5,
  },
  sectionHeaderInline: {
    fontWeight: '800',
    color: COLORS.accent,
  },
  feedbackLine: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: FONT_SIZES.md * 1.6,
  },
  spacer: {
    height: SPACING.xs,
  },
});
