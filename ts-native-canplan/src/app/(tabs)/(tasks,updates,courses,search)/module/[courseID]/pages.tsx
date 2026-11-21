import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useCanvas } from '../../../../../canvas/store';
import { CanvasRow, EmptyState, rowPosition, usePullToRefresh } from '../../../../../ui/components';
import { spacing, useTheme } from '../../../../../ui/theme';

export default function CoursePagesScreen() {
  const { courseID } = useLocalSearchParams<{ courseID: string }>();
  const { allCourses } = useCanvas();
  const { colors } = useTheme();
  const { pulling, onRefresh } = usePullToRefresh();

  const course = useMemo(
    () => allCourses.find((c) => String(c.courseID) === String(courseID)),
    [allCourses, courseID],
  );

  const pages = useMemo(
    () =>
      [...(course?.pages ?? [])].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { numeric: true }),
      ),
    [course],
  );

  if (!course) {
    return (
      <>
        <Stack.Screen options={{ title: 'Pages', headerLargeTitleEnabled: true }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="page"
            title="Course not found"
            description="This course may have been cleared from cache."
          />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Pages', headerLargeTitleEnabled: true }} />
      <FlatList
        data={pages}
        keyExtractor={(p) => `p-${p.page_id}`}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={pages.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        renderItem={({ item, index }) => (
          <CanvasRow
            courseID={course.courseID}
            courseCode={course.code}
            kind="page"
            itemID={item.page_id}
            title={item.title}
            context="course"
            groupPosition={rowPosition(index, pages.length)}
            rawDate={item.updated_at}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="page"
            title="No pages"
            description="Wiki and syllabus pages appear here when enabled for this course."
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
