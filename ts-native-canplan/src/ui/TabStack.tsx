import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useTheme } from './theme';

export function TabStack({
  rootName,
  rootTitle,
}: {
  rootName: string;
  rootTitle: string;
}) {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        headerLargeTitleStyle: { color: colors.text },
        headerBackButtonDisplayMode: 'default',
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
      <Stack.Screen
        name={rootName}
        options={{
          title: rootTitle,
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="task/[taskID]"
        options={{
          title: 'My task',
          headerLargeTitleEnabled: false,
        }}
      />
      <Stack.Screen
        name="module/[courseID]/index"
        options={{
          title: 'Course',
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="module/[courseID]/modules"
        options={{
          title: 'Modules',
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="module/[courseID]/files/index"
        options={{
          title: 'Files',
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="module/[courseID]/files/[folderID]"
        options={{
          title: 'Folder',
          headerLargeTitleEnabled: false,
        }}
      />
      <Stack.Screen
        name="module/[courseID]/announcements"
        options={{
          title: 'Announcements',
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="module/[courseID]/assignments"
        options={{
          title: 'Assignments',
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="module/[courseID]/pages"
        options={{
          title: 'Pages',
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="module/[courseID]/quizzes"
        options={{
          title: 'Quizzes',
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="module/[courseID]/discussions"
        options={{
          title: 'Discussions',
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="module/[courseID]/syllabus"
        options={{
          title: 'Syllabus',
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="module/[courseID]/grades"
        options={{
          title: 'Grades',
          headerLargeTitleEnabled: true,
        }}
      />
      <Stack.Screen
        name="canvas/[kind]/[courseID]/[itemID]"
        options={{
          title: 'Canvas',
          headerLargeTitleEnabled: false,
        }}
      />
    </Stack>
  );
}
