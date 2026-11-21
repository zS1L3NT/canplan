import { File, Paths } from 'expo-file-system';
import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SearchBarCommands } from 'react-native-screens';
import { useCanvas } from '../../../canvas/store';
import type { CanvasSection, PlannerTask, SearchHit } from '../../../canvas/types';
import {
  CanvasRow,
  EmptyState,
  FreshnessBar,
  InsetGroup,
  RefreshHeaderButton,
  SectionHeader,
  TaskRow,
  usePullToRefresh,
} from '../../../ui/components';
import { extractQueryTerms, formatShortDate } from '../../../ui/format';
import { Icon } from '../../../ui/Icon';
import { radii, spacing, useTheme } from '../../../ui/theme';

type Scope = 'all' | 'task' | 'canvas';

const QUICK_CHIPS = ['calculator', 'exam', 'password', 'seating', 'cheatsheet'];
const CANVAS_SECTIONS: CanvasSection[] = [
  'Announcements',
  'Assignments',
  'Files',
  'Pages',
  'Quizzes',
  'Discussions',
];
const MAX_RECENT = 8;
const COLLAPSED_LIMIT = 3;

const recentSearchesFile = () => new File(Paths.document, 'recent-searches.json');

type SpotlightGroup = {
  id: string;
  title: string;
  tone?: 'default' | 'accent';
  items: SearchHit[];
};

