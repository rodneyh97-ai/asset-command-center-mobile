import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import type { MealIdea } from '../engine';
import { mealColors, mealEmoji } from './mealArt';
import { radius, space, TOUCH, type, useColors } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const c = useColors();
  return <Ionicons name={name} size={size} color={color ?? c.ink} accessible={false} />;
}

// ---------- Layout ----------

export function Screen({
  children,
  footer,
  edges = ['top', 'left', 'right', 'bottom'],
}: {
  children: ReactNode;
  footer?: ReactNode;
  edges?: Edge[];
}) {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={edges}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        // Lets keyboard users focus and scroll long screens on web.
        focusable={Platform.OS === 'web'}
      >
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Row({ children, gap = space.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Gap({ size = space.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

// ---------- Text ----------

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[type.title, { color: c.ink }, style]}>
      {children}
    </Text>
  );
}

export function Heading({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[type.heading, { color: c.ink }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text style={[type.body, { color: muted ? c.inkMuted : c.ink }, style]}>{children}</Text>;
}

export function Small({ children, muted = true, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return <Text style={[type.small, { color: muted ? c.inkMuted : c.ink }, style]}>{children}</Text>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[type.label, { color: c.ink }]}>{children}</Text>;
}

/** "Eat" + green "OS" wordmark. */
export function Logo({ size = 22, inverse }: { size?: number; inverse?: boolean }) {
  const c = useColors();
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="EatOS"
      style={{ fontSize: size, fontWeight: '700', letterSpacing: -size * 0.03, color: inverse ? c.heroText : c.ink }}
    >
      Eat<Text style={{ color: inverse ? c.accent : c.brandGreen }}>OS</Text>
    </Text>
  );
}

// ---------- Buttons ----------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

export function Button({
  label,
  onPress,
  variant = 'primary',
  hint,
  disabled,
  big,
  icon,
  iconRight,
  a11yLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  hint?: string;
  disabled?: boolean;
  big?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  a11yLabel?: string;
}) {
  const c = useColors();
  const bg = { primary: c.primary, secondary: c.surface, ghost: 'transparent', danger: 'transparent', accent: c.accent }[variant];
  const fg = { primary: c.primaryText, secondary: c.ink, ghost: c.primary, danger: c.danger, accent: c.accentText }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        big && styles.buttonBig,
        {
          backgroundColor: pressed && variant === 'primary' ? c.primaryPressed : bg,
          borderColor: variant === 'secondary' ? c.border : 'transparent',
          opacity: disabled ? 0.45 : pressed && variant !== 'primary' ? 0.7 : 1,
        },
      ]}
    >
      <Row gap={space.sm} style={{ justifyContent: 'center' }}>
        {icon ? <Icon name={icon} size={18} color={fg} /> : null}
        <Text style={[type.label, { color: fg, textAlign: 'center', fontSize: big ? 17 : 15 }]}>{label}</Text>
        {iconRight ? <Icon name={iconRight} size={18} color={fg} /> : null}
      </Row>
    </Pressable>
  );
}

/** Small text/icon action (Back, Profile) with a full-size touch target. */
export function TextAction({
  label,
  onPress,
  a11yLabel,
  icon,
}: {
  label?: string;
  onPress: () => void;
  a11yLabel?: string;
  icon?: IconName;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.textAction, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Row gap={space.xs}>
        {icon ? <Icon name={icon} size={22} color={c.ink} /> : null}
        {label ? <Small muted={false}>{label}</Small> : null}
      </Row>
    </Pressable>
  );
}

// ---------- Choice controls ----------

/** Pill chip; selected = solid green (as in the design). */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.primary : c.surfaceMuted,
          borderColor: selected ? c.primary : c.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[type.label, { color: selected ? c.primaryText : c.ink, fontWeight: selected ? '700' : '500' }]}>{label}</Text>
    </Pressable>
  );
}

export interface Option<T extends string | number> {
  value: T;
  label: string;
}

export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  stretch,
}: {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Equal-width chips filling one row (home screen style). */
  stretch?: boolean;
}) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <View style={[styles.chips, stretch && { flexWrap: 'nowrap' }]}>
        {options.map((o) => (
          <View key={String(o.value)} style={stretch ? { flex: 1 } : undefined}>
            <Chip label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function toggleIn<T>(list: T[], v: T, exclusive?: T): T[] {
  if (v === exclusive) return list.includes(v) ? [] : [v];
  return list.includes(v) ? list.filter((x) => x !== v) : [...list.filter((x) => x !== exclusive), v];
}

export function MultiChipGroup<T extends string>({
  options,
  value,
  onChange,
  exclusive,
}: {
  options: Option<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  /** Option that clears all others when chosen (e.g. "None"). */
  exclusive?: T;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={value.includes(o.value)}
          onPress={() => onChange(toggleIn(value, o.value, exclusive))}
        />
      ))}
    </View>
  );
}

