import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useCanvas } from '../../../../../canvas/store';
import { stripHTML } from '../../../../../canvas/types';
import { CanvasRow, EmptyState, rowPosition, usePullToRefresh } from '../../../../../ui/components';
import { spacing, useTheme } from '../../../../../ui/theme';

export default function CourseDiscussionsScreen() {
  const { courseID } = useLocalSearchParams<{ courseID: string }>();
  const { allCourses } = useCanvas();
  const { colors } = useTheme();
  const { pulling, onRefresh } = usePullToRefresh();

  const course = useMemo(
    () => allCourses.find((c) => String(c.courseID) === String(courseID)),
    [allCourses, courseID],
  );

  const discussions = useMemo(
    () =>
      [...(course?.discussions ?? [])].sort((a, b) =>
        (b.last_reply_at ?? b.posted_at ?? '').localeCompare(a.last_reply_at ?? a.posted_at ?? ''),
      ),
    [course],
  );

  if (!course) {
    return (
      <>
        <Stack.Screen options={{ title: 'Discussions', headerLargeTitleEnabled: true }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="discussion"
            title="Course not found"
            description="This course may have been cleared from cache."
          />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Discussions', headerLargeTitleEnabled: true }} />
      <FlatList
        data={discussions}
        keyExtractor={(d) => `d-${d.id}`}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={
          discussions.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        renderItem={({ item, index }) => {
          const replyCount = item.discussion_subentry_count ?? 0;
          const replyLabel =
            replyCount === 0
              ? 'No replies'
              : `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;

          return (
            <CanvasRow
              courseID={course.courseID}
              courseCode={course.code}
              kind="discussion"
              itemID={item.id}
              title={item.title}
              context="course"
              groupPosition={rowPosition(index, discussions.length)}
              rawDate={item.last_reply_at ?? item.posted_at}
              metaExtra={replyLabel}
              preview={stripHTML(item.message)}
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="discussion"
            title="No discussions"
            description="Course discussion topics appear here when available."
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
