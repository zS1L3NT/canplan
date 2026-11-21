import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, SectionList, StyleSheet } from 'react-native';
import { useCanvas } from '../../../../../canvas/store';
import type { CanvasAssignment } from '../../../../../canvas/types';
import {
  CanvasRow,
  EmptyState,
  rowPosition,
  SectionHeader,
  usePullToRefresh,
} from '../../../../../ui/components';
import { useNow } from '../../../../../ui/format';
import { useTheme } from '../../../../../ui/theme';

type AssignmentSection = {
  key: 'upcoming' | 'past' | 'nodate';
  title: string;
  data: CanvasAssignment[];
};

export default function CourseAssignmentsScreen() {
  const { courseID } = useLocalSearchParams<{ courseID: string }>();
  const { allCourses } = useCanvas();
  const { colors } = useTheme();
  const { pulling, onRefresh } = usePullToRefresh();
  const nowMs = useNow();

  const course = useMemo(
    () => allCourses.find((c) => String(c.courseID) === String(courseID)),
    [allCourses, courseID],
  );

  const sections = useMemo<AssignmentSection[]>(() => {
    const upcoming: CanvasAssignment[] = [];
    const past: CanvasAssignment[] = [];
    const noDate: CanvasAssignment[] = [];

    for (const a of course?.assignments ?? []) {
      const ms = a.due_at ? new Date(a.due_at).getTime() : NaN;
      if (Number.isNaN(ms)) {
        noDate.push(a);
      } else if (ms >= nowMs) {
        upcoming.push(a);
      } else {
        past.push(a);
      }
    }

    upcoming.sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''));
    past.sort((a, b) => (b.due_at ?? '').localeCompare(a.due_at ?? ''));
    noDate.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const out: AssignmentSection[] = [];
    if (upcoming.length > 0) out.push({ key: 'upcoming', title: 'Upcoming', data: upcoming });
    if (past.length > 0) out.push({ key: 'past', title: 'Past', data: past });
    if (noDate.length > 0) out.push({ key: 'nodate', title: 'No due date', data: noDate });
    return out;
  }, [course, nowMs]);

  if (!course) {
    return (
      <>
        <Stack.Screen options={{ title: 'Assignments', headerLargeTitleEnabled: true }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="assignment"
            title="Course not found"
            description="This course may have been cleared from cache."
          />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Assignments', headerLargeTitleEnabled: true }} />
      <SectionList
        sections={sections}
        keyExtractor={(a) => `a-${a.id}`}
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} subtitle={`${section.data.length}`} />
        )}
        renderItem={({ item, index, section }) => (
          <CanvasRow
            courseID={course.courseID}
            courseCode={course.code}
            kind="assignment"
            itemID={item.id}
            title={item.name}
            context="course"
            groupPosition={rowPosition(index, section.data.length)}
            rawDate={item.due_at}
            overdue={section.key === 'past'}
            points={item.points_possible}
            showConvertButton
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="assignment"
            title="No assignments"
            description="Graded tasks and quizzes for this module will appear here."
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 28,
  },
  emptyContainer: {
    flexGrow: 1,
  },
});