/** Large selectable card with icon, title and subtitle (goal screen). */
export function OptionCard({
  icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        {
          backgroundColor: selected ? c.selected : c.surface,
          borderColor: selected ? c.selectedBorder : c.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: selected ? c.surface : c.surfaceMuted }]}>
        <Icon name={icon} size={22} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.label, { color: c.ink }]}>{title}</Text>
        {subtitle ? <Small>{subtitle}</Small> : null}
      </View>
      {selected ? <Icon name="checkmark-circle" size={22} color={c.primary} /> : null}
    </Pressable>
  );
}

/** Picture tile with caption (food preference grid). */
export function ImageChoiceTile({
  emoji,
  colors,
  label,
  selected,
  onPress,
}: {
  emoji: string;
  colors: [string, string];
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.imageTile, { opacity: pressed ? 0.85 : 1 }]}
    >
      <LinearGradient colors={colors} style={[styles.imageTileArt, { borderColor: selected ? c.primary : 'transparent' }]}>
        <Text style={{ fontSize: 34 }} accessible={false}>
          {emoji}
        </Text>
        {selected ? (
          <View style={[styles.tileCheck, { backgroundColor: c.primary }]}>
            <Icon name="checkmark" size={14} color={c.primaryText} />
          </View>
        ) : null}
      </LinearGradient>
      <Small muted={false} style={{ textAlign: 'center', fontWeight: selected ? '700' : '500' }}>
        {label}
      </Small>
    </Pressable>
  );
}

/** Row with icon, label and an on/off toggle (restrictions screen). One control, fully labelled. */
export function ToggleRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: IconName;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      aria-checked={value}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={[styles.listRow, { borderBottomColor: c.border }]}
    >
      <Icon name={icon} size={20} color={c.primary} />
      <Text style={[type.body, { color: c.ink, flex: 1 }]}>{label}</Text>
      {/* Visual-only toggle; the whole row is the control. */}
      <View
        style={[styles.toggleTrack, { backgroundColor: value ? c.brandGreen : c.border }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.toggleThumb, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
  );
}

/** Radio-style row (budget screen). */
export function RadioRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.radioRow,
        {
          backgroundColor: selected ? c.selected : c.surface,
          borderColor: selected ? c.selectedBorder : c.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Icon name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? c.primary : c.inkMuted} />
      <Text style={[type.body, { color: c.ink, flex: 1, fontWeight: selected ? '600' : '400' }]}>{label}</Text>
    </Pressable>
  );
}

