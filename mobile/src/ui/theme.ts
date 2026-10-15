import { useColorScheme } from 'react-native';

// Design tokens. Every color, space, and type size in the app comes from here.
// Contrast: ink/background and primaryText/primary both exceed WCAG AA (4.5:1).

const light = {
  background: '#F7F5F1',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEBE4',
  ink: '#1D1C1A',
  inkMuted: '#5C5852',
  border: '#DDD7CD',
  primary: '#2D5A4C',
  primaryPressed: '#22463B',
  primaryText: '#FFFFFF',
  selected: '#DCE8E3',
  selectedBorder: '#2D5A4C',
  cautionBg: '#FFF3DC',
  cautionText: '#6B4300',
  danger: '#A12A2A',
};

const dark: typeof light = {
  background: '#141513',
  surface: '#1E201D',
  surfaceMuted: '#2A2C28',
  ink: '#F2EFEA',
  inkMuted: '#B4AFA6',
  border: '#3A3D37',
  primary: '#8CC5B0',
  primaryPressed: '#A6D6C4',
  primaryText: '#0F2620',
  selected: '#29413A',
  selectedBorder: '#8CC5B0',
  cautionBg: '#3A2E14',
  cautionText: '#F5D594',
  danger: '#F08A8A',
};

export type Colors = typeof light;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const type = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
};
/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const TOUCH = 48;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
