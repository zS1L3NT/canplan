import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from '../state/AppState';
import { useTheme } from '../ui/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const { colors, navTheme } = useTheme();

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={colors.dark ? 'light' : 'dark'} />
      <AppStateProvider>
        <Stack
          screenOptions={{
            headerTintColor: colors.accent,
            headerTitleStyle: { color: colors.text, fontWeight: '600' },
            contentStyle: { backgroundColor: colors.bg },
            ...(Platform.OS === 'ios'
              ? {
                  headerTransparent: true,
                }
              : {
                  headerStyle: { backgroundColor: colors.navBg },
                  headerShadowVisible: false,
                }),
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="new-task"
            options={{
              title: 'New task',
              presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
              sheetAllowedDetents: [0.85, 1],
              sheetInitialDetentIndex: 0,
              sheetGrabberVisible: true,
              sheetExpandsWhenScrolledToEdge: true,
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              title: 'Settings',
              presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
              sheetAllowedDetents: [1],
              sheetGrabberVisible: true,
              headerTransparent: false,
              headerStyle: { backgroundColor: colors.navBg },
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="link-picker"
            options={{
              title: 'Link Canvas item',
              presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
              sheetAllowedDetents: [0.9, 1],
              sheetInitialDetentIndex: 1,
              sheetGrabberVisible: true,
              sheetExpandsWhenScrolledToEdge: true,
            }}
          />
          <Stack.Screen
            name="task-picker"
            options={{
              title: 'Link to a task',
              presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
              sheetAllowedDetents: [0.9, 1],
              sheetInitialDetentIndex: 1,
              sheetGrabberVisible: true,
              sheetExpandsWhenScrolledToEdge: true,
            }}
          />
        </Stack>
      </AppStateProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
