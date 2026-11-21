import { router, Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCanvas } from '../../../canvas/store';
import {
  CanvasRow,
  EmptyState,
  FreshnessBar,
  HeaderIconButton,
  InsetGroup,
  RefreshHeaderButton,
  rowPosition,
  SectionHeader,
  TaskGroupHeaderRow,
  TaskRow,
  usePullToRefresh,
} from '../../../ui/components';
import { useNow } from '../../../ui/format';
import { Icon } from '../../../ui/Icon';
import {
  buildGroupProgressMap,
  getParentTaskProgress,
  groupTasksBySchedule,
  type TaskScheduleSection } from '../../../ui/taskGroups';
import { radii, spacing, useTheme } from '../../../ui/theme';

const FOURTEEN_DAYS_MS = 14 * 86_400_000;

export default function TasksScreen() {
  const { colors, typography } = useTheme();
  const { tasks, inbox, dismissInbox, taskForItem, deadline, refresh, refreshing } = useCanvas();
  const { pulling, onRefresh } = usePullToRefresh();
  const nowMs = useNow();
  const [showDone, setShowDone] = useState(false);
  const [dueSoonExpanded, setDueSoonExpanded] = useState(true);

  const dueSoon = useMemo(() => {
    const horizon = nowMs + FOURTEEN_DAYS_MS;
    return inbox.filter(({ assignment }) => {
      if (!assignment.due_at) return false;
      if (taskForItem('assignment', assignment.id)) return false;
      const ms = new Date(assignment.due_at).getTime();
      return !Number.isNaN(ms) && ms > nowMs && ms <= horizon;
    });
  }, [inbox, nowMs, taskForItem]);

  const doneCount = useMemo(() => tasks.filter((t) => t.done).length, [tasks]);
  const groupProgressMap = useMemo(() => buildGroupProgressMap(tasks), [tasks]);

  const sections = useMemo<TaskScheduleSection[]>(
    () => groupTasksBySchedule(tasks, deadline, nowMs, { includeDone: showDone }),
    [tasks, showDone, deadline, nowMs],
  );

  const header = (
    <View style={styles.headerStack}>
      <FreshnessBar />

      {dueSoon.length > 0 ? (
        <InsetGroup kind="canvas">
          <Pressable
            onPress={() => setDueSoonExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: dueSoonExpanded }}
            accessibilityLabel={`Canvas, due soon, ${dueSoon.length} ${dueSoon.length === 1 ? 'assignment' : 'assignments'}`}
            style={({ pressed }) => [styles.dueSoonHeader, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.dueSoonIcon, { backgroundColor: colors.surfaceSecondary }]}>
              <Icon name="assignment" size={14} color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodySemibold, { color: colors.text }]}>
                Due soon on Canvas
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {dueSoon.length} upcoming in next 14 days
              </Text>
            </View>
            <Icon
              name={dueSoonExpanded ? 'chevronUp' : 'chevronDown'}
              size={15}
              color={colors.textSecondary}
            />
          </Pressable>

          {dueSoonExpanded ? (
            <View>
              {dueSoon.map(({ course, assignment }) => (
                <CanvasRow
                  key={`${course.courseID}-${assignment.id}`}
                  courseID={course.courseID}
                  courseCode={course.code}
                  kind="assignment"
                  itemID={assignment.id}
                  title={assignment.name}
                  context="tasks"
                  groupPosition="grouped"
                  showTopSeparator
                  rawDate={assignment.due_at}
                  points={assignment.points_possible}
                  showConvertButton
                  onDismiss={() => dismissInbox(course, assignment)}
                />
              ))}
            </View>
          ) : null}
        </InsetGroup>
      ) : null}

      {doneCount > 0 ? (
        <Pressable
          onPress={() => setShowDone((v) => !v)}
          style={styles.toggleBar}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            showDone ? `Hide ${doneCount} done my tasks` : `Show ${doneCount} done my tasks`
          }
        >
          <Text style={[typography.footnote, { color: colors.accentText, fontWeight: '600' }]}>
            {showDone ? `Hide done (${doneCount})` : `Show done (${doneCount})`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <>
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="plus"
            accessibilityLabel="Add my task"
            onPress={() => router.push('/new-task')}
          />
          <Stack.Toolbar.Button
            icon="arrow.clockwise"
            accessibilityLabel="Refresh Canvas"
            disabled={refreshing}
            onPress={() => {
              refresh();
            }}
          />
        </Stack.Toolbar>
      ) : (
        <Stack.Screen
          options={{
            headerRight: () => (
              <View style={styles.headerRight}>
                <HeaderIconButton
                  icon="add"
                  label="Add my task"
                  onPress={() => router.push('/new-task')}
                />
                <RefreshHeaderButton />
              </View>
            ),
          }}
        />
      )}

      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <SectionHeader
            title={section.title}
            subtitle={`${section.data.length}`}
            tone={section.tone}
          />
        )}
        renderItem={({ item, index, section }) => {
          const parentProgress = getParentTaskProgress(item, groupProgressMap);
          const pos = rowPosition(index, section.data.length);
          return parentProgress ? (
            <TaskGroupHeaderRow
              task={item}
              progress={parentProgress}
              context="tasks"
              groupPosition={pos}
              inTodaySection={!!section.isToday}
            />
          ) : (
            <TaskRow
              task={item}
              context="tasks"
              groupPosition={pos}
              inTodaySection={!!section.isToday}
              indented={!!section.indentedIDs?.has(item.id)}
            />
          );
        }}
        ListFooterComponent={
          sections.length > 0 && tasks.length < 5 ? (
            <Text style={[typography.footnote, styles.tip, { color: colors.textTertiary }]}>
              Tap + Task on any Canvas item in Updates, Courses or Search to add it here.
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            icon="tasks"
            title={tasks.length > 0 ? 'All tasks done' : 'No tasks yet'}
            description={
              tasks.length > 0
                ? 'Toggle "Show done" above to review completed tasks, or add a new one.'
                : dueSoon.length > 0
                  ? 'Tap "+ Task" on a Canvas item above to make it actionable, or add your own task.'
                  : 'Convert any Canvas item into an actionable task, or tap + to create your own.'
            }
            actionLabel="Add my task"
            onAction={() => router.push('/new-task')}
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: spacing.sm,
  },
  headerStack: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  dueSoonContainer: {
    marginHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dueSoonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  dueSoonIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueSoonList: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  toggleBar: {
    alignSelf: 'flex-end',
    marginHorizontal: spacing.lg,
    paddingVertical: 4,
  },
  tip: {
    textAlign: 'center',
    paddingHorizontal: 32,
    paddingTop: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
  },
});
