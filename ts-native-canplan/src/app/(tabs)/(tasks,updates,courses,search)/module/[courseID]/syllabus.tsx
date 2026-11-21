import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CANVAS_BASE } from '../../../../../canvas/session';
import { useCanvas } from '../../../../../canvas/store';
import {
  EmptyState,
  HeaderIconButton,
  openExternalUrl,
  usePullToRefresh,
} from '../../../../../ui/components';
import { resolveCanvasUrl } from '../../../../../ui/courseTabs';
import { htmlToReadableText } from '../../../../../ui/format';
import { Icon } from '../../../../../ui/Icon';
import { radii, spacing, useTheme } from '../../../../../ui/theme';

export default function CourseSyllabusScreen() {
  const { courseID } = useLocalSearchParams<{ courseID: string }>();
  const { allCourses } = useCanvas();
  const { colors, typography } = useTheme();
  const { pulling, onRefresh } = usePullToRefresh();

  const course = useMemo(
    () => allCourses.find((c) => String(c.courseID) === String(courseID)),
    [allCourses, courseID],
  );

  const syllabusText = useMemo(
    () => htmlToReadableText(course?.syllabusHTML),
    [course?.syllabusHTML],
  );

  const syllabusUrl = useMemo(() => {
    if (!course) return undefined;
    const tab = course.tabs?.find((t) => t.id.toLowerCase() === 'syllabus');
    return (
      resolveCanvasUrl(tab?.full_url || tab?.html_url) ??
      `${CANVAS_BASE}/courses/${course.courseID}/assignments/syllabus`
    );
  }, [course]);

  if (!course) {
    return (
      <>
        <Stack.Screen options={{ title: 'Syllabus', headerLargeTitleEnabled: true }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="book"
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
          title: 'Syllabus',
          headerLargeTitleEnabled: true,
          ...(Platform.OS !== 'ios' && syllabusUrl
            ? {
                headerRight: () => (
                  <HeaderIconButton
                    icon="externalLink"
                    label="Open Syllabus in Canvas"
                    onPress={() => openExternalUrl(syllabusUrl)}
                  />
                ),
              }
            : {}),
        }}
      />
      {Platform.OS === 'ios' && syllabusUrl ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="arrow.up.right.square"
            accessibilityLabel="Open Syllabus in Canvas"
            onPress={() => openExternalUrl(syllabusUrl)}
          />
        </Stack.Toolbar>
      ) : null}

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={syllabusText ? styles.scrollContent : styles.emptyContainer}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <View style={styles.courseMeta}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Canvas · {course.code}
          </Text>
        </View>

        {syllabusText ? (
          <>
            <View
              style={[
                styles.bodyCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                style={[typography.body, styles.readableBody, { color: colors.text }]}
                selectable
              >
                {syllabusText}
              </Text>
            </View>

            {syllabusUrl ? (
              <Pressable
                onPress={() => openExternalUrl(syllabusUrl)}
                accessibilityRole="button"
                accessibilityLabel={`Canvas, open ${course.code} syllabus in Canvas`}
                style={({ pressed }) => [
                  styles.openCanvasBtn,
                  { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Icon name="externalLink" size={15} color={colors.textSecondary} />
                <Text style={[typography.subhead, { color: colors.text, fontWeight: '500' }]}>
                  Open in Canvas ↗
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon="book"
            title="No syllabus text"
            description="This course's Syllabus tab doesn't include a written body in Canvas, or hasn't been refreshed yet."
            actionLabel={syllabusUrl ? 'Open in Canvas ↗' : undefined}
            onAction={syllabusUrl ? () => openExternalUrl(syllabusUrl) : undefined}
          />
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  courseMeta: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  scrollContent: {
    paddingBottom: 32,
    gap: spacing.md,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  bodyCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  readableBody: {
    lineHeight: 23,
  },
  openCanvasBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: spacing.lg,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
  },
});
