import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useStore } from '../store/AppProvider';
import { Body, Button, Caution, CheckRow, ChipGroup, Icon, Screen, Small, Tag } from '../ui/components';
import { space, type, useColors } from '../ui/theme';

/**
 * DRAFT pricing shown for demand testing only. No payment system is connected and nothing
 * can be charged from this screen. Pricing needs founder approval before any billing work.
 */
export const DRAFT_PRICING = { monthly: 9.99, yearlyPerMonth: 5.99, yearlySavingsPct: 40 } as const;

const FEATURES = [
  'Advanced personalization controls',
  'Household preferences',
  'Restaurant menu recommendations (with verified menus)',
  'More meal alternatives',
  'Weekly insights',
  'Priority support',
];

export default function Premium() {
  const { state, dispatch, track } = useStore();
  const c = useColors();
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const joined = state.premiumInterest;
  const price = plan === 'monthly' ? DRAFT_PRICING.monthly : DRAFT_PRICING.yearlyPerMonth;

  return (
    <Screen
      footer={
        <>
          {joined ? (
            <Button label="Done" onPress={() => router.back()} />
          ) : (
            <Button
              label="Join the EatOS+ waitlist"
              big
              onPress={() => {
                dispatch({ type: 'setPremiumInterest', on: true });
                track('premium_interest', { plan });
              }}
            />
          )}
          {!joined ? <Button label="Maybe later" variant="ghost" onPress={() => router.back()} /> : null}
        </>
      }
    >
      <LinearGradient colors={[c.hero, '#1F5A3E']} style={{ borderRadius: 20, padding: space.xl, gap: space.sm }}>
        <Text style={{ fontSize: 40 }} accessible={false}>
          👑
        </Text>
        <Text accessibilityRole="header" style={[type.title, { color: c.heroText, fontSize: 30 }]}>
          EatOS+
        </Text>
        <Text style={[type.body, { color: c.heroMuted }]}>More personalized. More options. Coming soon.</Text>
      </LinearGradient>

      <View style={{ gap: space.md }}>
        {FEATURES.map((f) => (
          <CheckRow key={f} text={f} />
        ))}
      </View>
      <Small>Allergy safety, planning, reminders, and your data controls are always free.</Small>

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <ChipGroup
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
          ]}
          value={plan}
          onChange={setPlan}
        />
        {plan === 'yearly' ? <Tag label={`Save ${DRAFT_PRICING.yearlySavingsPct}%`} /> : null}
        <Text style={[type.title, { color: c.ink }]} accessibilityLabel={`Planned price ${price} dollars per month`}>
          ${price.toFixed(2)} <Text style={[type.body, { color: c.inkMuted }]}>/ month</Text>
        </Text>
        <Small>Planned price. Not available yet.</Small>
      </View>

      {joined ? (
        <Caution>You’re on the list. We’ll let you know when EatOS+ is ready. No payment was taken.</Caution>
      ) : (
        <Body muted style={{ textAlign: 'center' }}>
          <Icon name="information-circle-outline" size={14} /> Joining the waitlist is free and doesn’t charge you anything.
        </Body>
      )}
    </Screen>
  );
}
