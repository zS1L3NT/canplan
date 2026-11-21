import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CANVAS_BASE } from '../../../../../canvas/session';
import { useCanvas } from '../../../../../canvas/store';
import type { CanvasAssignment } from '../../../../../canvas/types';
import {
  Badge,
  EmptyState,
  HeaderIconButton,
  openCanvasReader,
  openExternalUrl,
  SectionHeader,
  usePullToRefresh,
} from '../../../../../ui/components';
import { isGradedSubmission, resolveCanvasUrl } from '../../../../../ui/courseTabs';
import { formatDateTime, formatPoints, formatShortDate } from '../../../../../ui/format';
import { Icon } from '../../../../../ui/Icon';
import { radii, spacing, useTheme } from '../../../../../ui/theme';

type GradeGroupKey = 'graded' | 'submitted' | 'missing' | 'unsubmitted';

type GradeSection = {
  key: GradeGroupKey;
  title: string;
  tone?: 'default' | 'danger' | 'accent';
  data: CanvasAssignment[];
};

function classifyAssignment(a: CanvasAssignment): GradeGroupKey {
  const sub = a.submission!;
  if (isGradedSubmission(a)) return 'graded';
  if (
    sub.workflow_state === 'submitted' ||
    sub.workflow_state === 'pending_review' ||
    !!sub.submitted_at
  ) {
    return 'submitted';
  }
  if (sub.missing) return 'missing';
  return 'unsubmitted';
}

