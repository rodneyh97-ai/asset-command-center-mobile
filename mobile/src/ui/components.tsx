import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, space, TOUCH, type, useColors } from './theme';

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[type.title, { color: c.ink }]}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[type.heading, { color: c.ink }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const c = useColors();
  return <Text style={[type.body, { color: muted ? c.inkMuted : c.ink }, style]}>{children}</Text>;
}

export function Small({ children, muted = true }: { children: ReactNode; muted?: boolean }) {
  const c = useColors();
  return <Text style={[type.small, { color: muted ? c.inkMuted : c.ink }]}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  hint,
  disabled,
  big,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  hint?: string;
  disabled?: boolean;
  big?: boolean;
}) {
  const c = useColors();
  const bg = { primary: c.primary, secondary: c.surface, ghost: 'transparent', danger: 'transparent' }[variant];
  const fg = { primary: c.primaryText, secondary: c.ink, ghost: c.primary, danger: c.danger }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
      <Text style={[big ? type.heading : type.label, { color: fg, textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
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
        styles.chip,
        {
          backgroundColor: selected ? c.selected : c.surface,
          borderColor: selected ? c.selectedBorder : c.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[type.label, { color: c.ink }]}>{selected ? `✓ ${label}` : label}</Text>
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
}: {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? <Small muted={false}>{label}</Small> : null}
      <View style={styles.chips}>
        {options.map((o) => (
          <Chip key={String(o.value)} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
        ))}
      </View>
    </View>
  );
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
  const toggle = (v: T) => {
    if (v === exclusive) return onChange(value.includes(v) ? [] : [v]);
    const next = value.includes(v) ? value.filter((x) => x !== v) : [...value.filter((x) => x !== exclusive), v];
    onChange(next);
  };
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={value.includes(o.value)} onPress={() => toggle(o.value)} />
      ))}
    </View>
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

export function Gap({ size = space.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
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
  buttonBig: { minHeight: 64, borderRadius: radius.lg },
  chip: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  group: { gap: space.sm },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md },
  caution: { borderRadius: radius.sm, padding: space.md },
});