function SquareTile({
  children,
  label,
  selected,
  onPress,
}: {
  children: ReactNode;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconTile,
        {
          backgroundColor: selected ? c.primary : c.surface,
          borderColor: selected ? c.primary : c.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {children}
      <Text numberOfLines={1} style={[type.tiny, { color: selected ? c.primaryText : c.ink }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Square tile with icon above label (where-are-you-eating row). */
export function IconTile({ icon, label, selected, onPress }: { icon: IconName; label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <SquareTile label={label} selected={selected} onPress={onPress}>
      <Icon name={icon} size={22} color={selected ? c.primaryText : c.ink} />
    </SquareTile>
  );
}

/** Emoji tile (how are you feeling). */
export function EmojiTile({ emoji, label, selected, onPress }: { emoji: string; label: string; selected: boolean; onPress: () => void }) {
  return (
    <SquareTile label={label} selected={selected} onPress={onPress}>
      <Text style={{ fontSize: 24 }} accessible={false}>
        {emoji}
      </Text>
    </SquareTile>
  );
}

// ---------- Display ----------

export function Tag({ label }: { label: string }) {
  const c = useColors();
  return (
    <View style={[styles.tag, { backgroundColor: c.tag }]}>
      <Text style={[type.tiny, { color: c.tagText }]}>{label}</Text>
    </View>
  );
}

export function Tags({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <View style={[styles.chips, { gap: space.xs }]}>
      {labels.map((l) => (
        <Tag key={l} label={l} />
      ))}
    </View>
  );
}

/** Food visual: illustrated tile until licensed photography is added. */
export function MealArt({ meal, variant = 'thumb' }: { meal: Pick<MealIdea, 'name' | 'cuisine'>; variant?: 'hero' | 'thumb' | 'small' }) {
  const size = {
    hero: { height: 180, emoji: 92, r: radius.lg },
    thumb: { height: 84, emoji: 42, r: radius.md },
    small: { height: 52, emoji: 26, r: radius.sm },
  }[variant];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LinearGradient
        colors={mealColors(meal)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          height: size.height,
          width: variant === 'hero' ? '100%' : size.height,
          borderRadius: size.r,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: size.emoji }}>{mealEmoji(meal)}</Text>
      </LinearGradient>
    </View>
  );
}

export function CheckRow({ text }: { text: string }) {
  const c = useColors();
  return (
    <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
      <View style={{ paddingTop: 2 }}>
        <Icon name="checkmark-circle" size={18} color={c.brandGreen} />
      </View>
      <Body style={{ flex: 1, fontSize: 15 }}>{text}</Body>
    </Row>
  );
}

export function StatCard({ value, label, icon }: { value: string; label: string; icon?: IconName }) {
  const c = useColors();
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      {icon ? <Icon name={icon} size={18} color={c.brandGreen} /> : null}
      <Text style={[type.title, { color: c.primary }]}>{value}</Text>
      <Text style={[type.tiny, { color: c.inkMuted, textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

export function ListRow({
  icon,
  label,
  onPress,
  right,
  a11yLabel,
}: {
  icon?: IconName;
  label: string;
  onPress: () => void;
  right?: ReactNode;
  a11yLabel?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.navRow, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.75 : 1 }]}
    >
      {icon ? <Icon name={icon} size={19} color={c.primary} /> : null}
      <Text style={[type.body, { color: c.ink, flex: 1, fontSize: 15 }]}>{label}</Text>
      {right ?? <Icon name="chevron-forward" size={18} color={c.inkMuted} />}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>{children}</View>;
}

export function Caution({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.caution, { backgroundColor: c.cautionBg }]} accessibilityRole="alert">
      <Text style={[type.small, { color: c.cautionText, fontWeight: '600' }]}>⚠︎ {children}</Text>
    </View>
  );
}

/** All safety notes for one meal in a single box, so they inform without burying the recommendation. */
export function Cautions({ items }: { items: string[] }) {
  const c = useColors();
  if (items.length === 0) return null;
  if (items.length === 1) return <Caution>{items[0]}</Caution>;
  return (
    <View style={[styles.caution, { backgroundColor: c.cautionBg, gap: space.xs }]} accessibilityRole="alert">
      <Text style={[type.small, { color: c.cautionText, fontWeight: '700' }]}>⚠︎ Before you eat</Text>
      {items.map((t) => (
        <Text key={t} style={[type.small, { color: c.cautionText, fontWeight: '600' }]}>
          • {t}
        </Text>
      ))}
    </View>
  );
}

/** Onboarding header: back chevron, progress bar, "n of N". */
export function ProgressHeader({ step, total, onBack }: { step: number; total: number; onBack?: () => void }) {
  const c = useColors();
  return (
    <Row gap={space.md}>
      {onBack ? <TextAction icon="chevron-back" a11yLabel="Back" onPress={onBack} /> : <View style={{ width: TOUCH }} />}
      <View
        style={[styles.progressTrack, { backgroundColor: c.border }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${step} of ${total}`}
        accessibilityValue={{ min: 0, max: total, now: step }}
      >
        <View style={{ width: `${(step / total) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: c.primary }} />
      </View>
      <Small>
        {step} of {total}
      </Small>
    </Row>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  footer: { padding: space.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: space.sm },
  button: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonBig: { minHeight: 56, borderRadius: radius.lg },
  chip: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  group: { gap: space.sm },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md },
  caution: { borderRadius: radius.sm, padding: space.md },
  textAction: { minHeight: TOUCH, minWidth: TOUCH, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.xs },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 72, borderRadius: radius.lg, borderWidth: 1.5 },
  iconBox: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  imageTile: { flex: 1, gap: space.xs, minWidth: 0 },
  imageTileArt: { aspectRatio: 1.1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  tileCheck: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 54, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1.5 },
  iconTile: {
    flex: 1,
    minHeight: 64,
    minWidth: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: space.sm,
    paddingHorizontal: 2,
  },
  tag: { paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
  statCard: { flex: 1, alignItems: 'center', gap: 2, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1 },
  toggleTrack: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
});