export default function CourseGradesScreen() {
  const { courseID } = useLocalSearchParams<{ courseID: string }>();
  const { allCourses } = useCanvas();
  const { colors, typography } = useTheme();
  const { pulling, onRefresh } = usePullToRefresh();

  const course = useMemo(
    () => allCourses.find((c) => String(c.courseID) === String(courseID)),
    [allCourses, courseID],
  );

  const gradesUrl = useMemo(() => {
    if (!course) return undefined;
    const tab = course.tabs?.find((t) => t.id.toLowerCase() === 'grades');
    return (
      resolveCanvasUrl(tab?.full_url || tab?.html_url) ??
      `${CANVAS_BASE}/courses/${course.courseID}/grades`
    );
  }, [course]);

  const { sections, summary, totalWithSubmission } = useMemo(() => {
    const withSub = (course?.assignments ?? []).filter((a) => !!a.submission);
    const buckets: Record<GradeGroupKey, CanvasAssignment[]> = {
      graded: [],
      submitted: [],
      missing: [],
      unsubmitted: [],
    };

    let earned = 0;
    let possible = 0;
    let countedGraded = 0;

    for (const a of withSub) {
      const bucket = classifyAssignment(a);
      buckets[bucket].push(a);

      const sub = a.submission!;
      if (
        bucket === 'graded' &&
        !sub.excused &&
        typeof sub.score === 'number' &&
        typeof a.points_possible === 'number' &&
        a.points_possible > 0
      ) {
        earned += sub.score;
        possible += a.points_possible;
        countedGraded += 1;
      }
    }

    buckets.graded.sort((a, b) =>
      (b.due_at ?? b.submission?.submitted_at ?? '').localeCompare(
        a.due_at ?? a.submission?.submitted_at ?? '',
      ),
    );
    buckets.submitted.sort((a, b) =>
      (b.submission?.submitted_at ?? b.due_at ?? '').localeCompare(
        a.submission?.submitted_at ?? a.due_at ?? '',
      ),
    );
    buckets.missing.sort((a, b) => (b.due_at ?? '').localeCompare(a.due_at ?? ''));
    buckets.unsubmitted.sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'));

    const out: GradeSection[] = [];
    if (buckets.graded.length > 0) {
      out.push({ key: 'graded', title: 'Canvas · Graded', data: buckets.graded });
    }
    if (buckets.submitted.length > 0) {
      out.push({
        key: 'submitted',
        title: 'Canvas · Submitted, awaiting grade',
        data: buckets.submitted,
      });
    }
    if (buckets.missing.length > 0) {
      out.push({
        key: 'missing',
        title: 'Canvas · Missing',
        tone: 'danger',
        data: buckets.missing,
      });
    }
    if (buckets.unsubmitted.length > 0) {
      out.push({
        key: 'unsubmitted',
        title: 'Canvas · Not submitted',
        data: buckets.unsubmitted,
      });
    }

    const percent = possible > 0 ? Math.round((earned / possible) * 1000) / 10 : null;
    return {
      sections: out,
      summary: { earned, possible, countedGraded, percent },
      totalWithSubmission: withSub.length,
    };
  }, [course]);

  if (!course) {
    return (
      <>
        <Stack.Screen options={{ title: 'Grades', headerLargeTitleEnabled: true }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="grades"
            title="Course not found"
            description="This course may have been cleared from cache."
          />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Grades',
          headerLargeTitleEnabled: true,
          ...(Platform.OS !== 'ios' && gradesUrl
            ? {
                headerRight: () => (
                  <HeaderIconButton
                    icon="externalLink"
                    label="Open Grades in Canvas"
                    onPress={() => openExternalUrl(gradesUrl)}
                  />
                ),
              }
            : {}),
        }}
      />
      {Platform.OS === 'ios' && gradesUrl ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="arrow.up.right.square"
            accessibilityLabel="Open Grades in Canvas"
            onPress={() => openExternalUrl(gradesUrl)}
          />
        </Stack.Toolbar>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(a) => `g-${a.id}`}
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Canvas · {course.code}
            </Text>

            {totalWithSubmission > 0 ? (
              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
                ]}
              >
                <View style={styles.summaryTopRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      Graded points total (in-app estimate)
                    </Text>
                    <Text style={[typography.title, { color: colors.text }]}>
                      {summary.possible > 0
                        ? `${formatPoints(summary.earned)} / ${formatPoints(summary.possible)} pts`
                        : 'No scored points yet'}
                    </Text>
                  </View>
                  {summary.percent !== null ? (
                    <View style={[styles.percentPill, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[typography.headline, { color: colors.text }]}>
                        {formatPoints(summary.percent)}%
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={[typography.caption, { color: colors.textTertiary }]}>
                  Computed in-app from {summary.countedGraded}{' '}
                  {summary.countedGraded === 1 ? 'graded assignment' : 'graded assignments'} without
                  Canvas group weights — not your official grade.
                </Text>

                {gradesUrl ? (
                  <Pressable
                    onPress={() => openExternalUrl(gradesUrl)}
                    accessibilityRole="button"
                    accessibilityLabel={`Canvas, open ${course.code} grades in Canvas`}
                    style={({ pressed }) => [
                      styles.summaryLink,
                      { borderTopColor: colors.separator },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[typography.caption, { color: colors.accentText, fontWeight: '600' }]}>
                      Open official Grades in Canvas ↗
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <SectionHeader
            title={section.title}
            subtitle={`${section.data.length}`}
            tone={section.tone}
          />
        )}
        renderItem={({ item, section }) => {
          const sub = item.submission!;
          const hasScore = sub.score !== null && sub.score !== undefined;
          const hasPossible =
            item.points_possible !== null && item.points_possible !== undefined;
          const scoreLine = sub.excused
            ? 'Excused'
            : hasScore && hasPossible
              ? `${formatPoints(sub.score!)} / ${formatPoints(item.points_possible!)}`
              : hasScore
                ? formatPoints(sub.score!)
                : sub.grade
                  ? sub.grade
                  : hasPossible
                    ? `— / ${formatPoints(item.points_possible!)}`
                    : '—';

          const distinctGrade =
            !sub.excused &&
            sub.grade &&
            hasScore &&
            sub.grade.trim() !== formatPoints(sub.score!)
              ? sub.grade.trim()
              : null;

          const dateInfo =
            section.key === 'submitted' && sub.submitted_at
              ? `Submitted ${formatDateTime(sub.submitted_at)}`
              : item.due_at
                ? `Due ${formatShortDate(item.due_at)}`
                : 'No due date';

          const a11yLabel = [
            'Canvas',
            course.code,
            'Grades',
            item.name,
            scoreLine,
            distinctGrade,
            dateInfo,
            sub.missing ? 'Missing' : null,
            sub.late ? 'Late' : null,
          ]
            .filter(Boolean)
            .join(', ');

          return (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
              ]}
            >
              <Pressable
                onPress={() => openCanvasReader(course.courseID, 'assignment', item.id)}
                accessibilityRole="button"
                accessibilityLabel={a11yLabel}
                accessibilityHint="Opens assignment details"
                style={({ pressed }) => [styles.rowHit, pressed && { opacity: 0.72 }]}
              >
                <View style={styles.rowBody}>
                  <Text style={[typography.bodySemibold, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>

                  <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                    {dateInfo}
                  </Text>

                  <View style={styles.badgeRow}>
                    {section.key === 'graded' ? (
                      <Badge
                        label={sub.excused ? 'Excused' : 'Graded'}
                        tone={sub.excused ? 'neutral' : 'success'}
                      />
                    ) : null}
                    {section.key === 'submitted' ? (
                      <Badge label="Submitted" tone="accent" />
                    ) : null}
                    {sub.missing ? <Badge label="Missing" tone="danger" /> : null}
                    {sub.late ? <Badge label="Late" tone="warning" /> : null}
                    {section.key === 'unsubmitted' && !sub.missing ? (
                      <Badge label="Not submitted" tone="neutral" />
                    ) : null}
                  </View>
                </View>

                <View style={styles.scoreCol}>
                  <Text
                    style={[
                      typography.bodySemibold,
                      {
                        color:
                          section.key === 'graded' && !sub.excused
                            ? colors.text
                            : colors.textSecondary,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {scoreLine}
                  </Text>
                  {distinctGrade ? (
                    <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                      {distinctGrade}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.trailingChevron}>
                  <Icon name="chevronRight" size={14} color={colors.textTertiary} />
                </View>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="grades"
            title="No grade data yet"
            description="Pull to refresh Canvas to load your submissions and scores for this course."
            actionLabel={gradesUrl ? 'Open Grades in Canvas ↗' : undefined}
            onAction={gradesUrl ? () => openExternalUrl(gradesUrl) : undefined}
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  summaryCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  percentPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  summaryLink: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  listContent: {
    paddingBottom: 28,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  card: {
    marginHorizontal: spacing.lg,
    marginVertical: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  rowHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  scoreCol: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  trailingChevron: {
    paddingLeft: 2,
  },
});
