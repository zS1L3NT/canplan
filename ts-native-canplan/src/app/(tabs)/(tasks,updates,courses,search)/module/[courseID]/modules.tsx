import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchFile } from '../../../../../canvas/session';
import { useCanvas } from '../../../../../canvas/store';
import type {
  CanvasAssignment,
  CanvasDiscussion,
  CanvasFile,
  CanvasModule,
  CanvasModuleItem,
  CanvasModuleItemType,
  CanvasPage,
  CanvasQuiz,
} from '../../../../../canvas/types';
import { useDesignVariant } from '../../../../../state/AppState';
import {
  CanvasLeadingGlyph,
  CanvasTaskActionButton,
  EmptyState,
  openCanvasReader,
  openExternalUrl,
  usePullToRefresh,
} from '../../../../../ui/components';
import { getFileTypeInfo } from '../../../../../ui/fileType';
import { formatBytes, formatDueText, formatShortDate, useNow } from '../../../../../ui/format';
import { Icon, type IconName } from '../../../../../ui/Icon';
import { radii, spacing, useTheme } from '../../../../../ui/theme';

type ModuleRowData =
  | { kind: 'item'; item: CanvasModuleItem }
  | { kind: 'empty'; id: string; text: string };

type ModuleSection = {
  key: string;
  module: CanvasModule;
  unlockLabel: string | null;
  data: ModuleRowData[];
};

function moduleItemTypeLabel(type: CanvasModuleItemType): string {
  switch (type) {
    case 'File':
      return 'File';
    case 'Page':
      return 'Page';
    case 'Assignment':
      return 'Assignment';
    case 'Quiz':
      return 'Quiz';
    case 'Discussion':
      return 'Discussion';
    case 'ExternalUrl':
      return 'External link';
    case 'ExternalTool':
      return 'External tool';
    case 'SubHeader':
      return 'Section';
  }
}

function moduleItemIcon(
  item: CanvasModuleItem,
  cachedFile?: CanvasFile,
): IconName {
  switch (item.type) {
    case 'File':
      return getFileTypeInfo(item.title, cachedFile?.['content-type']).icon;
    case 'Page':
      return 'page';
    case 'Assignment':
      return 'assignment';
    case 'Quiz':
      return 'quiz';
    case 'Discussion':
      return 'discussion';
    case 'ExternalUrl':
      return 'link';
    case 'ExternalTool':
      return 'tool';
    case 'SubHeader':
      return 'listModules';
  }
}

function isExternalItemType(
  item: CanvasModuleItem,
  quizByID: Map<number, CanvasQuiz>,
  discussionByID: Map<number, CanvasDiscussion>,
): boolean {
  if (item.type === 'Quiz') {
    return item.content_id === undefined || !quizByID.has(item.content_id);
  }
  if (item.type === 'Discussion') {
    return item.content_id === undefined || !discussionByID.has(item.content_id);
  }
  return item.type === 'ExternalUrl' || item.type === 'ExternalTool';
}

