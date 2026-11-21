import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SearchBarCommands } from 'react-native-screens';
import { dayKey, useCanvas } from '../canvas/store';
import type { FeedKind, PlannerTask, SourceRef } from '../canvas/types';
import {
  EmptyState,
  HighlightedText,
  kindIconName,
  SectionHeader,
} from '../ui/components';
import { extractQueryTerms, formatDueText, useNow } from '../ui/format';
import { Icon } from '../ui/Icon';
import { groupTasksBySchedule, type TaskScheduleSection } from '../ui/taskGroups';
import { radii, spacing, useTheme } from '../ui/theme';

function isFeedKind(v: string | undefined): v is FeedKind {
  return (
    v === 'announcement' ||
    v === 'assignment' ||
    v === 'file' ||
    v === 'page' ||
    v === 'quiz' ||
    v === 'discussion'
  );
}

function sameRef(a?: SourceRef, b?: SourceRef): boolean {
  return !!a && !!b && a.courseID === b.courseID && a.kind === b.kind && a.itemID === b.itemID;
}

export default function TaskPickerModal() {
  const params = useLocalSearchParams<{
    courseID: string;
    kind: string;
    itemID: string;
    title?: string;
  }>();
  const { colors, typography } = useTheme();
  const { tasks, allCourses, deadline, linkItem, unlinkItem, locationOf } = useCanvas();
  const nowMs = useNow();
  const searchBarRef = useRef<SearchBarCommands>(null);
  const [query, setQuery] = useState('');

  const courseID = Number(params.courseID);
  const itemID = Number(params.itemID);
  const kind = isFeedKind(params.kind) ? params.kind : null;

  const ref = useMemo<SourceRef | null>(
    () => (kind && !Number.isNaN(courseID) && !Number.isNaN(itemID) ? { courseID, kind, itemID } : null),
    [kind, courseID, itemID],
  );

  const course = useMemo(
    () => allCourses.find((c) => c.courseID === courseID),
    [allCourses, courseID],
  );

  const itemTitle = useMemo(() => {
    if (params.title) return params.title;
    if (!course || !kind) return '';
    if (kind === 'assignment') return course.assignments.find((x) => x.id === itemID)?.name ?? '';
    if (kind === 'announcement') return course.announcements.find((x) => x.id === itemID)?.title ?? '';
    if (kind === 'file') return course.files.find((x) => x.id === itemID)?.display_name ?? '';
    if (kind === 'quiz') return course.quizzes?.find((x) => x.id === itemID)?.title ?? '';
    if (kind === 'discussion') return course.discussions?.find((x) => x.id === itemID)?.title ?? '';
    return course.pages.find((x) => x.page_id === itemID)?.title ?? '';
  }, [params.title, course, kind, itemID]);

  const itemBreadcrumb = useMemo(() => {
    if (!ref) return '';
    const loc = locationOf(ref.courseID, ref.kind, ref.itemID);
    return ['Canvas', course?.code, ...loc].filter(Boolean).join(' › ');
  }, [ref, course?.code, locationOf]);

  const trimmed = query.trim();
  const terms = useMemo(() => extractQueryTerms(trimmed), [trimmed]);

  const openTasks = useMemo(() => {
    const base = tasks.filter((t) => !t.done);
    if (!trimmed) return base;
    const q = trimmed.toLowerCase();
    return base.filter((t) => {
      if (t.title.toLowerCase().includes(q)) return true;
      if (t.courseCode?.toLowerCase().includes(q)) return true;
      if (t.group?.toLowerCase().includes(q)) return true;
      if (t.notes?.toLowerCase().includes(q)) return true;
      return t.subtasks.some((st) => st.title.toLowerCase().includes(q));
    });
  }, [tasks, trimmed]);

  const sections = useMemo<TaskScheduleSection[]>(() => {
    if (!course) {
      return groupTasksBySchedule(openTasks, deadline, nowMs, {
        includeDone: false,
        titlePrefix: 'My tasks',
      });
    }
    const thisModule: PlannerTask[] = [];
    const others: PlannerTask[] = [];
    for (const t of openTasks) {
      if (t.courseCode === course.code || t.source?.courseID === course.courseID) {
        thisModule.push(t);
      } else {
        others.push(t);
      }
    }
    const moduleSections = groupTasksBySchedule(thisModule, deadline, nowMs, {
      includeDone: false,
      titlePrefix: course.code,
    });
    const otherSections = groupTasksBySchedule(others, deadline, nowMs, {
      includeDone: false,
      titlePrefix: thisModule.length > 0 ? 'Other tasks' : 'My tasks',
    });
    return [...moduleSections, ...otherSections];
  }, [openTasks, course, deadline, nowMs]);

  const dismissKeyboard = useCallback(() => {
    searchBarRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const handleDone = useCallback(() => {
    dismissKeyboard();
    router.back();
  }, [dismissKeyboard]);

  const getLinkState = useCallback(
    (task: PlannerTask): 'source' | 'linked' | false => {
      if (!ref) return false;
      if (sameRef(task.source, ref)) return 'source';
      if ((task.links ?? []).some((l) => sameRef(l, ref))) return 'linked';
      return false;
    },
    [ref],
  );

  const toggleTask = useCallback(
    (task: PlannerTask) => {
      if (!ref) return;
      if (getLinkState(task)) {
        unlinkItem(task.id, ref);
      } else {
        linkItem(task.id, ref);
      }
    },
    [ref, getLinkState, unlinkItem, linkItem],
  );

  if (!ref) {
    return (
      <>
        <Stack.Screen options={{ title: 'Link to a task' }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="link"
            title="Canvas item not found"
            description="Could not determine which Canvas item to link."
            actionLabel="Done"
            onAction={() => router.back()}
          />
        </ScrollView>
      </>
    );
  }

  const todayStr = dayKey(new Date(nowMs));

  return (
    <>
      <Stack.SearchBar
        ref={searchBarRef}
        placement="automatic"
        placeholder="Search open tasks…"
        autoCapitalize="none"
        hideWhenScrolling={false}
        obscureBackground={false}
        tintColor={colors.accent}
        textColor={colors.text}
        hintTextColor={colors.textTertiary}
        headerIconColor={colors.accent}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        onSearchButtonPress={() => dismissKeyboard()}
        onCancelButtonPress={() => setQuery('')}
        onClose={() => setQuery('')}
      />

      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button variant="done" onPress={handleDone}>
            Done
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : (
        <Stack.Screen
          options={{
            title: 'Link to a task',
            headerRight: () => (
              <Pressable
                onPress={handleDone}
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => ({ paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={[typography.bodySemibold, { color: colors.accent }]}>Done</Text>
              </Pressable>
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
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          <View
            style={[
              styles.itemBanner,
              { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
              <Icon name={kindIconName(ref.kind)} size={15} color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                {itemBreadcrumb}
              </Text>
              {itemTitle ? (
                <Text style={[typography.subhead, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
                  {itemTitle}
                </Text>
              ) : null}
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <SectionHeader
            title={section.title}
            subtitle={`${section.data.length}`}
            tone={section.tone}
          />
        )}
        renderItem={({ item: task }) => {
          const linkState = getLinkState(task);
          const due = deadline(task);
          const dueText = due ? formatDueText(due, nowMs) : null;
          const plannedToday = task.workDays.includes(todayStr);

          return (
            <Pressable
              onPress={() => toggleTask(task)}
              accessibilityRole="button"
              accessibilityState={{ selected: !!linkState }}
              accessibilityLabel={`My task, ${task.title}${linkState ? `, ${linkState}` : ''}`}
              style={({ pressed }) => [
                styles.taskRowCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: linkState ? colors.accent : colors.border,
                },
                pressed && { opacity: 0.72 },
              ]}
            >
              <View style={styles.rowBody}>
                <HighlightedText
                  text={task.title}
                  terms={terms}
                  style={[typography.body, { color: colors.text }]}
                  numberOfLines={2}
                />
                <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                  {[
                    task.courseCode,
                    task.group,
                    dueText,
                    plannedToday && !dueText ? 'Today' : null,
                  ]
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(' · ')}
                </Text>
              </View>

              {linkState ? (
                <View style={[styles.linkedPill, { backgroundColor: colors.accentSoft }]}>
                  <Icon name="check" size={12} color={colors.accentText} />
                  <Text style={[typography.caption, { color: colors.accentText, fontWeight: '600' }]}>
                    {linkState === 'source' ? 'Source' : 'Linked'}
                  </Text>
                </View>
              ) : (
                <Icon name="circle" size={18} color={colors.border} />
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="tasks"
            title={trimmed ? `No open tasks matching "${trimmed}"` : 'No open tasks'}
            description={
              trimmed
                ? 'Try a different search keyword.'
                : 'Create a task first, or use "Add to My Tasks" on the Canvas item.'
            }
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 32,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  itemBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  taskRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginVertical: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  linkedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    flexShrink: 0,
  },
});
