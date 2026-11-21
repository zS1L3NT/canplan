import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCanvas } from '../../../../../canvas/store';
import { useDesignVariant } from '../../../../../state/AppState';
import {
  CanvasLeadingGlyph,
  EmptyState,
  HeaderIconButton,
  InsetGroup,
  openExternalUrl,
  SectionHeader,
  TaskGroupHeaderRow,
  TaskRow,
  usePullToRefresh,
} from '../../../../../ui/components';
import {
  buildCourseNavigation,
  type CourseSectionNavRow,
  type InAppSectionId,
} from '../../../../../ui/courseTabs';
import { cleanCourseName } from '../../../../../ui/format';
import { Icon } from '../../../../../ui/Icon';
import { buildGroupProgressMap, compareTasks, getParentTaskProgress } from '../../../../../ui/taskGroups';
import { radii, spacing, useTheme } from '../../../../../ui/theme';

export default function ModuleHomeScreen() {
  const { courseID } = useLocalSearchParams<{ courseID: string }>();
  const { allCourses, tasks, isHidden, setHidden, folderContents, deadline } = useCanvas();
  const { colors, typography, hairline } = useTheme();
  const { spec } = useDesignVariant();
  const { pulling, onRefresh } = usePullToRefresh();
  const [moreExpanded, setMoreExpanded] = useState(false);

  const course = useMemo(
    () => allCourses.find((c) => String(c.courseID) === String(courseID)),
    [allCourses, courseID],
  );

  const groupProgressMap = useMemo(() => buildGroupProgressMap(tasks), [tasks]);

  const moduleTasks = useMemo(() => {
    if (!course) return [];
    return tasks
      .filter((t) => t.source?.courseID === course.courseID || t.courseCode === course.code)
      .sort(compareTasks(deadline));
  }, [tasks, course, deadline]);

  const { primaryRows, moreRows } = useMemo(() => {
    if (!course) return { primaryRows: [], moreRows: [] };
    const rootFolder = folderContents(course.courseID);
    const onNavigate = (section: InAppSectionId) => {
      router.push(`/module/${course.courseID}/${section}`);
    };
    return buildCourseNavigation(course, rootFolder, onNavigate, openExternalUrl);
  }, [course, folderContents]);

  if (!course) {
    return (
      <>
        <Stack.Screen options={{ title: 'Course', headerLargeTitleEnabled: true }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="modules"
            title="Course not found"
            description="This course may have been cleared from cache."
          />
        </ScrollView>
      </>
    );
  }

  const hidden = isHidden(course.courseID);
  const cleanedName = cleanCourseName(course.code, course.name);

  const renderNavRow = (row: CourseSectionNavRow, idx: number, showTopBorder = idx > 0) => {
    const detail = row.detail;
    const detailIsSubtitle = !!detail && (row.disabled || detail.includes(' '));
    const detailIsTrailing = !!detail && !detailIsSubtitle;

    return (
      <View key={row.id}>
        {showTopBorder ? (
          <View
            style={{
              height: hairline,
              marginLeft: spec.canvasSeparatorInset,
              backgroundColor: colors.separator,
            }}
          />
        ) : null}
        <Pressable
          onPress={row.onPress}
          disabled={row.disabled}
          accessibilityRole="button"
          accessibilityLabel={row.a11yLabel}
          accessibilityState={{ disabled: !!row.disabled }}
          style={({ pressed }) => [
            styles.navRow,
            { paddingVertical: spec.rowPaddingV },
            pressed && !row.disabled && { opacity: 0.7 },
            row.disabled && { opacity: 0.58 },
          ]}
        >
          <CanvasLeadingGlyph icon={row.icon} dimmed={row.disabled} />

          <View style={styles.navRowBody}>
            <Text
              style={{
                fontSize: spec.titleSize,
                lineHeight: spec.titleLineHeight,
                fontWeight: '500',
                color: row.disabled ? colors.textSecondary : colors.text,
              }}
              numberOfLines={1}
            >
              {row.label}
            </Text>
            {detailIsSubtitle ? (
              <Text
                style={[
                  typography.caption,
                  { color: row.disabled ? colors.textTertiary : colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {detail}
              </Text>
            ) : null}
          </View>

          {detailIsTrailing ? (
            <Text style={[typography.subhead, { color: colors.textSecondary }]}>{detail}</Text>
          ) : null}

          {!row.disabled ? (
            row.external ? (
              <Text
                style={[typography.bodySemibold, { color: colors.textTertiary }]}
                importantForAccessibility="no"
              >
                ↗
              </Text>
            ) : (
              <Icon name="chevronRight" size={14} color={colors.textTertiary} />
            )
          ) : null}
        </Pressable>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: course.code,
          headerLargeTitleEnabled: true,
          ...(Platform.OS !== 'ios'
            ? {
                headerRight: () => (
                  <HeaderIconButton
                    icon={hidden ? 'eye' : 'eyeOff'}
                    label={hidden ? `Canvas, unhide ${course.code}` : `Canvas, hide ${course.code}`}
                    onPress={() => setHidden(course.courseID, !hidden)}
                  />
                ),
              }
            : {}),
        }}
      />
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={hidden ? 'eye' : 'eye.slash'}
            accessibilityLabel={
              hidden ? `Canvas, unhide ${course.code}` : `Canvas, hide ${course.code}`
            }
            onPress={() => setHidden(course.courseID, !hidden)}
          />
        </Stack.Toolbar>
      ) : null}

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Course identity header (cleaned name + term; nav title already has course code) */}
        {cleanedName || course.term || hidden ? (
          <View style={styles.courseMetaHeader}>
            {cleanedName ? (
              <Text style={[typography.bodyMedium, { color: colors.text }]}>{cleanedName}</Text>
            ) : null}
            {course.term ? (
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {course.term}
              </Text>
            ) : null}
            {hidden ? (
              <View style={[styles.hiddenNotice, { backgroundColor: colors.surfaceSecondary }]}>
                <Icon name="eyeOff" size={14} color={colors.textSecondary} />
                <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
                  Hidden from Updates and Search
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Canvas course navigation grouped list (mirrors course.tabs in Canvas order) */}
        {primaryRows.length > 0 ? (
          <>
            <SectionHeader title="Course" />
            <InsetGroup kind="canvas">
              {primaryRows.map((row, idx) => renderNavRow(row, idx))}
            </InsetGroup>
          </>
        ) : null}

        {/* Collapsed "More in Canvas" group for low-value-on-phone tabs */}
        {moreRows.length > 0 ? (
          <InsetGroup kind="canvas" style={styles.moreGroupCard}>
            <Pressable
              onPress={() => setMoreExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: moreExpanded }}
              accessibilityLabel={`More in Canvas, ${moreRows.length} items`}
              style={({ pressed }) => [
                styles.navRow,
                { paddingVertical: spec.rowPaddingV },
                pressed && { opacity: 0.7 },
              ]}
            >
              <CanvasLeadingGlyph icon="more" />
              <View style={styles.navRowBody}>
                <Text
                  style={{
                    fontSize: spec.titleSize,
                    lineHeight: spec.titleLineHeight,
                    fontWeight: '500',
                    color: colors.text,
                  }}
                >
                  More in Canvas
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                  {moreRows.map((r) => r.label).join(' · ')}
                </Text>
              </View>
              <Text style={[typography.subhead, { color: colors.textSecondary }]}>
                {moreRows.length}
              </Text>
              <Icon
                name={moreExpanded ? 'chevronUp' : 'chevronDown'}
                size={14}
                color={colors.textTertiary}
              />
            </Pressable>

            {moreExpanded ? moreRows.map((row, idx) => renderNavRow(row, idx, true)) : null}
          </InsetGroup>
        ) : null}

        {/* Your tasks for this module (Mine grammar) */}
        <SectionHeader
          title="Your tasks"
          tone="accent"
          right={
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/new-task',
                  params: { courseCode: course.code },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`My task, add new task for ${course.code}`}
              hitSlop={8}
              style={({ pressed }) => [
                styles.miniAddBtn,
                { backgroundColor: colors.accentSoft },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon name="add" size={12} color={colors.accentText} />
              <Text style={[typography.caption, { color: colors.accentText, fontWeight: '600' }]}>
                Add
              </Text>
            </Pressable>
          }
        />

        {moduleTasks.length === 0 ? (
          <InsetGroup kind="mine">
            <View style={styles.noTasksInner}>
              <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                No tasks for {course.code} yet. Add your own or turn any Canvas item into a task.
              </Text>
            </View>
          </InsetGroup>
        ) : (
          <InsetGroup kind="mine">
            {moduleTasks.map((t, idx) => {
              const parentProgress = getParentTaskProgress(t, groupProgressMap);
              return parentProgress ? (
                <TaskGroupHeaderRow
                  key={t.id}
                  task={t}
                  progress={parentProgress}
                  context="course"
                  groupPosition="grouped"
                  showTopSeparator={idx > 0}
                />
              ) : (
                <TaskRow
                  key={t.id}
                  task={t}
                  context="course"
                  groupPosition="grouped"
                  showTopSeparator={idx > 0}
                />
              );
            })}
          </InsetGroup>
        )}

        {/* Hide / Unhide course action */}
        <SectionHeader title="Course visibility" />
        <InsetGroup kind="canvas">
          <Pressable
            onPress={() => setHidden(course.courseID, !hidden)}
            accessibilityRole="button"
            accessibilityLabel={
              hidden ? `Canvas, unhide ${course.code}` : `Canvas, hide ${course.code}`
            }
            style={({ pressed }) => [
              styles.navRow,
              { paddingVertical: spec.rowPaddingV },
              pressed && { opacity: 0.7 },
            ]}
          >
            <CanvasLeadingGlyph icon={hidden ? 'eye' : 'eyeOff'} />
            <View style={styles.navRowBody}>
              <Text
                style={{
                  fontSize: spec.titleSize,
                  lineHeight: spec.titleLineHeight,
                  fontWeight: '500',
                  color: colors.text,
                }}
              >
                {hidden ? `Unhide ${course.code}` : `Hide ${course.code}`}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {hidden
                  ? 'Show this course in Updates and Search again'
                  : 'Hide this course from Updates and Search'}
              </Text>
            </View>
          </Pressable>
        </InsetGroup>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: spacing.xs,
    paddingBottom: 32,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  courseMetaHeader: {
    paddingHorizontal: spacing.lg + 2,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    gap: 2,
  },
  hiddenNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radii.sm,
  },
  moreGroupCard: {
    marginTop: spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  navRowBody: {
    flex: 1,
    gap: 2,
  },
  miniAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  noTasksInner: {
    padding: spacing.md,
  },
});
