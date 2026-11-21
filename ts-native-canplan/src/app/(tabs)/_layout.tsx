import { NativeTabs } from 'expo-router/native-tabs';
import React from 'react';
import { DynamicColorIOS, Platform } from 'react-native';
import { useCanvas } from '../../canvas/store';
import { darkPalette, lightPalette, useTheme } from '../../ui/theme';

export default function MainTabsLayout() {
  const { colors } = useTheme();
  const { unseenCount } = useCanvas();

  const tintColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ light: lightPalette.accent, dark: darkPalette.accent })
      : colors.accent;

  const badgeText = unseenCount > 99 ? '99+' : String(unseenCount);

  return (
    <NativeTabs
      tintColor={tintColor}
      badgeBackgroundColor={colors.accent}
      badgeTextColor={colors.onAccent}
      backgroundColor={Platform.OS === 'android' ? colors.tabBarBg : undefined}
      indicatorColor={Platform.OS === 'android' ? colors.accentSoft : undefined}
      iconColor={
        Platform.OS === 'android'
          ? { default: colors.textTertiary, selected: colors.accent }
          : undefined
      }
      labelStyle={
        Platform.OS === 'android'
          ? {
              default: { color: colors.textTertiary },
              selected: { color: colors.accent },
            }
          : undefined
      }
    >
      <NativeTabs.Trigger name="(tasks)" accessibilityLabel="My tasks">
        <NativeTabs.Trigger.Icon sf="checklist" md="checklist" />
        <NativeTabs.Trigger.Label>Tasks</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="(updates)"
        accessibilityLabel={
          unseenCount > 0 ? `Canvas updates, ${unseenCount} unread` : 'Canvas updates'
        }
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bell', selected: 'bell.fill' }}
          md="notifications"
        />
        <NativeTabs.Trigger.Label>Updates</NativeTabs.Trigger.Label>
        {/* The native badge ignores `hidden`, so render it only when something is unread. */}
        {unseenCount > 0 ? <NativeTabs.Trigger.Badge>{badgeText}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(courses)" accessibilityLabel="Canvas courses">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}
          md="grid_view"
        />
        <NativeTabs.Trigger.Label>Courses</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger
        name="(search)"
        role="search"
        accessibilityLabel="Search my tasks and Canvas"
      >
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
