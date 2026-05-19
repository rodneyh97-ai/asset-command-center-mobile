import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT_SIZES, SPACING } from '../constants/theme';
import {
  getOfferings,
  purchaseRCPackage,
  restorePurchasesRC,
  RCOfferings,
} from '../services/purchases';
import type { PurchasesPackage } from 'react-native-purchases';
import { unlockPremium } from '../services/usage';

const FEATURES = [
  'Unlimited checks every day across all 15 modes',
  'Full access to every new mode added to the app',
  'Instant shareable result card for every check',
  'Full check history saved on your device',
];

export default function PaywallScreen() {
  const navigation = useNavigation();
  const [purchasing, setPurchasing] = useState(false);
  const [offerings, setOfferings] = useState<RCOfferings>({ monthly: null, annual: null });
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  useEffect(() => {
    getOfferings().then((o) => {
      setOfferings(o);
      setLoadingOfferings(false);
    });
  }, []);

  const handlePurchase = async (pkg: PurchasesPackage | null, plan: 'monthly' | 'annual') => {
    if (purchasing) return;

    if (!pkg) {
      Alert.alert(
        'Store Not Ready',
        `In-app purchases require a production build with RevenueCat configured.\n\n` +
        `Steps:\n1. Create a RevenueCat project at app.revenuecat.com\n` +
        `2. Add your ${plan} product in App Store Connect / Play Console\n` +
        `3. Set REVENUECAT_IOS_KEY / REVENUECAT_ANDROID_KEY in src/constants/config.ts\n` +
        `4. Build with EAS (eas build)`,
        [{ text: 'OK' }],
      );
      return;
    }

    setPurchasing(true);
    const result = await purchaseRCPackage(pkg);
    setPurchasing(false);

    if (result.ok) {
      await unlockPremium();
      Alert.alert(
        "You're Unlimited! 🔥",
        'Enjoy unlimited reality checks — no limits, no BS.',
        [{ text: "Let's Go", onPress: () => navigation.goBack() }],
      );
    } else if (!result.cancelled) {
      Alert.alert('Purchase Failed', result.error || 'Please try again.');
    }
    // user cancelled the OS payment sheet — no alert, just dismiss silently
  };

  const handleRestore = async () => {
    if (purchasing) return;
    setPurchasing(true);
    const restored = await restorePurchasesRC();
    setPurchasing(false);

    if (restored) {
      await unlockPremium();
      Alert.alert('Restored!', 'Your subscription is active again.', [
        { text: 'Great', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Nothing to Restore', 'No active subscription found for this account.');
    }
  };

  const annualPkg = offerings.annual;
  const monthlyPkg = offerings.monthly;
  const annualPrice = annualPkg?.product.priceString ?? '$29.99';
  const monthlyPrice = monthlyPkg?.product.priceString ?? '$4.99';
  const annualMonthlyNote = annualPkg?.product.pricePerMonthString != null
    ? `Just ${annualPkg.product.pricePerMonthString}/mo · cancel anytime`
    : 'Just $2.50/month · cancel anytime';

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

        {loadingOfferings ? (
          <ActivityIndicator color={COLORS.accent} size="large" style={styles.loader} />
        ) : (
          <>
            {/* Annual — highlighted */}
            <TouchableOpacity
              style={[styles.plan, styles.planHighlighted]}
              onPress={() => handlePurchase(annualPkg, 'annual')}
              activeOpacity={0.85}
              disabled={purchasing}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>BEST VALUE</Text>
              </View>
              <Text style={styles.planTitle}>Annual</Text>
              <Text style={styles.planPrice}>
                {annualPrice}<Text style={styles.planPer}> / year</Text>
              </Text>
              <Text style={styles.planNote}>{annualMonthlyNote}</Text>
            </TouchableOpacity>

            {/* Monthly */}
            <TouchableOpacity
              style={styles.plan}
              onPress={() => handlePurchase(monthlyPkg, 'monthly')}
              activeOpacity={0.85}
              disabled={purchasing}
            >
              <Text style={styles.planTitle}>Monthly</Text>
              <Text style={styles.planPrice}>
                {monthlyPrice}<Text style={styles.planPer}> / month</Text>
              </Text>
              <Text style={styles.planNote}>Cancel anytime</Text>
            </TouchableOpacity>
          </>
        )}

        {purchasing && (
          <ActivityIndicator color={COLORS.accent} style={styles.purchasingIndicator} />
        )}

        <TouchableOpacity
          onPress={handleRestore}
          activeOpacity={0.7}
          style={styles.restore}
          disabled={purchasing}
        >
          <Text style={styles.restoreText}>Restore Purchase</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          Payment charged to your App Store or Google Play account. Subscription auto-renews
          unless cancelled at least 24 hours before the end of the billing period.
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
  check: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    marginRight: SPACING.sm,
    marginTop: 1,
  },
  featureText: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.text, lineHeight: FONT_SIZES.md * 1.5 },
  loader: { marginVertical: SPACING.xxl },
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
  purchasingIndicator: { marginVertical: SPACING.md },
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
