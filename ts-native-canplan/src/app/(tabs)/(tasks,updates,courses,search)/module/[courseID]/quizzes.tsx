import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, SectionList, StyleSheet } from 'react-native';
import { useCanvas } from '../../../../../canvas/store';
import type { CanvasQuiz } from '../../../../../canvas/types';
import {
  CanvasRow,
  EmptyState,
  rowPosition,
  SectionHeader,
  usePullToRefresh,
} from '../../../../../ui/components';
import { useNow } from '../../../../../ui/format';
import { useTheme } from '../../../../../ui/theme';

type QuizSection = {
  key: 'upcoming' | 'past' | 'nodate';
  title: string;
  data: CanvasQuiz[];
};

export default function CourseQuizzesScreen() {
  const { courseID } = useLocalSearchParams<{ courseID: string }>();
  const { allCourses } = useCanvas();
  const { colors } = useTheme();
  const { pulling, onRefresh } = usePullToRefresh();
  const nowMs = useNow();

  const course = useMemo(
    () => allCourses.find((c) => String(c.courseID) === String(courseID)),
    [allCourses, courseID],
  );

  const sections = useMemo<QuizSection[]>(() => {
    const upcoming: CanvasQuiz[] = [];
    const past: CanvasQuiz[] = [];
    const noDate: CanvasQuiz[] = [];

    for (const q of course?.quizzes ?? []) {
      const refDate = q.due_at ?? q.lock_at ?? null;
      const ms = refDate ? new Date(refDate).getTime() : NaN;
      if (Number.isNaN(ms)) {
        noDate.push(q);
      } else if (ms >= nowMs) {
        upcoming.push(q);
      } else {
        past.push(q);
      }
    }

    upcoming.sort((a, b) => (a.due_at ?? a.lock_at ?? '').localeCompare(b.due_at ?? b.lock_at ?? ''));
    past.sort((a, b) => (b.due_at ?? b.lock_at ?? '').localeCompare(a.due_at ?? a.lock_at ?? ''));
    noDate.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));

    const out: QuizSection[] = [];
    if (upcoming.length > 0) out.push({ key: 'upcoming', title: 'Upcoming', data: upcoming });
    if (past.length > 0) out.push({ key: 'past', title: 'Past', data: past });
    if (noDate.length > 0) out.push({ key: 'nodate', title: 'No due date', data: noDate });
    return out;
  }, [course, nowMs]);

  if (!course) {
    return (
      <>
        <Stack.Screen options={{ title: 'Quizzes', headerLargeTitleEnabled: true }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="quiz"
            title="Course not found"
            description="This course may have been cleared from cache."
          />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Quizzes', headerLargeTitleEnabled: true }} />
      <SectionList
        sections={sections}
        keyExtractor={(q) => `q-${q.id}`}
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
        renderItem={({ item, index, section }) => {
          const isOverdue = section.key === 'past' && !!item.due_at;
          const extra =
            item.question_count !== undefined
              ? `${item.question_count} ${item.question_count === 1 ? 'question' : 'questions'}`
              : item.time_limit !== undefined && item.time_limit !== null
                ? `${item.time_limit} min`
                : undefined;

          return (
            <CanvasRow
              courseID={course.courseID}
              courseCode={course.code}
              kind="quiz"
              itemID={item.id}
              title={item.title}
              context="course"
              groupPosition={rowPosition(index, section.data.length)}
              rawDate={item.due_at}
              overdue={isOverdue}
              points={item.points_possible}
              metaExtra={extra}
              showConvertButton
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="quiz"
            title="No quizzes"
            description="Classic Canvas quizzes appear here. New Quizzes are listed under Assignments."
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
