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
  AppState,
  AppStateStatus,
} from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { hasApiKey, saveApiKey, clearApiKey } from '../services/storage';

const MIN_KEY_LENGTH = 40;

export default function SettingsScreen() {
  const [inputValue, setInputValue] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isBackground, setIsBackground] = useState(false);

  useEffect(() => {
    let active = true;
    hasApiKey().then((exists) => { if (active) setHasKey(exists); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setIsBackground(state !== 'active');
    });
    return () => sub.remove();
  }, []);

  const handleSave = async () => {
    if (saving) return;

    // Strip ALL whitespace — not just ends. A pasted key with an accidental internal
    // newline or space would otherwise silently save as a broken key.
    const cleaned = inputValue.replace(/\s/g, '');
    if (!cleaned) {
      Alert.alert('Empty key', 'Please enter your Anthropic API key.');
      return;
    }
    if (!cleaned.startsWith('sk-ant-') || cleaned.length < MIN_KEY_LENGTH) {
      Alert.alert(
        'Invalid format',
        "That doesn't look like a valid Anthropic API key. Double-check it at console.anthropic.com.",
      );
      return;
    }

    setSaving(true);
    try {
      await saveApiKey(cleaned);
      setInputValue('');
      setHasKey(true);
      Alert.alert('Saved', 'Your API key has been saved securely.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save API key.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    Alert.alert('Remove API Key', 'This will delete your saved API key. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearApiKey();
            setInputValue('');
            setHasKey(false);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to remove API key.';
            Alert.alert('Error', msg);
          }
        },
      },
    ]);
  };

  const saveDisabled = !inputValue || saving;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Full-screen overlay when backgrounded — hides key input from app switcher */}
      {isBackground && <View style={styles.backgroundOverlay} />}

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

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ANTHROPIC API KEY</Text>
            <Text style={styles.sectionDesc}>
              Get your key at{' '}
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
              style={[styles.saveButton, saveDisabled && styles.saveButtonDisabled]}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={saveDisabled}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : hasKey ? 'Replace API Key' : 'Save API Key'}
              </Text>
            </TouchableOpacity>

            {hasKey && (
              <TouchableOpacity style={styles.clearButton} onPress={handleClear} activeOpacity={0.7}>
                <Text style={styles.clearButtonText}>Remove Key</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>How it works</Text>
            <Text style={styles.infoText}>
              Your API key is stored in your device's secure enclave (iOS Keychain / Android Keystore).
              It never leaves your device except to call Anthropic's API directly.
            </Text>
            <Text style={styles.infoText}>
              Usage is billed to your Anthropic account. Each request uses roughly 500–2000 tokens.
            </Text>
          </View>

          <Text style={styles.version}>RealityCheck AI · v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    zIndex: 999,
  },
  container: { flex: 1, backgroundColor: COLORS.background },
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
  link: { color: COLORS.accent, textDecorationLine: 'underline' },
  inputRow: { marginBottom: SPACING.md },
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
  keyExistsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  keyExistsText: { fontSize: FONT_SIZES.sm, color: COLORS.success, fontWeight: '600' },
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: SPACING.sm + 4,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  saveButtonDisabled: { backgroundColor: COLORS.accentDark, opacity: 0.5 },
  saveButtonText: { color: COLORS.text, fontSize: FONT_SIZES.md, fontWeight: '700' },
  clearButton: { alignItems: 'center', paddingVertical: SPACING.xs },
  clearButtonText: { color: COLORS.error, fontSize: FONT_SIZES.sm, fontWeight: '600' },
  infoSection: { marginBottom: SPACING.xl },
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
  version: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, textAlign: 'center' },
});
