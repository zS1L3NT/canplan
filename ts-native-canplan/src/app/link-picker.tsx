import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SearchBarCommands } from 'react-native-screens';
import { useCanvas } from '../canvas/store';
import {
  stripHTML,
  type CanvasSection,
  type CourseSnapshot,
  type FeedKind,
  type SearchHit,
  type SourceRef,
} from '../canvas/types';
import {
  EmptyState,
  HighlightedText,
  kindIconName,
  SectionHeader,
} from '../ui/components';
import { getFileTypeInfo } from '../ui/fileType';
import {
  FolderBrowserPickerList,
  folderBreadcrumbText,
} from '../ui/FolderBrowserScreen';
import {
  extractQueryTerms,
  formatDueText,
  formatRelative,
  formatShortDate,
  useNow,
} from '../ui/format';
import { Icon, type IconName } from '../ui/Icon';
import { radii, spacing, useTheme } from '../ui/theme';

const CANVAS_SECTIONS: CanvasSection[] = [
  'Announcements',
  'Assignments',
  'Files',
  'Pages',
  'Quizzes',
  'Discussions',
];

const BROWSE_SECTIONS: { section: CanvasSection; icon: IconName }[] = [
  { section: 'Files', icon: 'folder' },
  { section: 'Assignments', icon: 'assignment' },
  { section: 'Announcements', icon: 'announcement' },
  { section: 'Pages', icon: 'page' },
  { section: 'Quizzes', icon: 'quiz' },
  { section: 'Discussions', icon: 'discussion' },
];

type LinkState = 'source' | 'linked' | false;

type BrowseItem = {
  ref: SourceRef;
  title: string;
  meta?: string;
  preview?: string;
  icon: IconName;
};

function sameRef(a?: SourceRef, b?: SourceRef): boolean {
  return !!a && !!b && a.courseID === b.courseID && a.kind === b.kind && a.itemID === b.itemID;
}

function sectionCount(course: CourseSnapshot, section: CanvasSection): number {
  switch (section) {
    case 'Files':
      return course.files.length;
    case 'Assignments':
      return course.assignments.length;
    case 'Announcements':
      return course.announcements.length;
    case 'Pages':
      return course.pages.length;
    case 'Quizzes':
      return course.quizzes?.length ?? 0;
    case 'Discussions':
      return course.discussions?.length ?? 0;
  }
}

