import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCanvas } from '../canvas/store';
import type { CanvasFile, CanvasFolder, CourseSnapshot, FolderContents } from '../canvas/types';
import { useDesignVariant } from '../state/AppState';
import {
  CanvasLeadingGlyph,
  CanvasTaskActionButton,
  EmptyState,
  HeaderIconButton,
  openCanvasReader,
  usePullToRefresh,
} from './components';
import { copyToClipboard, getFileTypeInfo } from './fileType';
import { formatBytes, formatShortDate } from './format';
import { Icon } from './Icon';
import { radii, spacing, useTheme } from './theme';

export type FolderSortMode = 'name' | 'modified';

export type FolderBrowserRow =
  | { kind: 'folder'; id: string; folder: CanvasFolder; itemCount: number }
  | { kind: 'file'; id: string; file: CanvasFile };

function fileDateKey(f: CanvasFile): string {
  return f.modified_at ?? f.updated_at ?? '';
}

export function sortFolderFiles(files: CanvasFile[], mode: FolderSortMode): CanvasFile[] {
  const copy = [...files];
  if (mode === 'modified') {
    return copy.sort(
      (a, b) =>
        fileDateKey(b).localeCompare(fileDateKey(a)) ||
        a.display_name.localeCompare(b.display_name, undefined, { numeric: true }),
    );
  }
  return copy.sort((a, b) =>
    a.display_name.localeCompare(b.display_name, undefined, { numeric: true }),
  );
}

export function buildFolderBrowserRows(
  course: CourseSnapshot | undefined,
  contents: FolderContents | null,
  folderContents: (courseID: number, folderID?: number) => FolderContents | null,
  sortBy: FolderSortMode,
  isRoot: boolean,
): FolderBrowserRow[] {
  if (!course) return [];
  if (contents) {
    const folderRows: FolderBrowserRow[] = contents.folders.map((folder) => {
      const sub = folderContents(course.courseID, folder.id);
      const itemCount = sub
        ? sub.folders.length + sub.files.length
        : (folder.files_count ?? 0) + (folder.folders_count ?? 0);
      return { kind: 'folder', id: `dir-${folder.id}`, folder, itemCount };
    });
    const fileRows: FolderBrowserRow[] = sortFolderFiles(contents.files, sortBy).map((file) => ({
      kind: 'file',
      id: `file-${file.id}`,
      file,
    }));
    return [...folderRows, ...fileRows];
  }
  if (isRoot && course.files.length > 0) {
    return sortFolderFiles(course.files, sortBy).map((file) => ({
      kind: 'file',
      id: `file-${file.id}`,
      file,
    }));
  }
  return [];
}

export function folderBreadcrumbText(contents: FolderContents | null): string {
  if (!contents) return 'Files';
  return contents.path
    .map((f, idx) => (idx === 0 && f.parent_folder_id === null ? 'Files' : f.name))
    .join(' › ');
}

/**
 * Reusable folder + file list body for embedding Canvas Files browsing inside pickers (e.g. /link-picker).
 */
