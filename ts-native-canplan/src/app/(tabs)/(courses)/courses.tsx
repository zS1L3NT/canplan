import { router, Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCanvas } from '../../../canvas/store';
import type { CourseSnapshot } from '../../../canvas/types';
import { useDesignVariant } from '../../../state/AppState';
import {
  CanvasLeadingGlyph,
  EmptyState,
  FreshnessBar,
  InsetGroup,
  RefreshHeaderButton,
  SectionHeader,
  SettingsHeaderButton,
  usePullToRefresh,
} from '../../../ui/components';
import { cleanCourseName } from '../../../ui/format';
import { Icon } from '../../../ui/Icon';
import { radii, spacing, useTheme } from '../../../ui/theme';

export default function CoursesScreen() {
  const { colors, typography, hairline } = useTheme();
  const { spec } = useDesignVariant();
  const { allCourses, isAcademic, isHidden, feed, seen, refresh, refreshing } = useCanvas();
  const { pulling, onRefresh } = usePullToRefresh();
  const [showOther, setShowOther] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const unseenByCourseID = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of feed) {
      if (!seen.has(item.id)) {
        map.set(item.courseID, (map.get(item.courseID) ?? 0) + 1);
      }
    }
    return map;
  }, [feed, seen]);

  const { academicByTerm, other, hidden } = useMemo(() => {
    const byTerm = new Map<string, CourseSnapshot[]>();
    const ot: CourseSnapshot[] = [];
    const hi: CourseSnapshot[] = [];
    for (const c of allCourses) {
      if (isHidden(c.courseID)) hi.push(c);
      else if (isAcademic(c)) {
        const term = c.term?.trim() || 'Academic modules';
        const list = byTerm.get(term);
        if (list) list.push(c);
        else byTerm.set(term, [c]);
      } else {
        ot.push(c);
      }
    }
    return {
      academicByTerm: Array.from(byTerm.entries()).map(([term, list]) => ({ term, list })),
      other: ot,
      hidden: hi,
    };
  }, [allCourses, isAcademic, isHidden]);

  const renderCourseRow = (item: CourseSnapshot, index: number, dimmed = false) => {
    const unseen = unseenByCourseID.get(item.courseID) ?? 0;
    const cleanedName = cleanCourseName(item.code, item.name);
    const label = [
      'Canvas',
      item.code,
      cleanedName || null,
      unseen > 0 ? `${unseen} new` : null,
    ]
      .filter(Boolean)
      .join(', ');

    return (
      <View key={item.courseID}>
        {index > 0 ? (
          <View
            style={{
              height: hairline,
              marginLeft: spec.canvasSeparatorInset,
              backgroundColor: colors.separator,
            }}
          />
        ) : null}
        <Pressable
          onPress={() => router.push(`/module/${item.courseID}`)}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Opens course details"
          style={({ pressed }) => [
            styles.courseRow,
            {
              paddingVertical: spec.rowPaddingV + 1,
              opacity: dimmed ? 0.72 : 1,
            },
            pressed && { opacity: 0.72 },
          ]}
        >
          <CanvasLeadingGlyph icon={dimmed ? 'eyeOff' : 'modules'} dimmed={dimmed} />

          <View style={styles.rowBody}>
            <Text
              style={{
                fontSize: spec.titleSize,
                lineHeight: spec.titleLineHeight,
                fontWeight: '600',
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {item.code}
            </Text>
            {cleanedName ? (
              <Text
                style={[typography.caption, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {cleanedName}
              </Text>
            ) : null}
          </View>

          {unseen > 0 ? (
            spec.courseUnreadStyle === 'capsule' ? (
              <View style={[styles.unreadCapsule, { backgroundColor: colors.accent }]}>
                <Text style={[styles.unreadCapsuleText, { color: colors.onAccent }]}>
                  {unseen}
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  typography.caption,
                  { color: colors.accentText, fontWeight: '600', fontVariant: ['tabular-nums'] },
                ]}
              >
                {unseen} new
              </Text>
            )
          ) : null}

          <Icon name="chevronRight" size={14} color={colors.textTertiary} />
        </Pressable>
      </View>
    );
  };

  return (
    <>
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
          <Stack.Toolbar.Button
            icon="gearshape"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
          />
        </Stack.Toolbar>
      ) : (
        <Stack.Screen
          options={{
            headerRight: () => (
              <View style={styles.headerRight}>
                <RefreshHeaderButton />
                <SettingsHeaderButton />
              </View>
            ),
          }}
        />
      )}

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={allCourses.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <FreshnessBar />

        {allCourses.length === 0 ? (
          !refreshing ? (
            <EmptyState
              icon="modules"
              title="No courses yet"
              description="Pull down to refresh your active NUS Canvas courses."
              actionLabel="Refresh"
              onAction={() => {
                refresh();
              }}
            />
          ) : null
        ) : (
          <>
            {academicByTerm.map(({ term, list }) => (
              <View key={term}>
                <SectionHeader title={term} subtitle={`${list.length}`} />
                <InsetGroup kind="canvas">
                  {list.map((c, idx) => renderCourseRow(c, idx))}
                </InsetGroup>
              </View>
            ))}

            {other.length > 0 ? (
              <View style={styles.collapsibleGroup}>
                <InsetGroup kind="canvas">
                  <Pressable
                    onPress={() => setShowOther((v) => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showOther }}
                    accessibilityLabel={`Other non-academic courses, ${other.length}`}
                    style={({ pressed }) => [styles.groupToggle, pressed && { opacity: 0.72 }]}
                  >
                    <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]}>
                      Other (non-academic)
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      {other.length}
                    </Text>
                    <Icon
                      name={showOther ? 'chevronUp' : 'chevronDown'}
                      size={15}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                  {showOther ? other.map((c, idx) => renderCourseRow(c, idx + 1)) : null}
                </InsetGroup>
              </View>
            ) : null}

            {hidden.length > 0 ? (
              <View style={styles.collapsibleGroup}>
                <InsetGroup kind="canvas">
                  <Pressable
                    onPress={() => setShowHidden((v) => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showHidden }}
                    accessibilityLabel={`Hidden courses, ${hidden.length}`}
                    style={({ pressed }) => [styles.groupToggle, pressed && { opacity: 0.72 }]}
                  >
                    <Icon name="eyeOff" size={15} color={colors.textSecondary} />
                    <Text style={[typography.bodyMedium, { color: colors.textSecondary, flex: 1 }]}>
                      Hidden
                    </Text>
                    <Text style={[typography.caption, { color: colors.textTertiary }]}>
                      {hidden.length}
                    </Text>
                    <Icon
                      name={showHidden ? 'chevronUp' : 'chevronDown'}
                      size={15}
                      color={colors.textTertiary}
                    />
                  </Pressable>
                  {showHidden ? hidden.map((c, idx) => renderCourseRow(c, idx + 1, true)) : null}
                </InsetGroup>
              </View>
            ) : null}
          </>
        )}
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
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  unreadCapsule: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCapsuleText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  collapsibleGroup: {
    marginTop: spacing.lg,
  },
  groupToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
});