export default function LinkPickerModal() {
  const { taskID } = useLocalSearchParams<{ taskID: string }>();
  const { colors, typography, hairline } = useTheme();
  const {
    tasks,
    courses,
    allCourses,
    search,
    linkItem,
    unlinkItem,
    linkedItemsOf,
    folderContents,
  } = useCanvas();
  const nowMs = useNow();
  const searchBarRef = useRef<SearchBarCommands>(null);

  const task = useMemo(() => tasks.find((t) => t.id === taskID), [tasks, taskID]);

  const defaultCourseCode = useMemo(() => {
    const code =
      task?.courseCode ??
      (task?.source ? allCourses.find((c) => c.courseID === task.source?.courseID)?.code : undefined);
    if (!code) return null;
    return allCourses.some((c) => c.code === code) ? code : null;
  }, [task, allCourses]);

  const [query, setQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(defaultCourseCode);
  const [browseSection, setBrowseSection] = useState<CanvasSection | null>(null);
  const [browseFolderID, setBrowseFolderID] = useState<number | undefined>(undefined);

  const dismissKeyboard = useCallback(() => {
    searchBarRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const orderedCourses = useMemo(() => {
    const base = [...courses];
    if (defaultCourseCode && !base.some((c) => c.code === defaultCourseCode)) {
      const hiddenCourse = allCourses.find((c) => c.code === defaultCourseCode);
      if (hiddenCourse) base.unshift(hiddenCourse);
    }
    if (!defaultCourseCode) return base;
    return base.sort((a, b) => {
      if (a.code === defaultCourseCode) return -1;
      if (b.code === defaultCourseCode) return 1;
      return 0;
    });
  }, [courses, allCourses, defaultCourseCode]);

  const getLinkState = useCallback(
    (ref: SourceRef): LinkState => {
      if (!task) return false;
      if (sameRef(task.source, ref)) return 'source';
      if ((task.links ?? []).some((l) => sameRef(l, ref))) return 'linked';
      return false;
    },
    [task],
  );

  const toggleRef = useCallback(
    (ref: SourceRef) => {
      if (!task) return;
      if (getLinkState(ref)) {
        unlinkItem(task.id, ref);
      } else {
        linkItem(task.id, ref);
      }
    },
    [task, getLinkState, unlinkItem, linkItem],
  );

  const handleSelectCourse = useCallback(
    (code: string | null) => {
      dismissKeyboard();
      setSelectedCourse(code);
      setBrowseSection(null);
      setBrowseFolderID(undefined);
    },
    [dismissKeyboard],
  );

  const trimmed = query.trim();
  const terms = useMemo(() => extractQueryTerms(trimmed), [trimmed]);

  const searchGroups = useMemo(() => {
    if (trimmed.length < 2) return [];
    const hits = search(trimmed, selectedCourse ?? undefined).filter(
      (h) => h.doc.source === 'canvas',
    );
    const sortTitleFirst = (arr: SearchHit[]) =>
      [...arr].sort((a, b) => {
        if (a.matchedIn !== b.matchedIn) return a.matchedIn === 'title' ? -1 : 1;
        return b.score - a.score;
      });
    const out: { section: CanvasSection; title: string; items: SearchHit[] }[] = [];
    for (const section of CANVAS_SECTIONS) {
      const sectionHits = hits.filter((h) => h.doc.section === section);
      if (sectionHits.length > 0) {
        out.push({
          section,
          title: `Canvas · ${section}`,
          items: sortTitleFirst(sectionHits),
        });
      }
    }
    return out;
  }, [trimmed, search, selectedCourse]);

  const browseCourse = useMemo(
    () => (selectedCourse ? allCourses.find((c) => c.code === selectedCourse) ?? null : null),
    [selectedCourse, allCourses],
  );

  const currentFolderContents = useMemo(
    () =>
      browseCourse && browseSection === 'Files'
        ? folderContents(browseCourse.courseID, browseFolderID)
        : null,
    [browseCourse, browseSection, folderContents, browseFolderID],
  );

  const browseItems = useMemo<BrowseItem[]>(() => {
    if (!browseCourse || !browseSection || browseSection === 'Files') return [];
    const cid = browseCourse.courseID;

    if (browseSection === 'Assignments') {
      return [...browseCourse.assignments]
        .sort((a, b) => {
          const aDue = a.due_at ?? '';
          const bDue = b.due_at ?? '';
          if (aDue && bDue) return bDue.localeCompare(aDue);
          if (aDue) return -1;
          if (bDue) return 1;
          return a.name.localeCompare(b.name, undefined, { numeric: true });
        })
        .map((a) => ({
          ref: { courseID: cid, kind: 'assignment', itemID: a.id },
          title: a.name,
          meta: a.due_at ? formatDueText(a.due_at, nowMs) : 'No due date',
          preview:
            a.points_possible !== undefined && a.points_possible !== null
              ? `${a.points_possible} pts`
              : undefined,
          icon: 'assignment',
        }));
    }

    if (browseSection === 'Announcements') {
      return [...browseCourse.announcements]
        .sort((a, b) => (b.posted_at ?? '').localeCompare(a.posted_at ?? ''))
        .map((a) => ({
          ref: { courseID: cid, kind: 'announcement', itemID: a.id },
          title: a.title,
          meta: a.posted_at ? formatShortDate(a.posted_at) : undefined,
          preview: stripHTML(a.message) || undefined,
          icon: 'announcement',
        }));
    }

    if (browseSection === 'Pages') {
      return [...browseCourse.pages]
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
        .map((p) => ({
          ref: { courseID: cid, kind: 'page', itemID: p.page_id },
          title: p.title,
          meta: p.updated_at ? `Updated ${formatShortDate(p.updated_at)}` : undefined,
          icon: 'page',
        }));
    }

    if (browseSection === 'Quizzes') {
      return [...(browseCourse.quizzes ?? [])]
        .sort((a, b) => (b.due_at ?? b.lock_at ?? '').localeCompare(a.due_at ?? a.lock_at ?? ''))
        .map((q) => ({
          ref: { courseID: cid, kind: 'quiz', itemID: q.id },
          title: q.title,
          meta: q.due_at ? formatDueText(q.due_at, nowMs) : 'No due date',
          icon: 'quiz',
        }));
    }

    return [...(browseCourse.discussions ?? [])]
      .sort((a, b) =>
        (b.last_reply_at ?? b.posted_at ?? '').localeCompare(a.last_reply_at ?? a.posted_at ?? ''),
      )
      .map((d) => ({
        ref: { courseID: cid, kind: 'discussion', itemID: d.id },
        title: d.title,
        meta: d.last_reply_at
          ? `Last reply ${formatRelative(d.last_reply_at, nowMs)}`
          : d.posted_at
            ? formatShortDate(d.posted_at)
            : undefined,
        preview: stripHTML(d.message) || undefined,
        icon: 'discussion',
      }));
  }, [browseCourse, browseSection, nowMs]);

  const linkedCount = task ? linkedItemsOf(task).length : 0;

  const handleBrowseBack = useCallback(() => {
    if (browseSection === 'Files' && currentFolderContents && currentFolderContents.path.length > 1) {
      const parent = currentFolderContents.path[currentFolderContents.path.length - 2];
      setBrowseFolderID(parent.parent_folder_id === null ? undefined : parent.id);
      return;
    }
    setBrowseSection(null);
    setBrowseFolderID(undefined);
  }, [browseSection, currentFolderContents]);

  const handleDone = useCallback(() => {
    dismissKeyboard();
    router.back();
  }, [dismissKeyboard]);

  const renderLinkPill = (state: LinkState) => {
    if (!state) return null;
    return (
      <View style={[styles.linkedPill, { backgroundColor: colors.accentSoft }]}>
        <Icon name="check" size={12} color={colors.accentText} />
        <Text style={[typography.caption, { color: colors.accentText, fontWeight: '600' }]}>
          {state === 'source' ? 'Source' : 'Linked'}
        </Text>
      </View>
    );
  };

  if (!task) {
    return (
      <>
        <Stack.Screen options={{ title: 'Link Canvas item' }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={styles.emptyContainer}
        >
          <EmptyState
            icon="link"
            title="Task not found"
            description="This task is no longer in your list."
            actionLabel="Done"
            onAction={() => router.back()}
          />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.SearchBar
        ref={searchBarRef}
        placement="automatic"
        placeholder="Search Canvas items…"
        autoCapitalize="none"
        hideWhenScrolling={false}
        obscureBackground={false}
        tintColor={colors.accent}
        textColor={colors.text}
        hintTextColor={colors.textTertiary}
        headerIconColor={colors.accent}
        onChangeText={(event) => {
          setQuery(event.nativeEvent.text);
        }}
        onSearchButtonPress={() => {
          dismissKeyboard();
        }}
        onCancelButtonPress={() => {
          setQuery('');
        }}
        onClose={() => {
          setQuery('');
        }}
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
            title: 'Link Canvas item',
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

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {/* Task context + count */}
        <View style={styles.contextRow}>
          <Text
            style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}
            numberOfLines={1}
          >
            Linking to <Text style={{ color: colors.text, fontWeight: '600' }}>{task.title}</Text>
          </Text>
          {linkedCount > 0 ? (
            <Text style={[typography.caption, { color: colors.accentText, fontWeight: '600' }]}>
              {linkedCount} linked
            </Text>
          ) : null}
        </View>

        {/* Course scope chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // A horizontal ScrollView in a flex column grows to fill the height unless told not to.
          style={styles.chipScroll}
          contentContainerStyle={styles.scopeChipRow}
        >
          <Pressable
            onPress={() => handleSelectCourse(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCourse === null }}
            style={[
              styles.scopeChip,
              {
                backgroundColor: selectedCourse === null ? colors.accent : colors.surface,
                borderColor: selectedCourse === null ? colors.accent : colors.border,
              },
            ]}
          >
            <Text
              style={[
                typography.caption,
                { color: selectedCourse === null ? colors.onAccent : colors.text },
              ]}
            >
              All courses
            </Text>
          </Pressable>
          {orderedCourses.map((c) => {
            const active = selectedCourse === c.code;
            return (
              <Pressable
                key={c.courseID}
                onPress={() => handleSelectCourse(c.code)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.scopeChip,
                  {
                    backgroundColor: active ? colors.accent : colors.surface,
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.caption,
                    { color: active ? colors.onAccent : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {c.code}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Search mode vs Browse mode */}
        {trimmed.length === 1 ? (
          <EmptyState
            icon="search"
            title="Keep typing…"
            description="Enter at least 2 characters to search Canvas items."
          />
        ) : trimmed.length >= 2 ? (
          searchGroups.length === 0 ? (
            <EmptyState
              icon="search"
              title={`No Canvas matches for "${trimmed}"`}
              description={
                selectedCourse
                  ? `Nothing matched in ${selectedCourse}. Try searching all courses.`
                  : 'Try another keyword or browse a course below.'
              }
              actionLabel={selectedCourse ? 'Search all courses' : undefined}
              onAction={selectedCourse ? () => handleSelectCourse(null) : undefined}
            />
          ) : (
            <View style={styles.resultsWrap}>
              {searchGroups.map((group) => (
                <View key={group.section}>
                  <SectionHeader title={group.title} subtitle={`${group.items.length}`} />
                  {group.items.map((hit) => {
                    const { doc } = hit;
                    if (
                      doc.kind === undefined ||
                      doc.courseID === undefined ||
                      doc.itemID === undefined
                    ) {
                      return null;
                    }
                    const ref: SourceRef = {
                      courseID: doc.courseID,
                      kind: doc.kind as FeedKind,
                      itemID: doc.itemID,
                    };
                    const linkState = getLinkState(ref);
                    const overline = ['Canvas', doc.courseCode, ...doc.location]
                      .filter(Boolean)
                      .join(' › ');
                    const metaDate = doc.date ? formatShortDate(doc.date) : '';
                    const iconName =
                      doc.kind === 'file'
                        ? getFileTypeInfo(doc.title).icon
                        : kindIconName(doc.kind);

                    return (
                      <Pressable
                        key={doc.id}
                        onPress={() => toggleRef(ref)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: !!linkState }}
                        accessibilityLabel={`${overline}, ${doc.title}${linkState ? ', linked' : ''}`}
                        style={({ pressed }) => [
                          styles.pickerCard,
                          {
                            backgroundColor: colors.canvasSurface,
                            borderColor: linkState ? colors.accent : colors.canvasBorder,
                          },
                          pressed && { opacity: 0.72 },
                        ]}
                      >
                        <View
                          style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}
                          importantForAccessibility="no-hide-descendants"
                        >
                          <Icon name={iconName} size={16} color={colors.textSecondary} />
                        </View>
                        <View style={styles.rowBody}>
                          <Text
                            style={[typography.caption, { color: colors.textSecondary }]}
                            numberOfLines={2}
                          >
                            <Text style={{ fontWeight: '600' }}>{overline}</Text>
                            {metaDate ? (
                              <Text style={{ color: colors.textTertiary }}>{` · ${metaDate}`}</Text>
                            ) : null}
                          </Text>
                          <HighlightedText
                            text={doc.title}
                            terms={terms}
                            style={[
                              hit.matchedIn === 'body'
                                ? typography.body
                                : typography.bodySemibold,
                              { color: colors.text },
                            ]}
                            numberOfLines={2}
                          />
                          {hit.snippet ? (
                            <HighlightedText
                              text={hit.snippet}
                              terms={terms}
                              style={[typography.footnote, { color: colors.textSecondary }]}
                              numberOfLines={2}
                            />
                          ) : null}
                        </View>
                        {renderLinkPill(linkState)}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          )
        ) : !browseCourse ? (
          /* All courses selected, browse by picking a module */
          <View>
            <SectionHeader title="Browse a module" subtitle={`${orderedCourses.length}`} />
            {orderedCourses.length === 0 ? (
              <EmptyState
                icon="modules"
                title="No cached Canvas courses"
                description="Refresh Canvas first to browse and link items."
              />
            ) : (
              <View
                style={[
                  styles.groupedCard,
                  { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
                ]}
              >
                {orderedCourses.map((c, idx) => (
                  <Pressable
                    key={c.courseID}
                    onPress={() => handleSelectCourse(c.code)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.sectionRow,
                      idx > 0 && { borderTopWidth: hairline, borderTopColor: colors.separator },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
                      <Icon name="modules" size={16} color={colors.textSecondary} />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[typography.bodySemibold, { color: colors.text }]} numberOfLines={1}>
                        {c.code}
                      </Text>
                      {c.name && c.name !== c.code ? (
                        <Text
                          style={[typography.caption, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                      ) : null}
                    </View>
                    <Icon name="chevronRight" size={15} color={colors.textTertiary} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : browseSection === null ? (
          /* Module sections list */
          <View>
            <SectionHeader title={`Canvas · ${browseCourse.code}`} />
            <View
              style={[
                styles.groupedCard,
                { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
              ]}
            >
              {BROWSE_SECTIONS.map(({ section, icon }, idx) => {
                const count = sectionCount(browseCourse, section);
                const hasFolders =
                  section === 'Files' && (browseCourse.folders?.length ?? 0) > 0;
                const disabled = count === 0 && !hasFolders;
                return (
                  <Pressable
                    key={section}
                    disabled={disabled}
                    onPress={() => {
                      dismissKeyboard();
                      setBrowseSection(section);
                      setBrowseFolderID(undefined);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ disabled }}
                    style={({ pressed }) => [
                      styles.sectionRow,
                      idx > 0 && { borderTopWidth: hairline, borderTopColor: colors.separator },
                      pressed && !disabled && { opacity: 0.7 },
                      disabled && { opacity: 0.45 },
                    ]}
                  >
                    <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
                      <Icon
                        name={icon}
                        size={16}
                        color={disabled ? colors.textTertiary : colors.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        typography.bodyMedium,
                        { color: disabled ? colors.textSecondary : colors.text, flex: 1 },
                      ]}
                    >
                      {section}
                    </Text>
                    <Text style={[typography.subhead, { color: colors.textSecondary }]}>
                      {count}
                    </Text>
                    {!disabled ? (
                      <Icon name="chevronRight" size={15} color={colors.textTertiary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : browseSection === 'Files' ? (
          /* Reused Canvas folder browser for Files */
          <View>
            <View style={styles.browseBar}>
              <Pressable
                onPress={handleBrowseBack}
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
              >
                <Text style={[typography.subhead, { color: colors.accent, fontWeight: '600' }]}>
                  ‹{' '}
                  {currentFolderContents && currentFolderContents.path.length > 1
                    ? currentFolderContents.path[currentFolderContents.path.length - 2].parent_folder_id === null
                      ? 'Files'
                      : currentFolderContents.path[currentFolderContents.path.length - 2].name
                    : browseCourse.code}
                </Text>
              </Pressable>
              <Text
                style={[typography.caption, { color: colors.textSecondary, flex: 1, textAlign: 'right' }]}
                numberOfLines={1}
              >
                {folderBreadcrumbText(currentFolderContents)}
              </Text>
            </View>

            <FolderBrowserPickerList
              course={browseCourse}
              folderID={browseFolderID}
              onSelectFolder={(folder) => setBrowseFolderID(folder.id)}
              onToggleFile={(file) =>
                toggleRef({ courseID: browseCourse.courseID, kind: 'file', itemID: file.id })
              }
              getFileLinkState={(file) =>
                getLinkState({ courseID: browseCourse.courseID, kind: 'file', itemID: file.id })
              }
            />
          </View>
        ) : (
          /* Other Canvas section items */
          <View>
            <View style={styles.browseBar}>
              <Pressable
                onPress={handleBrowseBack}
                accessibilityRole="button"
                accessibilityLabel={`Back to ${browseCourse.code}`}
                hitSlop={8}
                style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
              >
                <Text style={[typography.subhead, { color: colors.accent, fontWeight: '600' }]}>
                  ‹ {browseCourse.code}
                </Text>
              </Pressable>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Canvas · {browseSection} ({browseItems.length})
              </Text>
            </View>

            {browseItems.length === 0 ? (
              <EmptyState
                icon={BROWSE_SECTIONS.find((s) => s.section === browseSection)?.icon ?? 'modules'}
                title={`No ${browseSection.toLowerCase()}`}
                description={`Nothing cached under ${browseSection} for ${browseCourse.code}.`}
              />
            ) : (
              browseItems.map((item) => {
                const linkState = getLinkState(item.ref);
                return (
                  <Pressable
                    key={`${item.ref.kind}-${item.ref.itemID}`}
                    onPress={() => toggleRef(item.ref)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !!linkState }}
                    accessibilityLabel={`Canvas, ${browseCourse.code}, ${browseSection}, ${item.title}${linkState ? ', linked' : ''}`}
                    style={({ pressed }) => [
                      styles.pickerCard,
                      {
                        backgroundColor: colors.canvasSurface,
                        borderColor: linkState ? colors.accent : colors.canvasBorder,
                      },
                      pressed && { opacity: 0.72 },
                    ]}
                  >
                    <View
                      style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}
                      importantForAccessibility="no-hide-descendants"
                    >
                      <Icon name={item.icon} size={16} color={colors.textSecondary} />
                    </View>
                    <View style={styles.rowBody}>
                      <Text
                        style={[typography.bodySemibold, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                      {item.meta ? (
                        <Text
                          style={[typography.caption, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {item.meta}
                        </Text>
                      ) : null}
                      {item.preview ? (
                        <Text
                          style={[typography.footnote, { color: colors.textSecondary }]}
                          numberOfLines={2}
                        >
                          {item.preview}
                        </Text>
                      ) : null}
                    </View>
                    {renderLinkPill(linkState)}
                  </Pressable>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 36,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  chipScroll: { flexGrow: 0 },
  scopeChipRow: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    maxWidth: 180,
  },
  resultsWrap: {
    paddingBottom: 16,
  },
  groupedCard: {
    marginHorizontal: spacing.lg,
    marginTop: 2,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  browseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    paddingVertical: 2,
  },
  pickerCard: {
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
