import { useColorScheme } from 'react-native';

// Design tokens, matched to the EatOS design mockup: deep forest green, mint selection,
// soft green tags, near-white background. Every color, space, and type size comes from here.
// Contrast: ink/background, primaryText/primary and tagText/tag all meet WCAG AA (4.5:1).

const light = {
  background: '#FAFAF7',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F3EE',
  ink: '#16201A',
  inkMuted: '#5B655E',
  border: '#E3E6DF',
  primary: '#1F4D36',
  primaryPressed: '#173B29',
  primaryText: '#FFFFFF',
  /** Light green accent (splash "Get Started", success marks). */
  accent: '#A8D38A',
  accentText: '#0F2A1C',
  /** Mint selection background for option cards. */
  selected: '#E3F2DD',
  selectedBorder: '#7DBB79',
  tag: '#E5F1E0',
  tagText: '#2B5E37',
  brandGreen: '#4E9B5A',
  hero: '#0F3A28',
  heroText: '#FFFFFF',
  heroMuted: '#B9D3C3',
  cautionBg: '#FFF3DC',
  cautionText: '#6B4300',
  danger: '#A12A2A',
  tabInactive: '#59625B',
};

const dark: typeof light = {
  background: '#0F1411',
  surface: '#18201B',
  surfaceMuted: '#202923',
  ink: '#EEF2EC',
  inkMuted: '#A9B4AB',
  border: '#2C3830',
  primary: '#8FD19A',
  primaryPressed: '#A9DDB1',
  primaryText: '#0C2416',
  accent: '#A8D38A',
  accentText: '#0F2A1C',
  selected: '#1E3326',
  selectedBorder: '#5FA066',
  tag: '#1F3326',
  tagText: '#BFE3C4',
  brandGreen: '#7CC489',
  hero: '#0B2A1D',
  heroText: '#FFFFFF',
  heroMuted: '#A9C7B6',
  cautionBg: '#3A2E14',
  cautionText: '#F5D594',
  danger: '#F08A8A',
  tabInactive: '#8E988F',
};

export type Colors = typeof light;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;
export const type = {
  display: { fontSize: 56, lineHeight: 62, fontWeight: '700' as const, letterSpacing: -1.5 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  tiny: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const },
};
/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const TOUCH = 48;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