export default function SearchScreen() {
  const { colors, typography } = useTheme();
  const { courses, tasks, search, indexSize, isAcademic, refresh, refreshing } = useCanvas();
  const { pulling, onRefresh } = usePullToRefresh();
  const searchBarRef = useRef<SearchBarCommands>(null);

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<CanvasSection | null>(null);
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const f = recentSearchesFile();
        if (f.exists) {
          const parsed = JSON.parse(await f.text());
          if (Array.isArray(parsed)) {
            setRecentSearches(
              parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT),
            );
          }
        }
      } catch {
        // Start with empty recent searches if unreadable.
      }
    })();
  }, []);

  const persistRecent = useCallback((next: string[]) => {
    try {
      recentSearchesFile().write(JSON.stringify(next));
    } catch {
      // Non-critical persistence.
    }
  }, []);

  const recordRecent = useCallback(
    (raw: string) => {
      const cleaned = raw.trim();
      if (cleaned.length < 2) return;
      setRecentSearches((prev) => {
        const lower = cleaned.toLowerCase();
        const next = [cleaned, ...prev.filter((item) => item.toLowerCase() !== lower)].slice(
          0,
          MAX_RECENT,
        );
        persistRecent(next);
        return next;
      });
    },
    [persistRecent],
  );

  const clearRecent = useCallback(() => {
    setRecentSearches([]);
    persistRecent([]);
  }, [persistRecent]);

  const dismissSearchKeyboard = useCallback(() => {
    searchBarRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const trimmed = query.trim();
  const terms = useMemo(() => extractQueryTerms(trimmed), [trimmed]);

  const taskById = useMemo(() => {
    const map = new Map<string, PlannerTask>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  const rawHits = useMemo(
    () => (trimmed.length >= 2 ? search(trimmed, selectedCourse ?? undefined) : []),
    [search, trimmed, selectedCourse],
  );

  const filteredHits = useMemo(() => {
    return rawHits.filter((h) => {
      if (scope === 'task' && h.doc.source !== 'task') return false;
      if (scope === 'canvas') {
        if (h.doc.source !== 'canvas') return false;
        if (selectedSection && h.doc.section !== selectedSection) return false;
      }
      return true;
    });
  }, [rawHits, scope, selectedSection]);

  const groups = useMemo<SpotlightGroup[]>(() => {
    const sortTitleFirst = (arr: SearchHit[]) =>
      [...arr].sort((a, b) => {
        if (a.matchedIn !== b.matchedIn) return a.matchedIn === 'title' ? -1 : 1;
        return b.score - a.score;
      });

    const out: SpotlightGroup[] = [];
    const taskHits = filteredHits.filter((h) => h.doc.source === 'task');
    if (taskHits.length > 0) {
      out.push({
        id: 'my-tasks',
        title: 'My tasks',
        tone: 'accent',
        items: sortTitleFirst(taskHits),
      });
    }

    for (const section of CANVAS_SECTIONS) {
      const sectionHits = filteredHits.filter(
        (h) => h.doc.source === 'canvas' && h.doc.section === section,
      );
      if (sectionHits.length > 0) {
        out.push({
          id: `canvas-${section}`,
          title: `Canvas · ${section}`,
          items: sortTitleFirst(sectionHits),
        });
      }
    }
    // In "All", always say whether your tasks matched, so a Canvas-only result list isn't ambiguous.
    if (scope === 'all' && taskHits.length === 0 && out.length > 0) {
      out.unshift({ id: 'my-tasks', title: 'My tasks', tone: 'accent', items: [] });
    }
    return out;
  }, [filteredHits, scope]);

  const hasActiveFilters = scope !== 'all' || selectedCourse !== null || selectedSection !== null;

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedCourse) parts.push(selectedCourse);
    if (scope === 'task') parts.push('My tasks');
    else if (scope === 'canvas') {
      parts.push(selectedSection ? `Canvas · ${selectedSection}` : 'Canvas');
    }
    return parts.join(' · ');
  }, [selectedCourse, scope, selectedSection]);

  const resetAllFilters = () => {
    dismissSearchKeyboard();
    setScope('all');
    setSelectedCourse(null);
    setSelectedSection(null);
  };

  const applyQuickQuery = (q: string) => {
    dismissSearchKeyboard();
    setQuery(q);
    searchBarRef.current?.setText(q);
    recordRecent(q);
    setExpandedGroups({});
  };

  const clearQuery = () => {
    setQuery('');
    searchBarRef.current?.clearText();
    setExpandedGroups({});
  };

  const toggleGroupExpanded = (id: string) => {
    dismissSearchKeyboard();
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderHit = (hit: SearchHit, idx: number) => {
    const { doc } = hit;
    if (doc.source === 'task' && doc.taskID) {
      const task = taskById.get(doc.taskID);
      if (!task) return null;
      return (
        <TaskRow
          key={doc.id}
          task={task}
          context="search"
          groupPosition="grouped"
          showTopSeparator={idx > 0}
          highlightTerms={terms}
          snippet={hit.snippet}
          onPress={() => {
            recordRecent(trimmed);
            router.push(`/task/${task.id}`);
          }}
        />
      );
    }

    if (
      doc.source === 'canvas' &&
      doc.kind &&
      doc.courseID !== undefined &&
      doc.itemID !== undefined
    ) {
      return (
        <CanvasRow
          key={doc.id}
          courseID={doc.courseID}
          courseCode={doc.courseCode ?? ''}
          kind={doc.kind}
          itemID={doc.itemID}
          title={doc.title}
          context="search"
          groupPosition="grouped"
          showTopSeparator={idx > 0}
          location={doc.location}
          rawDate={doc.date}
          metaDate={doc.date ? formatShortDate(doc.date) : undefined}
          preview={hit.snippet}
          highlightTerms={terms}
          matchedIn={hit.matchedIn}
          showConvertButton={doc.kind === 'assignment'}
          onOpen={() => recordRecent(trimmed)}
        />
      );
    }

    return null;
  };

  return (
    <>
      <Stack.SearchBar
        ref={searchBarRef}
        placement="automatic"
        placeholder="Search my tasks & Canvas…"
        autoCapitalize="none"
        hideWhenScrolling={false}
        obscureBackground={false}
        tintColor={colors.accent}
        textColor={colors.text}
        hintTextColor={colors.textTertiary}
        headerIconColor={colors.accent}
        onChangeText={(event) => {
          setQuery(event.nativeEvent.text);
          setExpandedGroups({});
        }}
        onSearchButtonPress={(event) => {
          const text = event.nativeEvent.text ?? query;
          recordRecent(text);
          dismissSearchKeyboard();
        }}
        onCancelButtonPress={() => {
          setQuery('');
          setExpandedGroups({});
        }}
        onClose={() => {
          setQuery('');
          setExpandedGroups({});
        }}
      />

      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
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
                <RefreshHeaderButton />
              </View>
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
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Filters below native search bar */}
        <View style={styles.topControls}>
          <View style={styles.filterRow}>
            <View
              style={[
                styles.segmentTrack,
                {
                  backgroundColor: colors.dark ? colors.surface : colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              {(
                [
                  ['all', 'All'],
                  ['task', 'My tasks'],
                  ['canvas', 'Canvas'],
                ] as [Scope, string][]
              ).map(([id, label]) => {
                const active = scope === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      dismissSearchKeyboard();
                      setScope(id);
                      if (id !== 'canvas') setSelectedSection(null);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.segmentBtn,
                      active && {
                        backgroundColor: colors.dark ? colors.surfaceSecondary : colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption,
                        {
                          color: active ? colors.text : colors.textSecondary,
                          fontWeight: active ? '600' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => {
                dismissSearchKeyboard();
                setCoursePickerOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                selectedCourse ? `Course filter: ${selectedCourse}` : 'Course filter: All courses'
              }
              style={[
                styles.courseFilterChip,
                {
                  backgroundColor: selectedCourse ? colors.accentSoft : colors.surface,
                  borderColor: selectedCourse ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  typography.caption,
                  styles.courseFilterText,
                  { color: selectedCourse ? colors.accentText : colors.text },
                ]}
                numberOfLines={1}
              >
                {selectedCourse ?? 'All courses'}
              </Text>
              <Icon
                name="chevronDown"
                size={12}
                color={selectedCourse ? colors.accentText : colors.textSecondary}
              />
            </Pressable>
          </View>

          {scope === 'canvas' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0 }}
              contentContainerStyle={[styles.sectionChipRow, { alignItems: 'center' }]}
            >
              {CANVAS_SECTIONS.map((sec) => {
                const active = selectedSection === sec;
                return (
                  <Pressable
                    key={sec}
                    onPress={() => {
                      dismissSearchKeyboard();
                      setSelectedSection(active ? null : sec);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.sectionChip,
                      {
                        backgroundColor: active ? colors.accent : colors.canvasSurface,
                        borderColor: active ? colors.accent : colors.canvasBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption,
                        { color: active ? colors.onAccent : colors.text },
                      ]}
                    >
                      {sec}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        {/* Body: idle vs Spotlight results */}
        {trimmed.length === 0 ? (
          <View style={styles.idleContent}>
            <FreshnessBar style={{ paddingHorizontal: 0 }} />

            <Text style={[typography.caption, styles.groupLabel, { color: colors.textSecondary }]}>
              QUICK SEARCH
            </Text>
            <View style={styles.quickChipWrap}>
              {QUICK_CHIPS.map((chip) => (
                <Pressable
                  key={chip}
                  onPress={() => applyQuickQuery(chip)}
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${chip}`}
                  style={({ pressed }) => [
                    styles.quickChip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Icon name="search" size={13} color={colors.textSecondary} />
                  <Text style={[typography.subhead, { color: colors.text }]}>{chip}</Text>
                </Pressable>
              ))}
            </View>

            {recentSearches.length > 0 ? (
              <>
                <View style={styles.recentHeaderRow}>
                  <Text
                    style={[typography.caption, styles.groupLabel, { color: colors.textSecondary }]}
                  >
                    RECENT SEARCHES
                  </Text>
                  <Pressable
                    onPress={() => {
                      dismissSearchKeyboard();
                      clearRecent();
                    }}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Text style={[typography.caption, { color: colors.accentText }]}>Clear</Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.card,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {recentSearches.map((item, idx) => (
                    <Pressable
                      key={`${item}-${idx}`}
                      onPress={() => applyQuickQuery(item)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.recentRow,
                        idx > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: colors.separator,
                        },
                        pressed && { backgroundColor: colors.pressed },
                      ]}
                    >
                      <Icon name="clock" size={15} color={colors.textTertiary} />
                      <Text
                        style={[typography.body, { color: colors.text, flex: 1 }]}
                        numberOfLines={1}
                      >
                        {item}
                      </Text>
                      <Icon name="chevronRight" size={14} color={colors.textTertiary} />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <View
              style={[
                styles.indexCard,
                { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
              ]}
            >
              <Text
                style={[typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}
              >
                OFFLINE INDEX READY
              </Text>
              <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                {indexSize} searchable items across {courses.length} visible courses and{' '}
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}.
              </Text>
            </View>
          </View>
        ) : trimmed.length < 2 ? (
          <EmptyState
            icon="search"
            title="Keep typing…"
            description="Enter at least 2 characters to search your tasks and Canvas content."
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon="search"
            title={`No matches for "${trimmed}"`}
            description={
              hasActiveFilters
                ? `Active filters: ${activeFilterSummary}. Try searching everything or widening your keywords.`
                : 'Try shorter keywords like "calculator", "exam", or "seating".'
            }
            actionLabel={hasActiveFilters ? 'Search all courses / everything' : 'Clear search'}
            onAction={() => {
              if (hasActiveFilters) resetAllFilters();
              else clearQuery();
            }}
          />
        ) : (
          <View style={styles.resultsContent}>
            {groups.map((group) => {
              const expanded = !!expandedGroups[group.id];
              const visibleItems = expanded
                ? group.items
                : group.items.slice(0, COLLAPSED_LIMIT);
              const hiddenCount = group.items.length - visibleItems.length;

              return (
                <View key={group.id}>
                  <SectionHeader
                    title={group.title}
                    subtitle={`${group.items.length}`}
                    tone={group.tone}
                  />
                  {group.items.length === 0 ? (
                    <Text
                      style={[
                        typography.footnote,
                        styles.noTaskMatch,
                        { color: colors.textTertiary },
                      ]}
                    >
                      No matching tasks
                    </Text>
                  ) : (
                    <InsetGroup kind={group.id === 'my-tasks' ? 'mine' : 'canvas'}>
                      {visibleItems.map((hit, idx) => renderHit(hit, idx))}
                    </InsetGroup>
                  )}
                  {group.items.length > COLLAPSED_LIMIT ? (
                    <Pressable
                      onPress={() => toggleGroupExpanded(group.id)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.showAllBtn,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.accentText, fontWeight: '600' },
                        ]}
                      >
                        {expanded
                          ? `Show top ${COLLAPSED_LIMIT}`
                          : `Show all ${group.items.length} (+${hiddenCount} more)`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Course filter sheet modal */}
      <Modal
        visible={coursePickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCoursePickerOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={[styles.modalBar, { borderBottomColor: colors.separator }]}>
            <Text style={[typography.headline, { color: colors.text }]}>Filter by course</Text>
            <Pressable
              onPress={() => setCoursePickerOpen(false)}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={[typography.bodySemibold, { color: colors.accent }]}>Done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Pressable
                onPress={() => {
                  setSelectedCourse(null);
                  setCoursePickerOpen(false);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.modalRow,
                  pressed && { backgroundColor: colors.pressed },
                ]}
              >
                <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]}>
                  All courses
                </Text>
                {selectedCourse === null ? (
                  <Icon name="check" size={16} color={colors.accent} />
                ) : null}
              </Pressable>

              {courses.map((c) => {
                const active = selectedCourse === c.code;
                return (
                  <Pressable
                    key={c.courseID}
                    onPress={() => {
                      setSelectedCourse(c.code);
                      setCoursePickerOpen(false);
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.modalRow,
                      {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.separator,
                      },
                      pressed && { backgroundColor: colors.pressed },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[typography.bodyMedium, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {c.code}
                      </Text>
                      <Text
                        style={[typography.caption, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {isAcademic(c) ? c.term : 'Other (non-academic)'}
                        {c.name && c.name !== c.code ? ` · ${c.name}` : ''}
                      </Text>
                    </View>
                    {active ? <Icon name="check" size={16} color={colors.accent} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerRight: { paddingRight: spacing.sm },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  topControls: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  segmentTrack: {
    flex: 1,
    flexDirection: 'row',
    padding: 3,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 2,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: radii.sm,
  },
  courseFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    maxWidth: 148,
  },
  courseFilterText: {
    flexShrink: 1,
  },
  sectionChipRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  sectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  idleContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
  },
  groupLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    letterSpacing: 0.5,
  },
  quickChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
  },
  indexCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4,
  },
  resultsContent: {
    paddingBottom: 12,
  },
  noTaskMatch: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  showAllBtn: {
    marginHorizontal: spacing.lg,
    marginTop: 4,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
  },
  modalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
  },
});