export function FolderBrowserPickerList({
  course,
  folderID,
  onSelectFolder,
  onToggleFile,
  getFileLinkState,
}: {
  course: CourseSnapshot;
  folderID?: number;
  onSelectFolder: (folder: CanvasFolder) => void;
  onToggleFile: (file: CanvasFile) => void;
  getFileLinkState: (file: CanvasFile) => 'source' | 'linked' | false;
}) {
  const { colors, typography, hairline } = useTheme();
  const { folderContents } = useCanvas();

  const isRoot = folderID === undefined;
  const contents = useMemo(
    () => folderContents(course.courseID, folderID),
    [course.courseID, folderContents, folderID],
  );
  const rows = useMemo(
    () => buildFolderBrowserRows(course, contents, folderContents, 'name', isRoot),
    [course, contents, folderContents, isRoot],
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={contents ? 'folder' : 'lock'}
        title={contents ? 'This folder is empty' : 'Files locked in Canvas'}
        description={
          contents
            ? 'No files or subfolders in this Canvas folder.'
            : 'This course restricts the Files tab in Canvas, or folders have not been synced yet.'
        }
      />
    );
  }

  return (
    <View style={styles.pickerGroupWrap}>
      {rows.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === rows.length - 1;
        const groupEdges = [
          isFirst && styles.rowFirst,
          isLast && styles.rowLast,
          !isFirst && { borderTopWidth: hairline, borderTopColor: colors.separator },
        ];

        if (item.kind === 'folder') {
          const countText =
            item.itemCount === 0
              ? 'Empty'
              : item.itemCount === 1
                ? '1 item'
                : `${item.itemCount} items`;
          return (
            <View
              key={item.id}
              style={[
                styles.groupRowShell,
                { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
                groupEdges,
              ]}
            >
              <Pressable
                onPress={() => onSelectFolder(item.folder)}
                accessibilityRole="button"
                accessibilityLabel={`Folder, ${item.folder.name}, ${countText}`}
                style={({ pressed }) => [styles.rowHit, pressed && { opacity: 0.7 }]}
              >
                <View
                  style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}
                  importantForAccessibility="no-hide-descendants"
                >
                  <Icon name="folderFill" size={18} color={colors.textSecondary} />
                </View>
                <View style={styles.rowBody}>
                  <Text
                    style={[typography.bodySemibold, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {item.folder.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {countText}
                  </Text>
                </View>
                <Icon name="chevronRight" size={15} color={colors.textTertiary} />
              </Pressable>
            </View>
          );
        }

        const { file } = item;
        const typeInfo = getFileTypeInfo(file.display_name, file['content-type']);
        const linkState = getFileLinkState(file);
        const sizeText = formatBytes(file.size);
        const dateText = formatShortDate(file.modified_at ?? file.updated_at);
        const metaLine = [sizeText, dateText].filter(Boolean).join(' · ');

        return (
          <View
            key={item.id}
            style={[
              styles.groupRowShell,
              { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
              groupEdges,
            ]}
          >
            <Pressable
              onPress={() => onToggleFile(file)}
              accessibilityRole="button"
              accessibilityState={{ selected: !!linkState }}
              accessibilityLabel={`Canvas, ${typeInfo.label}, ${file.display_name}${linkState ? ', linked' : ''}`}
              style={({ pressed }) => [styles.rowHit, pressed && { opacity: 0.7 }]}
            >
              <View
                style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}
                importantForAccessibility="no-hide-descendants"
              >
                <Icon name={typeInfo.icon} size={17} color={colors.textSecondary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[typography.bodyMedium, { color: colors.text }]} numberOfLines={2}>
                  {file.display_name}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {metaLine ? `${typeInfo.label} · ${metaLine}` : typeInfo.label}
                </Text>
              </View>
              {linkState ? (
                <View style={[styles.inTasksPill, { backgroundColor: colors.accentSoft }]}>
                  <Icon name="check" size={12} color={colors.accentText} />
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.accentText, fontWeight: '600' },
                    ]}
                  >
                    {linkState === 'source' ? 'Source' : 'Linked'}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function FolderBrowserScreen({
  courseID,
  folderID,
}: {
  courseID: number;
  folderID?: number;
}) {
  const { colors, typography, hairline } = useTheme();
  const { spec } = useDesignVariant();
  const { allCourses, folderContents, taskForItem, makeActionable } = useCanvas();
  const { pulling, onRefresh } = usePullToRefresh();
  const [sortBy, setSortBy] = useState<FolderSortMode>('name');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2000);
  }, []);

  const course = useMemo(
    () => allCourses.find((c) => c.courseID === courseID),
    [allCourses, courseID],
  );

  const contents = useMemo(
    () => (course ? folderContents(course.courseID, folderID) : null),
    [course, folderContents, folderID],
  );

  const isRoot = folderID === undefined;
  const fallbackFlatFiles = useMemo(() => {
    if (!course || contents || !isRoot || course.files.length === 0) return null;
    return sortFolderFiles(course.files, sortBy);
  }, [course, contents, isRoot, sortBy]);

  const rows = useMemo<FolderBrowserRow[]>(
    () => buildFolderBrowserRows(course, contents, folderContents, sortBy, isRoot),
    [course, contents, folderContents, sortBy, isRoot],
  );

  const navTitle = isRoot ? 'Files' : (contents?.folder.name ?? 'Folder');

  const breadcrumbText = useMemo(() => folderBreadcrumbText(contents), [contents]);

  const openFileActions = useCallback(
    (file: CanvasFile) => {
      if (!course) return;
      const linked = taskForItem('file', file.id);
      const taskActionLabel = linked ? 'Open in My Tasks' : 'Add to My Tasks';

      const handleOpen = () => openCanvasReader(course.courseID, 'file', file.id);
      const handleTask = () => {
        if (linked) {
          router.push(`/task/${linked.id}`);
        } else {
          makeActionable(course.courseID, 'file', file.id);
          showToast('Added to My Tasks');
        }
      };
      const handleCopy = () => {
        const copied = copyToClipboard(file.display_name);
        showToast(copied ? 'Copied file name' : 'Could not access clipboard');
      };

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: file.display_name,
            options: ['Open', taskActionLabel, 'Copy name', 'Cancel'],
            cancelButtonIndex: 3,
          },
          (index) => {
            if (index === 0) handleOpen();
            else if (index === 1) handleTask();
            else if (index === 2) handleCopy();
          },
        );
      } else {
        Alert.alert(file.display_name, undefined, [
          { text: 'Open', onPress: handleOpen },
          { text: taskActionLabel, onPress: handleTask },
          { text: 'Copy name', onPress: handleCopy },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    },
    [course, taskForItem, makeActionable, showToast],
  );

  const openAndroidSortPicker = useCallback(() => {
    Alert.alert('Sort files', undefined, [
      {
        text: sortBy === 'name' ? '✓ Name' : 'Name',
        onPress: () => setSortBy('name'),
      },
      {
        text: sortBy === 'modified' ? '✓ Date modified' : 'Date modified',
        onPress: () => setSortBy('modified'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [sortBy]);

  if (!course) {
    return (
      <>
        <Stack.Screen options={{ title: 'Files' }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="folder"
            title="Course not found"
            description="This course may have been cleared from cache."
          />
        </ScrollView>
      </>
    );
  }

  const hasBrowseableData = !!contents || !!fallbackFlatFiles;

  if (!hasBrowseableData) {
    return (
      <>
        <Stack.Screen options={{ title: navTitle }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustsScrollIndicatorInsets
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        >
          <EmptyState
            icon="lock"
            title={isRoot ? 'Files locked in Canvas' : 'Folder not found'}
            description={
              isRoot
                ? 'This course restricts the Files tab in Canvas, or folders have not been synced yet.'
                : 'This folder is no longer in your cached Canvas data.'
            }
          />
        </ScrollView>
      </>
    );
  }

  const showHeaderMeta = !isRoot || sortBy === 'modified' || !!fallbackFlatFiles;
  const listHeader = showHeaderMeta ? (
    <View style={styles.headerMeta}>
      {!isRoot ? (
        <Text
          style={[typography.caption, { color: colors.textSecondary }]}
          accessibilityLabel={`Canvas, ${course.code}, ${breadcrumbText}`}
        >
          {breadcrumbText}
        </Text>
      ) : null}
      {sortBy === 'modified' ? (
        <Text style={[typography.micro, { color: colors.textTertiary }]}>
          Sorted by date modified
        </Text>
      ) : null}
      {fallbackFlatFiles ? (
        <View
          style={[
            styles.refreshHint,
            { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
          ]}
        >
          <Icon name="refresh" size={14} color={colors.textSecondary} />
          <Text style={[typography.footnote, { color: colors.textSecondary, flex: 1 }]}>
            Pull to refresh Canvas to browse folders in hierarchy.
          </Text>
        </View>
      ) : null}
    </View>
  ) : undefined;

  return (
    <>
      <Stack.Screen
        options={{
          title: navTitle,
          headerLargeTitleEnabled: isRoot,
          ...(Platform.OS !== 'ios'
            ? {
                headerRight: () => (
                  <HeaderIconButton
                    icon="sort"
                    label="Sort files"
                    onPress={openAndroidSortPicker}
                  />
                ),
              }
            : {}),
        }}
      />
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="arrow.up.arrow.down" accessibilityLabel="Sort files">
            <Stack.Toolbar.MenuAction
              isOn={sortBy === 'name'}
              onPress={() => setSortBy('name')}
            >
              Name
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={sortBy === 'modified'}
              onPress={() => setSortBy('modified')}
            >
              Date modified
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}

      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustsScrollIndicatorInsets
          style={{ flex: 1 }}
          contentContainerStyle={rows.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyState
              icon="folder"
              title="This folder is empty"
              description="No files or subfolders in this Canvas folder."
            />
          }
          renderItem={({ item, index }) => {
            const isFirst = index === 0;
            const isLast = index === rows.length - 1;
            const rowBg = spec.tintCanvasSurface ? colors.canvasSurface : colors.surface;
            const rowBorder = spec.tintCanvasSurface ? colors.canvasBorder : colors.border;
            const groupEdges = [
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

            if (item.kind === 'folder') {
              const countText =
                item.itemCount === 0
                  ? 'Empty'
                  : item.itemCount === 1
                    ? '1 item'
                    : `${item.itemCount} items`;
              const a11yCount = item.itemCount === 1 ? '1 item' : `${item.itemCount} items`;

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
                    groupEdges,
                  ]}
                >
                  {!isFirst ? (
                    <View
                      style={{
                        height: hairline,
                        marginLeft: spec.canvasSeparatorInset,
                        backgroundColor: colors.separator,
                      }}
                    />
                  ) : null}
                  <Pressable
                    onPress={() => router.push(`/module/${course.courseID}/files/${item.folder.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Folder, ${item.folder.name}, ${a11yCount}`}
                    accessibilityHint="Opens folder"
                    style={({ pressed }) => [
                      styles.rowHit,
                      { paddingVertical: spec.rowPaddingV },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <CanvasLeadingGlyph icon="folderFill" />
                    <View style={styles.rowBody}>
                      <Text
                        style={{
                          fontSize: spec.titleSize,
                          lineHeight: spec.titleLineHeight,
                          fontWeight: '600',
                          color: colors.text,
                        }}
                        numberOfLines={2}
                      >
                        {item.folder.name}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        {countText}
                      </Text>
                    </View>
                    <Icon name="chevronRight" size={14} color={colors.textTertiary} />
                  </Pressable>
                </View>
              );
            }

            const { file } = item;
            const typeInfo = getFileTypeInfo(file.display_name, file['content-type']);
            const linkedTask = taskForItem('file', file.id);
            const sizeText = formatBytes(file.size);
            const dateText = formatShortDate(file.modified_at ?? file.updated_at);
            const metaLine = [sizeText, dateText].filter(Boolean).slice(0, 2).join(' · ');
            const a11yLabel = [
              'Canvas',
              typeInfo.label,
              file.display_name,
              sizeText || null,
              dateText || null,
              linkedTask ? 'In My tasks' : null,
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
                  groupEdges,
                ]}
              >
                {!isFirst ? (
                  <View
                    style={{
                      height: hairline,
                      marginLeft: spec.canvasSeparatorInset,
                      backgroundColor: colors.separator,
                    }}
                  />
                ) : null}
                <View style={[styles.rowHit, { paddingVertical: spec.rowPaddingV }]}>
                  <Pressable
                    onPress={() => openCanvasReader(course.courseID, 'file', file.id)}
                    onLongPress={() => openFileActions(file)}
                    delayLongPress={350}
                    accessibilityRole="button"
                    accessibilityLabel={a11yLabel}
                    accessibilityHint="Opens file details. Long press for more actions."
                    accessibilityActions={[
                      { name: 'open', label: 'Open' },
                      {
                        name: 'task',
                        label: linkedTask ? 'Open in My Tasks' : 'Add to My Tasks',
                      },
                      { name: 'copy', label: 'Copy name' },
                    ]}
                    onAccessibilityAction={(e) => {
                      if (e.nativeEvent.actionName === 'open') {
                        openCanvasReader(course.courseID, 'file', file.id);
                      } else if (e.nativeEvent.actionName === 'task') {
                        if (linkedTask) router.push(`/task/${linkedTask.id}`);
                        else {
                          makeActionable(course.courseID, 'file', file.id);
                          showToast('Added to My Tasks');
                        }
                      } else if (e.nativeEvent.actionName === 'copy') {
                        const copied = copyToClipboard(file.display_name);
                        showToast(copied ? 'Copied file name' : 'Could not access clipboard');
                      }
                    }}
                    style={({ pressed }) => [styles.fileMainHit, pressed && { opacity: 0.7 }]}
                  >
                    <CanvasLeadingGlyph icon={typeInfo.icon} />

                    <View style={styles.rowBody}>
                      <Text
                        style={{
                          fontSize: spec.titleSize,
                          lineHeight: spec.titleLineHeight,
                          fontWeight: '500',
                          color: colors.text,
                        }}
                        numberOfLines={2}
                      >
                        {file.display_name}
                      </Text>

                      {metaLine ? (
                        <Text
                          style={[typography.caption, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {metaLine}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>

                  {linkedTask ? (
                    <CanvasTaskActionButton
                      linked
                      title={file.display_name}
                      onPress={() => router.push(`/task/${linkedTask.id}`)}
                    />
                  ) : (
                    <Icon name="chevronRight" size={14} color={colors.textTertiary} />
                  )}
                </View>
              </View>
            );
          }}
        />

        {toast ? (
          <View
            pointerEvents="none"
            style={[
              styles.toast,
              { backgroundColor: colors.text, shadowColor: '#000' },
            ]}
            accessibilityLiveRegion="polite"
          >
            <Text style={[typography.caption, { color: colors.bg, fontWeight: '600' }]}>
              {toast}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  headerMeta: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: 6,
  },
  refreshHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: 28,
  },
  pickerGroupWrap: {
    paddingBottom: 16,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  groupRowShell: {
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  rowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
  },
  rowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
  },
  rowHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  fileMainHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  inTasksPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    elevation: 4,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
