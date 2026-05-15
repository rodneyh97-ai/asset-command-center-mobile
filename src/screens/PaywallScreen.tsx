import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import { unlockPremium } from '../services/usage';

const FEATURES = [
  'Unlimited checks every day across all 15 modes',
  'Full access to every new mode added to the app',
  'Instant shareable result card for every check',
  'Full check history saved on your device',
];

export default function PaywallScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  const handlePurchase = async (plan: 'monthly' | 'annual') => {
    if (loading) return;
    setLoading(true);
    try {
      // TODO: Replace with RevenueCat:
      //   import Purchases from 'react-native-purchases';
      //   const offerings = await Purchases.getOfferings();
      //   const pkg = plan === 'annual'
      //     ? offerings.current?.annual
      //     : offerings.current?.monthly;
      //   if (pkg) {
      //     await Purchases.purchasePackage(pkg);
      //     await unlockPremium(); // called after successful RevenueCat verification
      //   }
      //
      // For now — show setup instructions:
      Alert.alert(
        'Almost Ready',
        `RevenueCat in-app purchase setup needed.\n\n1. Create a RevenueCat account\n2. Add your App Store / Play Store app\n3. Set product IDs in purchases.ts\n\nPlan: ${plan}`,
        [{ text: 'Got It' }],
      );
    } catch {
      Alert.alert('Purchase Failed', 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    // TODO: Purchases.restorePurchases()
    Alert.alert('Restore Purchases', 'No previous purchases found.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.dismiss}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>

        <Text style={styles.emoji}>🔥</Text>
        <Text style={styles.title}>Unlimited Reality Checks</Text>
        <Text style={styles.subtitle}>One price. No limits. No BS.</Text>

        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.check}>✓</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Annual — highlighted */}
        <TouchableOpacity
          style={[styles.plan, styles.planHighlighted]}
          onPress={() => handlePurchase('annual')}
          activeOpacity={0.85}
          disabled={loading}
        >
          <View style={styles.badge}>
            <Text style={styles.badgeText}>BEST VALUE</Text>
          </View>
          <Text style={styles.planTitle}>Annual</Text>
          <Text style={styles.planPrice}>
            $29.99<Text style={styles.planPer}> / year</Text>
          </Text>
          <Text style={styles.planNote}>Just $2.50/month · cancel anytime</Text>
        </TouchableOpacity>

        {/* Monthly */}
        <TouchableOpacity
          style={styles.plan}
          onPress={() => handlePurchase('monthly')}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Text style={styles.planTitle}>Monthly</Text>
          <Text style={styles.planPrice}>
            $4.99<Text style={styles.planPer}> / month</Text>
          </Text>
          <Text style={styles.planNote}>Cancel anytime</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleRestore} activeOpacity={0.7} style={styles.restore}>
          <Text style={styles.restoreText}>Restore Purchase</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          Payment charged to your App Store account. Subscription renews automatically unless
          cancelled at least 24 hours before the end of the billing period.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    alignItems: 'center',
  },
  dismiss: { alignSelf: 'flex-end', padding: SPACING.sm, marginBottom: SPACING.md },
  dismissText: { fontSize: 20, color: COLORS.textMuted },
  emoji: { fontSize: 56, marginBottom: SPACING.md },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: FONT_SIZES.md * 1.5,
  },
  features: { width: '100%', marginBottom: SPACING.xl },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm },
  check: { color: COLORS.accent, fontSize: FONT_SIZES.md, fontWeight: '800', marginRight: SPACING.sm, marginTop: 1 },
  featureText: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.text, lineHeight: FONT_SIZES.md * 1.5 },
  plan: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  planHighlighted: { borderColor: COLORS.accent, borderWidth: 2 },
  badge: {
    backgroundColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginBottom: SPACING.sm,
  },
  badgeText: { fontSize: FONT_SIZES.xs, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  planTitle: { fontSize: FONT_SIZES.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.xs },
  planPrice: { fontSize: FONT_SIZES.xxl, fontWeight: '900', color: COLORS.text },
  planPer: { fontSize: FONT_SIZES.md, fontWeight: '400', color: COLORS.textSecondary },
  planNote: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: SPACING.xs },
  restore: { marginTop: SPACING.md, padding: SPACING.sm },
  restoreText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  legal: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.lg,
    lineHeight: FONT_SIZES.xs * 1.6,
    paddingHorizontal: SPACING.md,
  },
});
