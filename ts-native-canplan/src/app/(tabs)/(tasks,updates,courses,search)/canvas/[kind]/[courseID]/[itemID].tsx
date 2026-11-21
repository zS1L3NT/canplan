import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchFile, fetchPageBody } from '../../../../../../canvas/session';
import { useCanvas } from '../../../../../../canvas/store';
import type { CanvasFile, CanvasPage, FeedKind } from '../../../../../../canvas/types';
import {
  Badge,
  EmptyState,
  HeaderIconButton,
  InsetGroup,
  kindIconName,
  kindTitleLabel,
  openExternalUrl,
  TaskRow,
} from '../../../../../../ui/components';
import { getFileTypeInfo } from '../../../../../../ui/fileType';
import {
  formatBytes,
  formatDateTime,
  formatDueText,
  formatPoints,
  formatRelative,
  htmlToReadableText,
  useNow,
} from '../../../../../../ui/format';
import { Icon } from '../../../../../../ui/Icon';
import { radii, spacing, useTheme } from '../../../../../../ui/theme';

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

export default function CanvasReaderScreen() {
  const params = useLocalSearchParams<{
    kind: string;
    courseID: string;
    itemID: string;
    title?: string;
    fileUrl?: string;
    size?: string;
    modifiedAt?: string;
    contentType?: string;
    pageSlug?: string;
    fallbackUrl?: string;
  }>();
  const { colors, typography } = useTheme();
  const nowMs = useNow();
  const { allCourses, locationOf, tasksForItem, makeActionable, addTask } = useCanvas();

  const kind: FeedKind | null = isFeedKind(params.kind) ? params.kind : null;
  const courseID = Number(params.courseID);
  const itemID = Number(params.itemID);

  const course = useMemo(
    () => allCourses.find((c) => c.courseID === courseID),
    [allCourses, courseID],
  );

  const cachedItem = useMemo(() => {
    if (!course || !kind || Number.isNaN(itemID)) return null;
    if (kind === 'announcement') {
      const a = course.announcements.find((x) => x.id === itemID);
      return a ? ({ kind: 'announcement' as const, data: a }) : null;
    }
    if (kind === 'assignment') {
      const a = course.assignments.find((x) => x.id === itemID);
      return a ? ({ kind: 'assignment' as const, data: a }) : null;
    }
    if (kind === 'file') {
      const f = course.files.find((x) => x.id === itemID);
      return f ? ({ kind: 'file' as const, data: f }) : null;
    }
    if (kind === 'quiz') {
      const q = course.quizzes?.find((x) => x.id === itemID);
      return q ? ({ kind: 'quiz' as const, data: q }) : null;
    }
    if (kind === 'discussion') {
      const d = course.discussions?.find((x) => x.id === itemID);
      return d ? ({ kind: 'discussion' as const, data: d }) : null;
    }
    const p = course.pages.find((x) => x.page_id === itemID);
    return p ? ({ kind: 'page' as const, data: p }) : null;
  }, [course, kind, itemID]);

  const hasPrefetchedFileParams = kind === 'file' && (!!params.fileUrl || !!params.title);

  const fileFetchKey = `${courseID}-${itemID}`;
  const [fetchedFileState, setFetchedFileState] = useState<{
    key: string | null;
    status: 'idle' | 'loaded' | 'error';
    file: CanvasFile | null;
    error: string | null;
  }>({ key: null, status: 'idle', file: null, error: null });

  useEffect(() => {
    if (!course || kind !== 'file' || cachedItem || hasPrefetchedFileParams || Number.isNaN(itemID)) {
      return;
    }
    let cancelled = false;
    fetchFile(course.courseID, itemID)
      .then((f) => {
        if (!cancelled) {
          setFetchedFileState({
            key: fileFetchKey,
            status: 'loaded',
            file: {
              id: f.id,
              display_name: f.display_name,
              url: f.url,
              size: f.size,
              modified_at: f.modified_at ?? null,
              updated_at: f.modified_at ?? null,
              'content-type': f['content-type'],
            },
            error: null,
          });
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setFetchedFileState({ key: fileFetchKey, status: 'error', file: null, error: msg });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [course, kind, cachedItem, hasPrefetchedFileParams, itemID, fileFetchKey]);

  const activeFetchedFile =
    fetchedFileState.key === fileFetchKey && fetchedFileState.status === 'loaded'
      ? fetchedFileState.file
      : null;
  const activeFetchedFileError =
    fetchedFileState.key === fileFetchKey && fetchedFileState.status === 'error'
      ? fetchedFileState.error
      : null;

  const item = useMemo(() => {
    if (cachedItem) return cachedItem;
    if (!course || !kind || Number.isNaN(itemID)) return null;
    if (kind === 'file') {
      if (activeFetchedFile) {
        return { kind: 'file' as const, data: activeFetchedFile };
      }
      if (hasPrefetchedFileParams) {
        const parsedSize = params.size ? Number(params.size) : undefined;
        const synthetic: CanvasFile = {
          id: itemID,
          display_name: params.title || 'File',
          url: params.fileUrl || undefined,
          size: parsedSize !== undefined && !Number.isNaN(parsedSize) ? parsedSize : undefined,
          modified_at: params.modifiedAt || null,
          updated_at: params.modifiedAt || null,
          'content-type': params.contentType || undefined,
        };
        return { kind: 'file' as const, data: synthetic };
      }
      return null;
    }
    if (kind === 'page' && params.pageSlug) {
      const syntheticPage: CanvasPage = {
        page_id: itemID,
        url: params.pageSlug,
        title: params.title || 'Page',
        updated_at: null,
        html_url: params.fallbackUrl || undefined,
      };
      return { kind: 'page' as const, data: syntheticPage };
    }
    return null;
  }, [
    cachedItem,
    course,
    kind,
    itemID,
    activeFetchedFile,
    hasPrefetchedFileParams,
    params.size,
    params.title,
    params.fileUrl,
    params.modifiedAt,
    params.contentType,
    params.pageSlug,
    params.fallbackUrl,
  ]);

  const pageSlug = item?.kind === 'page' ? item.data.url : undefined;

  const [pageState, setPageState] = useState<{
    status: 'idle' | 'loading' | 'loaded' | 'error';
    body: string | null;
    error: string | null;
  }>({ status: 'idle', body: null, error: null });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!course || item?.kind !== 'page' || !pageSlug) return;
    let cancelled = false;
    fetchPageBody(course.courseID, pageSlug)
      .then((html) => {
        if (!cancelled) setPageState({ status: 'loaded', body: html, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setPageState({ status: 'error', body: null, error: msg });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [course, item?.kind, pageSlug, retryCount]);

  const loadPage = useCallback(() => {
    setPageState({ status: 'loading', body: null, error: null });
    setRetryCount((n) => n + 1);
  }, []);

  const pageLoading =
    item?.kind === 'page' &&
    !!pageSlug &&
    (pageState.status === 'idle' || pageState.status === 'loading');
  const pageError = pageState.status === 'error' ? pageState.error : null;
  const pageBody = pageState.status === 'loaded' ? pageState.body : null;

  const navTitle = kind ? kindTitleLabel(kind) : 'Canvas';

  const fileLoading =
    !!course &&
    kind === 'file' &&
    !item &&
    !Number.isNaN(itemID) &&
    !activeFetchedFileError;

  if (fileLoading) {
    return (
      <>
        <Stack.Screen options={{ title: navTitle }} />
        <View style={[styles.loadingCenter, { backgroundColor: colors.bg }]}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text style={[typography.subhead, { color: colors.textSecondary }]}>
            Loading file details from Canvas…
          </Text>
        </View>
      </>
    );
  }

  if (!course || !kind || !item) {
    const canOpenFallback = !!params.fallbackUrl;
    return (
      <>
        <Stack.Screen options={{ title: navTitle }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="modules"
            title="Canvas item not found"
            description={
              activeFetchedFileError
                ? `Canvas did not return this file (${activeFetchedFileError}).`
                : 'This item may no longer be in your cached Canvas data.'
            }
            actionLabel={canOpenFallback ? 'Open in Canvas' : 'Go back'}
            onAction={() => {
              if (canOpenFallback) openExternalUrl(params.fallbackUrl);
              else router.back();
            }}
          />
        </ScrollView>
      </>
    );
  }

  const crumbs = locationOf(course.courseID, kind, itemID);
  const breadcrumb = ['Canvas', course.code, ...crumbs].filter(Boolean).join(' › ');
  const subPath = crumbs.length > 1 ? crumbs.slice(1).join(' › ') : '';
  const headerContext = [course.code, subPath].filter(Boolean).join(' · ');
  const linkedTasks = tasksForItem(kind, itemID);
  const sourceTask = linkedTasks.find(
    (t) =>
      t.source?.courseID === course.courseID &&
      t.source?.kind === kind &&
      t.source?.itemID === itemID,
  );

  const title =
    item.kind === 'announcement'
      ? item.data.title
      : item.kind === 'assignment'
        ? item.data.name
        : item.kind === 'file'
          ? item.data.display_name
          : item.data.title;

  const externalUrl =
    item.kind === 'file'
      ? (params.fallbackUrl || item.data.url)
      : (item.data.html_url || params.fallbackUrl);

  const isOverdue =
    (item.kind === 'assignment' || item.kind === 'quiz') &&
    !!item.data.due_at &&
    new Date(item.data.due_at).getTime() < nowMs;

  const folderPath =
    item.kind === 'file' && item.data.folder_id !== undefined
      ? course.folderPaths?.[item.data.folder_id]
      : undefined;

  const bodyText =
    item.kind === 'announcement'
      ? htmlToReadableText(item.data.message)
      : item.kind === 'assignment'
        ? htmlToReadableText(item.data.description)
        : item.kind === 'quiz'
          ? htmlToReadableText(item.data.description)
          : item.kind === 'discussion'
            ? htmlToReadableText(item.data.message)
            : item.kind === 'page' && pageBody !== null
              ? htmlToReadableText(pageBody)
              : '';

  const headerIcon =
    item.kind === 'file'
      ? getFileTypeInfo(item.data.display_name, item.data['content-type']).icon
      : kindIconName(kind);

  const handlePrimaryAction = () => {
    if (sourceTask) {
      router.push(`/task/${sourceTask.id}`);
      return;
    }
    if (linkedTasks.length === 0) {
      const createdId = makeActionable(course.courseID, kind, itemID);
      if (createdId) return;
    }
    addTask({
      title,
      courseCode: course.code,
      source: { courseID: course.courseID, kind, itemID },
    });
  };

  const handleLinkToTask = () => {
    router.push({
      pathname: '/task-picker',
      params: {
        courseID: String(course.courseID),
        kind,
        itemID: String(itemID),
        title,
      },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: navTitle,
          ...(Platform.OS !== 'ios'
            ? {
                headerRight: () => (
                  <View style={styles.headerRight}>
                    <HeaderIconButton
                      icon={sourceTask ? 'checkCircleFill' : 'add'}
                      label={sourceTask ? 'Open in My Tasks' : 'Add to My Tasks'}
                      onPress={handlePrimaryAction}
                    />
                    <HeaderIconButton
                      icon="link"
                      label="Link to a task"
                      onPress={handleLinkToTask}
                    />
                    {externalUrl ? (
                      <HeaderIconButton
                        icon="externalLink"
                        label="Open in Canvas"
                        onPress={() => openExternalUrl(externalUrl)}
                      />
                    ) : null}
                  </View>
                ),
              }
            : {}),
        }}
      />
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={sourceTask ? 'checkmark.circle.fill' : 'plus'}
            accessibilityLabel={sourceTask ? 'Open in My Tasks' : 'Add to My Tasks'}
            onPress={handlePrimaryAction}
          />
          <Stack.Toolbar.Button
            icon="link"
            accessibilityLabel="Link to a task"
            onPress={handleLinkToTask}
          />
          {externalUrl ? (
            <Stack.Toolbar.Button
              icon="arrow.up.right.square"
              accessibilityLabel="Open in Canvas"
              onPress={() => openExternalUrl(externalUrl)}
            />
          ) : null}
        </Stack.Toolbar>
      ) : null}

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header metadata card (Canvas visual grammar) */}
        <View
          style={[
            styles.headerCard,
            { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
          ]}
        >
          <View style={styles.headerTopRow}>
            <View style={[styles.kindSquare, { backgroundColor: colors.surfaceSecondary }]}>
              <Icon name={headerIcon} size={18} color={colors.textSecondary} />
            </View>
            <Text
              style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}
              accessibilityLabel={breadcrumb}
            >
              {headerContext}
            </Text>
          </View>

          <Text style={[typography.title, { color: colors.text }]} selectable>
            {title}
          </Text>

          <View style={styles.metaStack}>
            {item.kind === 'announcement' && item.data.posted_at ? (
              <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                Posted {formatDateTime(item.data.posted_at)}
              </Text>
            ) : null}

            {item.kind === 'assignment' ? (
              <>
                <Text
                  style={[
                    typography.footnote,
                    {
                      color: isOverdue ? colors.danger : colors.textSecondary,
                      fontWeight: isOverdue ? '600' : '500',
                    },
                  ]}
                >
                  {formatDueText(item.data.due_at, nowMs)}
                  {item.data.due_at ? ` (${formatDateTime(item.data.due_at)})` : ''}
                </Text>
                {item.data.points_possible !== undefined &&
                item.data.points_possible !== null &&
                item.data.points_possible > 0 ? (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {formatPoints(item.data.points_possible)} points
                    {item.data.updated_at ? ` · Updated ${formatDateTime(item.data.updated_at)}` : ''}
                  </Text>
                ) : item.data.updated_at ? (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Updated {formatDateTime(item.data.updated_at)}
                  </Text>
                ) : null}
                {item.data.submission ? (
                  <View style={styles.submissionRow}>
                    {item.data.submission.excused ? (
                      <Badge label="Excused" tone="neutral" />
                    ) : item.data.submission.score !== null &&
                      item.data.submission.score !== undefined ? (
                      <Badge
                        label={
                          item.data.points_possible !== null &&
                          item.data.points_possible !== undefined
                            ? `Score ${formatPoints(item.data.submission.score)} / ${formatPoints(item.data.points_possible)}`
                            : `Score ${formatPoints(item.data.submission.score)}`
                        }
                        tone="success"
                      />
                    ) : item.data.submission.workflow_state === 'submitted' ||
                      item.data.submission.workflow_state === 'pending_review' ? (
                      <Badge label="Submitted" tone="accent" />
                    ) : null}
                    {item.data.submission.missing ? <Badge label="Missing" tone="danger" /> : null}
                    {item.data.submission.late ? <Badge label="Late" tone="warning" /> : null}
                  </View>
                ) : null}
              </>
            ) : null}

            {item.kind === 'quiz' ? (
              <>
                <Text
                  style={[
                    typography.footnote,
                    {
                      color: isOverdue ? colors.danger : colors.textSecondary,
                      fontWeight: isOverdue ? '600' : '500',
                    },
                  ]}
                >
                  {formatDueText(item.data.due_at, nowMs)}
                  {item.data.due_at ? ` (${formatDateTime(item.data.due_at)})` : ''}
                </Text>
                {[
                  item.data.points_possible !== undefined && item.data.points_possible !== null
                    ? `${formatPoints(item.data.points_possible)} pts`
                    : null,
                  item.data.question_count !== undefined
                    ? `${item.data.question_count} ${item.data.question_count === 1 ? 'question' : 'questions'}`
                    : null,
                  item.data.time_limit !== undefined && item.data.time_limit !== null
                    ? `${item.data.time_limit} min`
                    : null,
                ].filter(Boolean).length > 0 ? (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {[
                      item.data.points_possible !== undefined && item.data.points_possible !== null
                        ? `${formatPoints(item.data.points_possible)} pts`
                        : null,
                      item.data.question_count !== undefined
                        ? `${item.data.question_count} ${item.data.question_count === 1 ? 'question' : 'questions'}`
                        : null,
                      item.data.time_limit !== undefined && item.data.time_limit !== null
                        ? `${item.data.time_limit} min`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
                {item.data.unlock_at || item.data.lock_at ? (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {[
                      item.data.unlock_at ? `Opens ${formatDateTime(item.data.unlock_at)}` : null,
                      item.data.lock_at ? `Closes ${formatDateTime(item.data.lock_at)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
              </>
            ) : null}

            {item.kind === 'discussion' ? (
              <>
                <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                  {[
                    item.data.posted_at ? `Posted ${formatDateTime(item.data.posted_at)}` : null,
                    item.data.discussion_subentry_count !== undefined
                      ? `${item.data.discussion_subentry_count} ${item.data.discussion_subentry_count === 1 ? 'reply' : 'replies'}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {item.data.last_reply_at ? (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Last reply {formatRelative(item.data.last_reply_at, nowMs)} (
                    {formatDateTime(item.data.last_reply_at)})
                  </Text>
                ) : null}
              </>
            ) : null}

            {item.kind === 'page' && item.data.updated_at ? (
              <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                Updated {formatDateTime(item.data.updated_at)}
              </Text>
            ) : null}

            {item.kind === 'file' ? (
              <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                {[
                  formatBytes(item.data.size),
                  item.data.modified_at || item.data.updated_at
                    ? `Modified ${formatDateTime(item.data.modified_at ?? item.data.updated_at)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Body section */}
        {item.kind === 'file' ? (
          <View
            style={[
              styles.bodyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.fileDetailRow}>
              <Icon name="folder" size={16} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textTertiary }]}>
                  Folder path
                </Text>
                <Text style={[typography.subhead, { color: colors.text }]}>
                  {folderPath || 'Course files'}
                </Text>
              </View>
            </View>

            {item.data.size ? (
              <View
                style={[
                  styles.fileDetailRow,
                  {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.separator,
                    paddingTop: spacing.sm,
                  },
                ]}
              >
                <Icon name="file" size={16} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { color: colors.textTertiary }]}>Size</Text>
                  <Text style={[typography.subhead, { color: colors.text }]}>
                    {formatBytes(item.data.size)}
                  </Text>
                </View>
              </View>
            ) : null}

            {item.data.modified_at || item.data.updated_at ? (
              <View
                style={[
                  styles.fileDetailRow,
                  {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.separator,
                    paddingTop: spacing.sm,
                  },
                ]}
              >
                <Icon name="clock" size={16} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { color: colors.textTertiary }]}>Modified</Text>
                  <Text style={[typography.subhead, { color: colors.text }]}>
                    {formatDateTime(item.data.modified_at ?? item.data.updated_at)}
                  </Text>
                </View>
              </View>
            ) : null}

            {item.data.url ? (
              <Pressable
                onPress={() => openExternalUrl(item.data.url)}
                accessibilityRole="button"
                accessibilityLabel={`Canvas, open file ${item.data.display_name}`}
                style={({ pressed }) => [
                  styles.openFileBtn,
                  { backgroundColor: colors.surfaceSecondary },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Icon name="externalLink" size={16} color={colors.text} />
                <Text style={[typography.bodySemibold, { color: colors.text }]}>Open file</Text>
              </Pressable>
            ) : null}
          </View>
        ) : item.kind === 'page' ? (
          <View
            style={[
              styles.bodyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {pageLoading ? (
              <View style={styles.pageStateBox}>
                <ActivityIndicator size="small" color={colors.textSecondary} />
                <Text style={[typography.subhead, { color: colors.textSecondary }]}>
                  Loading page from Canvas…
                </Text>
              </View>
            ) : pageError ? (
              <View style={styles.pageStateBox}>
                <Icon name="warning" size={20} color={colors.warning} />
                <Text style={[typography.subhead, { color: colors.text, textAlign: 'center' }]}>
                  Could not load page content
                </Text>
                <Text
                  style={[
                    typography.footnote,
                    { color: colors.textSecondary, textAlign: 'center' },
                  ]}
                >
                  {pageError}
                </Text>
                <Pressable
                  onPress={loadPage}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.retryBtn,
                    { backgroundColor: colors.surfaceSecondary },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[typography.caption, { color: colors.text, fontWeight: '600' }]}>
                    Retry
                  </Text>
                </Pressable>
              </View>
            ) : bodyText ? (
              <Text
                style={[typography.body, styles.readableBody, { color: colors.text }]}
                selectable
              >
                {bodyText}
              </Text>
            ) : (
              <Text style={[typography.subhead, { color: colors.textTertiary }]}>
                {pageSlug
                  ? 'This Canvas page has no text content.'
                  : 'No page slug available to load body. Open in Canvas to view.'}
              </Text>
            )}
          </View>
        ) : (
          <View
            style={[
              styles.bodyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {bodyText ? (
              <Text
                style={[typography.body, styles.readableBody, { color: colors.text }]}
                selectable
              >
                {bodyText}
              </Text>
            ) : (
              <Text style={[typography.subhead, { color: colors.textTertiary }]}>
                {item.kind === 'announcement'
                  ? 'No announcement body.'
                  : item.kind === 'discussion'
                    ? 'No discussion message body.'
                    : item.kind === 'quiz'
                      ? 'No quiz instructions provided in Canvas.'
                      : 'No description provided in Canvas.'}
              </Text>
            )}
            {item.kind === 'discussion' ? (
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                Open in Canvas to read or post replies.
              </Text>
            ) : null}
          </View>
        )}

        {/* Inline actions (scroll cleanly above native tab bar) */}
        <View style={styles.actionsBlock}>
          <View style={styles.taskActionsRow}>
            <Pressable
              onPress={handlePrimaryAction}
              accessibilityRole="button"
              accessibilityLabel={
                sourceTask
                  ? `My task, open ${title} in My Tasks`
                  : `Add ${title} to My Tasks`
              }
              style={({ pressed }) => [
                styles.primaryActionBtn,
                styles.taskActionHalf,
                {
                  backgroundColor: sourceTask ? colors.accentSoft : colors.accent,
                  borderColor: colors.accent,
                  borderWidth: sourceTask ? 1 : 0,
                },
                pressed && { opacity: 0.82 },
              ]}
            >
              <Icon
                name={sourceTask ? 'check' : 'add'}
                size={15}
                color={sourceTask ? colors.accentText : colors.onAccent}
              />
              <Text
                style={[
                  typography.subhead,
                  {
                    color: sourceTask ? colors.accentText : colors.onAccent,
                    fontWeight: '600',
                    flexShrink: 1,
                  },
                ]}
                numberOfLines={1}
              >
                {sourceTask ? 'In My Tasks →' : 'Add to My Tasks'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleLinkToTask}
              accessibilityRole="button"
              accessibilityLabel={`Link ${title} to a task`}
              style={({ pressed }) => [
                styles.linkTaskBtn,
                styles.taskActionHalf,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Icon name="link" size={15} color={colors.accentText} />
              <Text
                style={[
                  typography.subhead,
                  { color: colors.accentText, fontWeight: '600', flexShrink: 1 },
                ]}
                numberOfLines={1}
              >
                Link to a task…
              </Text>
            </Pressable>
          </View>

          {externalUrl ? (
            <Pressable
              onPress={() => openExternalUrl(externalUrl)}
              accessibilityRole="button"
              accessibilityLabel={`Canvas, open ${title} in Canvas`}
              style={({ pressed }) => [
                styles.secondaryActionBtn,
                { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[typography.subhead, { color: colors.text, fontWeight: '500' }]}>
                Open in Canvas ↗
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Linked to (every task referencing or sourced from this Canvas item) */}
        {linkedTasks.length > 0 ? (
          <View style={styles.linkedToSection}>
            <Text style={[typography.caption, styles.linkedToLabel, { color: colors.accentText }]}>
              LINKED TO ({linkedTasks.length})
            </Text>
            <InsetGroup kind="mine" style={{ marginHorizontal: 0 }}>
              {linkedTasks.map((t, idx) => {
                const isSource =
                  t.source?.courseID === course.courseID &&
                  t.source?.kind === kind &&
                  t.source?.itemID === itemID;
                return (
                  <TaskRow
                    key={t.id}
                    task={t}
                    context="course"
                    groupPosition="grouped"
                    showTopSeparator={idx > 0}
                    roleBadge={isSource ? 'Source' : 'Reference'}
                    hideFromCanvasPill
                  />
                );
              })}
            </InsetGroup>
          </View>
        ) : null}
      </ScrollView>
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
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 28,
    gap: spacing.md,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: spacing.xxl,
  },
  headerCard: {
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kindSquare: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metaStack: {
    gap: 3,
    marginTop: 2,
  },
  submissionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  bodyCard: {
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  readableBody: {
    lineHeight: 23,
  },
  fileDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  openFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  pageStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  actionsBlock: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  taskActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  taskActionHalf: {
    flex: 1,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  linkTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  secondaryActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  linkedToSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  linkedToLabel: {
    marginLeft: spacing.xs,
    letterSpacing: 0.5,
  },
  linkedToList: {
    gap: spacing.sm,
  },
});