export default function CourseModulesScreen() {
  const { courseID } = useLocalSearchParams<{ courseID: string }>();
  const { allCourses, taskForItem } = useCanvas();
  const { colors, typography, hairline } = useTheme();
  const { spec } = useDesignVariant();
  const { pulling, onRefresh } = usePullToRefresh();
  const nowMs = useNow();
  const [loadingItemID, setLoadingItemID] = useState<number | null>(null);

  const course = useMemo(
    () => allCourses.find((c) => String(c.courseID) === String(courseID)),
    [allCourses, courseID],
  );

  const fileByID = useMemo(() => {
    const map = new Map<number, CanvasFile>();
    for (const f of course?.files ?? []) map.set(f.id, f);
    return map;
  }, [course]);

  const assignmentByID = useMemo(() => {
    const map = new Map<number, CanvasAssignment>();
    for (const a of course?.assignments ?? []) map.set(a.id, a);
    return map;
  }, [course]);

  const quizByID = useMemo(() => {
    const map = new Map<number, CanvasQuiz>();
    for (const q of course?.quizzes ?? []) map.set(q.id, q);
    return map;
  }, [course]);

  const discussionByID = useMemo(() => {
    const map = new Map<number, CanvasDiscussion>();
    for (const d of course?.discussions ?? []) map.set(d.id, d);
    return map;
  }, [course]);

  const pageLookup = useMemo(() => {
    const bySlug = new Map<string, CanvasPage>();
    const byID = new Map<number, CanvasPage>();
    for (const p of course?.pages ?? []) {
      byID.set(p.page_id, p);
      if (p.url) bySlug.set(p.url, p);
    }
    return { bySlug, byID };
  }, [course]);

  const sections = useMemo<ModuleSection[]>(() => {
    const list = course?.modules ?? [];
    return list.map((m) => {
      const unlockMs = m.unlock_at ? new Date(m.unlock_at).getTime() : NaN;
      const unlockLabel =
        !Number.isNaN(unlockMs) && unlockMs > nowMs
          ? `Unlocks ${formatShortDate(m.unlock_at)}`
          : null;
      const items = m.items ?? [];
      const data: ModuleRowData[] =
        items.length > 0
          ? items.map((item) => ({ kind: 'item', item }))
          : [
              {
                kind: 'empty',
                id: `empty-${m.id}`,
                text: unlockLabel ? `Locked · ${unlockLabel}` : 'No items in this module',
              },
            ];
      return {
        key: String(m.id),
        module: m,
        unlockLabel,
        data,
      };
    });
  }, [course, nowMs]);

  const handlePressItem = useCallback(
    async (item: CanvasModuleItem) => {
      if (!course || item.type === 'SubHeader') return;

      if (item.type === 'File') {
        const contentID = item.content_id;
        if (contentID !== undefined && fileByID.has(contentID)) {
          openCanvasReader(course.courseID, 'file', contentID);
          return;
        }
        if (contentID !== undefined) {
          setLoadingItemID(item.id);
          try {
            const fetched = await fetchFile(course.courseID, contentID);
            router.push({
              pathname: `/canvas/file/${course.courseID}/${contentID}`,
              params: {
                title: fetched.display_name || item.title,
                fileUrl: fetched.url ?? '',
                size: fetched.size !== undefined ? String(fetched.size) : '',
                modifiedAt: fetched.modified_at ?? '',
                contentType: fetched['content-type'] ?? '',
                fallbackUrl: item.html_url ?? '',
              },
            });
          } catch {
            openExternalUrl(item.html_url);
          } finally {
            setLoadingItemID((cur) => (cur === item.id ? null : cur));
          }
          return;
        }
        openExternalUrl(item.html_url);
        return;
      }

      if (item.type === 'Page') {
        const matched =
          (item.page_url ? pageLookup.bySlug.get(item.page_url) : undefined) ??
          (item.content_id !== undefined ? pageLookup.byID.get(item.content_id) : undefined);
        if (matched) {
          openCanvasReader(course.courseID, 'page', matched.page_id);
          return;
        }
        if (item.page_url) {
          const targetID = item.content_id ?? item.id;
          router.push({
            pathname: `/canvas/page/${course.courseID}/${targetID}`,
            params: {
              title: item.title,
              pageSlug: item.page_url,
              fallbackUrl: item.html_url ?? '',
            },
          });
          return;
        }
        openExternalUrl(item.html_url);
        return;
      }

      if (item.type === 'Assignment') {
        if (item.content_id !== undefined && assignmentByID.has(item.content_id)) {
          openCanvasReader(course.courseID, 'assignment', item.content_id);
          return;
        }
        openExternalUrl(item.html_url);
        return;
      }

      if (item.type === 'Quiz') {
        if (item.content_id !== undefined && quizByID.has(item.content_id)) {
          openCanvasReader(course.courseID, 'quiz', item.content_id);
          return;
        }
        openExternalUrl(item.html_url);
        return;
      }

      if (item.type === 'Discussion') {
        if (item.content_id !== undefined && discussionByID.has(item.content_id)) {
          openCanvasReader(course.courseID, 'discussion', item.content_id);
          return;
        }
        openExternalUrl(item.html_url);
        return;
      }

      if (item.type === 'ExternalUrl') {
        openExternalUrl(item.external_url || item.html_url);
        return;
      }

      openExternalUrl(item.html_url || item.external_url);
    },
    [course, fileByID, pageLookup, assignmentByID, quizByID, discussionByID],
  );

  if (!course) {
    return (
      <>
        <Stack.Screen options={{ title: 'Modules', headerLargeTitleEnabled: true }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="listModules"
            title="Course not found"
            description="This course may have been cleared from cache."
          />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Modules', headerLargeTitleEnabled: true }} />

      <SectionList
        sections={sections}
        keyExtractor={(row) => (row.kind === 'item' ? `mi-${row.item.id}` : row.id)}
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="listModules"
            title="No modules"
            description="Canvas modules for this course will appear here after the next refresh."
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text
              style={[typography.headline, { color: colors.text }]}
              accessibilityRole="header"
              accessibilityLabel={
                section.unlockLabel
                  ? `Canvas, ${section.module.name}, ${section.unlockLabel}`
                  : `Canvas, ${section.module.name}`
              }
            >
              {section.module.name}
            </Text>
            {section.unlockLabel ? (
              <View style={styles.unlockRow}>
                <Icon name="lock" size={12} color={colors.textTertiary} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {section.unlockLabel}
                </Text>
              </View>
            ) : null}
          </View>
        )}
        renderItem={({ item: row, index, section }) => {
          const isFirst = index === 0;
          const isLast = index === section.data.length - 1;
          const rowBg = spec.tintCanvasSurface ? colors.canvasSurface : colors.surface;
          const rowBorder = spec.tintCanvasSurface ? colors.canvasBorder : colors.border;
          const edges = [
            isFirst && {
              borderTopWidth: hairline,
              borderTopLeftRadius: radii.md,
              borderTopRightRadius: radii.md,
            },
            isLast && {
              borderBottomWidth: hairline,
              borderBottomLeftRadius: radii.md,
              borderBottomRightRadius: radii.md,
            },
          ];

          if (row.kind === 'empty') {
            return (
              <View
                style={[
                  styles.groupRowShell,
                  {
                    backgroundColor: rowBg,
                    borderColor: rowBorder,
                    borderLeftWidth: hairline,
                    borderRightWidth: hairline,
                  },
                  edges,
                ]}
              >
                <View style={styles.emptyModuleRow}>
                  <Text style={[typography.footnote, { color: colors.textTertiary }]}>
                    {row.text}
                  </Text>
                </View>
              </View>
            );
          }

          const { item } = row;
          const indentPx = Math.min(Math.max(item.indent ?? 0, 0), 5) * 16;

          if (item.type === 'SubHeader') {
            return (
              <View
                style={[
                  styles.groupRowShell,
                  {
                    backgroundColor: rowBg,
                    borderColor: rowBorder,
                    borderLeftWidth: hairline,
                    borderRightWidth: hairline,
                  },
                  edges,
                ]}
              >
                {!isFirst ? (
                  <View
                    style={{
                      height: hairline,
                      marginLeft: spacing.md + indentPx,
                      backgroundColor: colors.separator,
                    }}
                  />
                ) : null}
                <View
                  style={[styles.subHeaderRow, { paddingLeft: spacing.md + indentPx }]}
                  accessibilityRole="header"
                  accessibilityLabel={`Canvas, ${item.title}`}
                >
                  <Text style={[typography.caption, styles.subHeaderText, { color: colors.textSecondary }]}>
                    {item.title}
                  </Text>
                </View>
              </View>
            );
          }

          const cachedFile =
            item.type === 'File' && item.content_id !== undefined
              ? fileByID.get(item.content_id)
              : undefined;
          const cachedAssignment =
            item.type === 'Assignment' && item.content_id !== undefined
              ? assignmentByID.get(item.content_id)
              : undefined;
          const cachedPage =
            item.type === 'Page'
              ? ((item.page_url ? pageLookup.bySlug.get(item.page_url) : undefined) ??
                (item.content_id !== undefined ? pageLookup.byID.get(item.content_id) : undefined))
              : undefined;

          const linkedTask =
            item.type === 'File' && item.content_id !== undefined
              ? taskForItem('file', item.content_id)
              : item.type === 'Assignment' && item.content_id !== undefined
                ? taskForItem('assignment', item.content_id)
                : item.type === 'Quiz' && item.content_id !== undefined
                  ? taskForItem('quiz', item.content_id)
                  : item.type === 'Discussion' && item.content_id !== undefined
                    ? taskForItem('discussion', item.content_id)
                    : item.type === 'Page'
                      ? taskForItem('page', cachedPage?.page_id ?? item.content_id ?? item.id)
                      : undefined;

          const typeLabel = moduleItemTypeLabel(item.type);
          const external = isExternalItemType(item, quizByID, discussionByID);
          const isOverdue =
            !!cachedAssignment?.due_at && new Date(cachedAssignment.due_at).getTime() < nowMs;
          const assignmentDueText = cachedAssignment?.due_at
            ? formatDueText(cachedAssignment.due_at, nowMs)
            : null;
          const fileSizeText = cachedFile?.size ? formatBytes(cachedFile.size) : null;
          const isLoading = loadingItemID === item.id;
          const secondaryText = assignmentDueText ?? fileSizeText ?? null;

          const a11yLabel = [
            'Canvas',
            typeLabel,
            item.title,
            assignmentDueText,
            fileSizeText,
            linkedTask ? 'In My tasks' : null,
            external ? 'Opens externally' : null,
          ]
            .filter(Boolean)
            .join(', ');

          return (
            <View
              style={[
                styles.groupRowShell,
                {
                  backgroundColor: rowBg,
                  borderColor: rowBorder,
                  borderLeftWidth: hairline,
                  borderRightWidth: hairline,
                },
                edges,
              ]}
            >
              {!isFirst ? (
                <View
                  style={{
                    height: hairline,
                    marginLeft: spec.canvasSeparatorInset + indentPx,
                    backgroundColor: colors.separator,
                  }}
                />
              ) : null}
              <View style={[styles.itemHit, { paddingLeft: spacing.md + indentPx, paddingVertical: spec.rowPaddingV }]}>
                <Pressable
                  onPress={() => {
                    handlePressItem(item);
                  }}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={a11yLabel}
                  accessibilityHint={external ? 'Opens in browser' : 'Opens Canvas reader'}
                  style={({ pressed }) => [styles.itemMainHit, pressed && { opacity: 0.7 }]}
                >
                  <CanvasLeadingGlyph icon={moduleItemIcon(item, cachedFile)} />

                  <View style={styles.itemBody}>
                    <Text
                      style={{
                        fontSize: spec.titleSize,
                        lineHeight: spec.titleLineHeight,
                        fontWeight: '500',
                        color: colors.text,
                      }}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>

                    {secondaryText ? (
                      <Text
                        style={[
                          typography.caption,
                          { color: isOverdue ? colors.danger : colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {secondaryText}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>

                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : linkedTask ? (
                  <CanvasTaskActionButton
                    linked
                    title={item.title}
                    onPress={() => router.push(`/task/${linkedTask.id}`)}
                  />
                ) : external ? (
                  <Text
                    style={[typography.bodySemibold, { color: colors.textTertiary }]}
                    importantForAccessibility="no"
                  >
                    ↗
                  </Text>
                ) : (
                  <Icon name="chevronRight" size={14} color={colors.textTertiary} />
                )}
              </View>
            </View>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  courseMeta: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  listContent: {
    paddingBottom: 32,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 3,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  groupRowShell: {
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  emptyModuleRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  subHeaderRow: {
    paddingRight: spacing.md,
    paddingTop: 12,
    paddingBottom: 8,
  },
  subHeaderText: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '600',
  },
  itemHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.md,
  },
  itemMainHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
});
