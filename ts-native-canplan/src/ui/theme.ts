import { DarkTheme, DefaultTheme, type Theme as NavTheme } from '@react-navigation/native';
import { useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  largeTitle: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.2 },
  headline: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, lineHeight: 21, fontWeight: '500' as const },
  bodySemibold: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  subhead: { fontSize: 14, lineHeight: 19, fontWeight: '400' as const },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.2 },
} as const;

export type Palette = {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceSecondary: string;
  /** Flat tinted slate surface used exclusively for Canvas rows/cards to distinguish from Mine. */
  canvasSurface: string;
  canvasBorder: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  separator: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  onAccent: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  highlightBg: string;
  tabBarBg: string;
  navBg: string;
  pressed: string;
};

export const lightPalette: Palette = {
  dark: false,
  bg: '#F4F5F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FAFBFC',
  surfaceSecondary: '#E4E9F1',
  canvasSurface: '#ECEFF5',
  canvasBorder: '#DCE2EC',
  text: '#111827',
  textSecondary: '#545F70',
  textTertiary: '#7B8596',
  border: '#E1E6EE',
  separator: '#E7EBF1',
  accent: '#0A5FD6',
  accentSoft: 'rgba(10, 95, 214, 0.11)',
  accentText: '#0A5FD6',
  onAccent: '#FFFFFF',
  warning: '#B45309',
  warningSoft: 'rgba(217, 119, 6, 0.14)',
  danger: '#C62828',
  dangerSoft: 'rgba(198, 40, 40, 0.11)',
  success: '#157A3D',
  successSoft: 'rgba(21, 122, 61, 0.12)',
  highlightBg: 'rgba(250, 204, 21, 0.42)',
  tabBarBg: '#FFFFFF',
  navBg: '#F4F5F7',
  pressed: 'rgba(17, 24, 39, 0.05)',
};

export const darkPalette: Palette = {
  dark: true,
  bg: '#0B0E14',
  surface: '#171D28',
  surfaceElevated: '#1F2634',
  surfaceSecondary: '#252E3E',
  canvasSurface: '#121720',
  canvasBorder: '#202836',
  text: '#F3F5F8',
  textSecondary: '#9CA6B5',
  textTertiary: '#748092',
  border: '#283142',
  separator: '#222A38',
  accent: '#4E9BFF',
  accentSoft: 'rgba(78, 155, 255, 0.18)',
  accentText: '#72B0FF',
  onAccent: '#081220',
  warning: '#F5A623',
  warningSoft: 'rgba(245, 166, 35, 0.18)',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.18)',
  success: '#34D399',
  successSoft: 'rgba(52, 211, 153, 0.18)',
  highlightBg: 'rgba(250, 204, 21, 0.32)',
  tabBarBg: '#11161F',
  navBg: '#0B0E14',
  pressed: 'rgba(255, 255, 255, 0.06)',
};

export function useTheme() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkPalette : lightPalette;

  const navTheme = useMemo<NavTheme>(() => {
    const base = colors.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: colors.dark,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.bg,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [colors]);

  return {
    colors,
    navTheme,
    spacing,
    radii,
    typography,
    hairline: Platform.OS === 'ios' ? 0.5 : 1,
  };
}
