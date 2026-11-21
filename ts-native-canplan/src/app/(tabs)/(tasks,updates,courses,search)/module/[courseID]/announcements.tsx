import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useCanvas } from '../../../../../canvas/store';
import { stripHTML } from '../../../../../canvas/types';
import { CanvasRow, EmptyState, rowPosition, usePullToRefresh } from '../../../../../ui/components';
import { spacing, useTheme } from '../../../../../ui/theme';

export default function CourseAnnouncementsScreen() {
  const { courseID } = useLocalSearchParams<{ courseID: string }>();
  const { allCourses } = useCanvas();
  const { colors } = useTheme();
  const { pulling, onRefresh } = usePullToRefresh();

  const course = useMemo(
    () => allCourses.find((c) => String(c.courseID) === String(courseID)),
    [allCourses, courseID],
  );

  const announcements = useMemo(
    () =>
      [...(course?.announcements ?? [])].sort((a, b) =>
        (b.posted_at ?? '').localeCompare(a.posted_at ?? ''),
      ),
    [course],
  );

  if (!course) {
    return (
      <>
        <Stack.Screen options={{ title: 'Announcements', headerLargeTitleEnabled: true }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="announcement"
            title="Course not found"
            description="This course may have been cleared from cache."
          />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Announcements', headerLargeTitleEnabled: true }} />
      <FlatList
        data={announcements}
        keyExtractor={(a) => `n-${a.id}`}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={
          announcements.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        renderItem={({ item, index }) => (
          <CanvasRow
            courseID={course.courseID}
            courseCode={course.code}
            kind="announcement"
            itemID={item.id}
            title={item.title}
            context="course"
            groupPosition={rowPosition(index, announcements.length)}
            rawDate={item.posted_at}
            preview={stripHTML(item.message)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="announcement"
            title="No announcements"
            description="Course announcements for this module will appear here."
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: 28,
  },
  emptyContainer: {
    flexGrow: 1,
  },
});
