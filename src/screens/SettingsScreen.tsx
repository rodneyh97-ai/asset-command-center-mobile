import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { hasApiKey, saveApiKey, clearApiKey } from '../services/storage';

const MIN_KEY_LENGTH = 40;

export default function SettingsScreen() {
  const [inputValue, setInputValue] = useState('');
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    let active = true;
    hasApiKey().then((exists) => { if (active) setHasKey(exists); });
    return () => { active = false; };
  }, []);

  const handleSave = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      Alert.alert('Empty key', 'Please enter your Anthropic API key.');
      return;
    }
    if (!trimmed.startsWith('sk-ant-') || trimmed.length < MIN_KEY_LENGTH) {
      Alert.alert(
        'Invalid format',
        'That doesn\'t look like a valid Anthropic API key. Double-check it at console.anthropic.com.',
      );
      return;
    }
    await saveApiKey(trimmed);
    setInputValue('');
    setHasKey(true);
    Alert.alert('Saved', 'Your API key has been saved securely.');
  };

  const handleClear = () => {
    Alert.alert('Remove API Key', 'This will delete your saved API key. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await clearApiKey();
          setInputValue('');
          setHasKey(false);
        },
      },
    ]);
  };

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
        >
          <Text style={styles.title}>Settings</Text>

          {/* API Key section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ANTHROPIC API KEY</Text>
            <Text style={styles.sectionDesc}>
              Get your free API key at{' '}
              <Text style={styles.link}>console.anthropic.com</Text>
            </Text>

            {hasKey && !inputValue && (
              <View style={styles.keyExistsRow}>
                <Text style={styles.keyExistsText}>✓ API key saved securely</Text>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder={hasKey ? 'Enter new key to replace...' : 'sk-ant-...'}
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                maxLength={200}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, !inputValue && styles.saveButtonDisabled]}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={!inputValue}
            >
              <Text style={styles.saveButtonText}>
                {hasKey ? 'Replace API Key' : 'Save API Key'}
              </Text>
            </TouchableOpacity>

            {hasKey && (
              <TouchableOpacity style={styles.clearButton} onPress={handleClear} activeOpacity={0.7}>
                <Text style={styles.clearButtonText}>Remove Key</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Info section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>How it works</Text>
            <Text style={styles.infoText}>
              Your API key is stored locally on your device. It's never sent anywhere except directly to Anthropic's servers when you request feedback.
            </Text>
            <Text style={styles.infoText}>
              Usage is billed to your Anthropic account at standard API rates. Each feedback request uses roughly 500–2000 tokens.
            </Text>
          </View>

          {/* Version */}
          <Text style={styles.version}>No BS AI · v1.0.0</Text>
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
    marginBottom: SPACING.xs,
  },
  sectionDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: FONT_SIZES.sm * 1.5,
  },
  link: {
    color: COLORS.accent,
    textDecorationLine: 'underline',
  },
  inputRow: {
    marginBottom: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  keyExistsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  keyExistsText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: SPACING.sm + 4,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.accentDark,
    opacity: 0.5,
  },
  saveButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  clearButton: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  clearButtonText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: SPACING.xl,
  },
  infoTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: FONT_SIZES.sm * 1.6,
    marginBottom: SPACING.sm,
  },
  version: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
