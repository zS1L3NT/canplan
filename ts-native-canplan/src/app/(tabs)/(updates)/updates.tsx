import { Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { dayKey, useCanvas } from '../../../canvas/store';
import type { FeedItem } from '../../../canvas/types';
import {
  CanvasRow,
  ChipRow,
  EmptyState,
  FreshnessBar,
  HeaderIconButton,
  RefreshHeaderButton,
  rowPosition,
  SectionHeader,
  usePullToRefresh,
} from '../../../ui/components';
import { formatDayHeading, formatRelative, useNow } from '../../../ui/format';
import { spacing, useTheme } from '../../../ui/theme';

export default function UpdatesScreen() {
  const { colors } = useTheme();
  const { courses, feed, seen, unseenCount, markSeen, markAllSeen, refresh, refreshing } =
    useCanvas();
  const { pulling, onRefresh } = usePullToRefresh();
  const nowMs = useNow();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  const unseenByCourse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of feed) {
      if (!seen.has(item.id)) {
        counts.set(item.courseCode, (counts.get(item.courseCode) ?? 0) + 1);
      }
    }
    return counts;
  }, [feed, seen]);

  const chips = useMemo(
    () =>
      courses.map((c) => {
        const count = unseenByCourse.get(c.code) ?? 0;
        return { id: c.code, label: c.code, dot: count > 0, count: count > 0 ? count : undefined };
      }),
    [courses, unseenByCourse],
  );

  const sections = useMemo(() => {
    const filtered = selectedCourse
      ? feed.filter((item) => item.courseCode === selectedCourse)
      : feed;
    const byDay = new Map<string, FeedItem[]>();
    for (const item of filtered) {
      const d = new Date(item.date);
      const key = Number.isNaN(d.getTime()) ? 'Unknown' : dayKey(d);
      const list = byDay.get(key);
      if (list) list.push(item);
      else byDay.set(key, [item]);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, data]) => ({
        key,
        title: formatDayHeading(key, nowMs),
        data: data.sort((a, b) => b.date.localeCompare(a.date)),
      }));
  }, [feed, selectedCourse, nowMs]);

  return (
    <>
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="checkmark.circle"
            accessibilityLabel="Mark all updates as seen"
            disabled={unseenCount === 0}
            onPress={markAllSeen}
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
                  icon="doneAll"
                  label="Mark all updates as seen"
                  disabled={unseenCount === 0}
                  onPress={markAllSeen}
                />
                <RefreshHeaderButton />
              </View>
            ),
          }}
        />
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
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
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <FreshnessBar />
            {courses.length > 0 ? (
              <ChipRow
                chips={chips}
                selectedId={selectedCourse}
                onSelect={setSelectedCourse}
              />
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} subtitle={`${section.data.length}`} />
        )}
        renderItem={({ item, index, section }) => (
          <CanvasRow
            courseID={item.courseID}
            courseCode={item.courseCode}
            kind={item.kind}
            itemID={item.itemID}
            title={item.title}
            context="updates"
            groupPosition={rowPosition(index, section.data.length)}
            metaDate={formatRelative(item.date, nowMs)}
            preview={item.detail}
            change={item.change}
            unseen={!seen.has(item.id)}
            showConvertButton={item.kind === 'assignment'}
            swipeable
            onOpen={() => markSeen(item.id)}
          />
        )}
        ListEmptyComponent={
          !refreshing ? (
            <EmptyState
              icon="checkCircle"
              title={selectedCourse ? `Nothing new in ${selectedCourse}` : 'All caught up'}
              description={
                selectedCourse
                  ? 'No recent Canvas announcements, files, or deadline changes for this course.'
                  : 'New Canvas announcements, uploaded files, and deadline changes will appear here. Swipe right on any update to add it to My tasks.'
              }
              actionLabel={selectedCourse ? 'Show all courses' : undefined}
              onAction={selectedCourse ? () => setSelectedCourse(null) : undefined}
            />
          ) : undefined
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
  listHeader: {
    paddingBottom: spacing.xs,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
  },
});
