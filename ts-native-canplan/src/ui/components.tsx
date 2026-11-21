import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { dayKey, useCanvas } from '../canvas/store';
import type { FeedChange, FeedKind, PlannerTask } from '../canvas/types';
import { useDesignVariant } from '../state/AppState';
import { resolveCanvasUrl } from './courseTabs';
import {
  type GroupPosition,
  type RowContext,
  rowPosition,
} from './designVariant';
import {
  formatCompactDate,
  formatDateTime,
  formatDueText,
  formatInlineDue,
  formatPoints,
  formatRelative,
  formatShortDate,
  splitHighlight,
  useNow,
} from './format';
import { Icon, type IconName } from './Icon';
import type { GroupProgress } from './taskGroups';
import { radii, spacing, useTheme } from './theme';

export { type GroupPosition, type RowContext, rowPosition };

export type ReaderKind = FeedKind;

export function kindIconName(kind: ReaderKind): IconName {
  switch (kind) {
    case 'announcement':
      return 'announcement';
    case 'assignment':
      return 'assignment';
    case 'file':
      return 'file';
    case 'page':
      return 'page';
    case 'quiz':
      return 'quiz';
    case 'discussion':
      return 'discussion';
  }
}

export function kindTitleLabel(kind: ReaderKind): string {
  switch (kind) {
    case 'announcement':
      return 'Announcement';
    case 'assignment':
      return 'Assignment';
    case 'file':
      return 'File';
    case 'page':
      return 'Page';
    case 'quiz':
      return 'Quiz';
    case 'discussion':
      return 'Discussion';
  }
}

export function openExternalUrl(url?: string | null) {
  const resolved = resolveCanvasUrl(url);
  if (!resolved) return;
  Linking.openURL(resolved).catch(() => {});
}

export function openCanvasReader(courseID: number, kind: ReaderKind, itemID: number) {
  router.push(`/canvas/${kind}/${courseID}/${itemID}`);
}

/**
 * Keeps RefreshControl from showing a duplicate large spinner during background/button refreshes
 * when the screen already renders FreshnessBar and RefreshHeaderButton.
 */
export function usePullToRefresh() {
  const { refresh } = useCanvas();
  const [pulling, setPulling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onRefresh = useCallback(() => {
    setPulling(true);
    refresh();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPulling(false);
      timerRef.current = null;
    }, 250);
  }, [refresh]);

  return { pulling, onRefresh };
}

export function TabIconWithBadge({
  name,
  size,
  color,
  count,
}: {
  name: IconName;
  size: number;
  color: ColorValue;
  count: number;
}) {
  const { colors } = useTheme();
  const showDot = count > 9;
  const showCount = count > 0 && count <= 9;

  return (
    <View style={styles.tabIconWrap}>
      <Icon name={name} size={size} color={color} />
      {showDot ? (
        <View
          style={[
            styles.tabBadgeDot,
            { backgroundColor: colors.accent, borderColor: colors.tabBarBg },
          ]}
        />
      ) : showCount ? (
        <View
          style={[
            styles.tabBadgePill,
            { backgroundColor: colors.accent, borderColor: colors.tabBarBg },
          ]}
        >
          <Text style={[styles.tabBadgeText, { color: colors.onAccent }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function NativeDatePicker({
  value,
  mode = 'date',
  onChange,
  accessibilityLabel,
}: {
  value: Date;
  mode?: 'date' | 'datetime';
  onChange: (date: Date) => void;
  accessibilityLabel?: string;
}) {
  const { colors, typography } = useTheme();
  const [showAndroidDialog, setShowAndroidDialog] = useState(false);

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="compact"
        accentColor={colors.accent}
        themeVariant={colors.dark ? 'dark' : 'light'}
        onValueChange={(_, selected) => {
          onChange(selected);
        }}
      />
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setShowAndroidDialog(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? 'Pick date'}
        style={({ pressed }) => [
          styles.dateTrigger,
          { backgroundColor: colors.surfaceSecondary },
          pressed && { opacity: 0.75 },
        ]}
      >
        <Icon name="calendar" size={14} color={colors.accent} />
        <Text style={[typography.subhead, { color: colors.text, fontWeight: '500' }]}>
          {mode === 'datetime'
            ? formatDateTime(value.toISOString())
            : formatShortDate(value.toISOString())}
        </Text>
      </Pressable>
      {showAndroidDialog ? (
        <DateTimePicker
          value={value}
          mode="date"
          presentation="dialog"
          accentColor={colors.accent}
          themeVariant={colors.dark ? 'dark' : 'light'}
          onValueChange={(_, selected) => {
            setShowAndroidDialog(false);
            onChange(selected);
          }}
          onDismiss={() => setShowAndroidDialog(false)}
        />
      ) : null}
    </>
  );
}

export function HeaderIconButton({
  icon,
  label,
  onPress,
  disabled,
  loading,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.headerBtn,
        pressed && !disabled && { opacity: 0.55 },
        disabled && { opacity: 0.35 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Icon name={icon} size={20} color={colors.accent} />
      )}
    </Pressable>
  );
}

export function SettingsHeaderButton() {
  return (
    <HeaderIconButton
      icon="settings"
      label="Settings"
      onPress={() => router.push('/settings')}
    />
  );
}

export function RefreshHeaderButton() {
  const { refresh, refreshing } = useCanvas();
  return (
    <HeaderIconButton
      icon="refresh"
      label="Refresh Canvas"
      loading={refreshing}
      onPress={() => {
        refresh();
      }}
    />
  );
}

export function FreshnessBar({ style }: { style?: StyleProp<ViewStyle> }) {
  const { refreshing, progress, lastRefresh } = useCanvas();
  const { colors, typography } = useTheme();
  const nowMs = useNow();

  const text = refreshing
    ? progress || 'Refreshing Canvas…'
    : lastRefresh
      ? `Checked Canvas ${formatRelative(lastRefresh, nowMs)}`
      : 'Not fetched yet';

  return (
    <View style={[styles.freshness, style]}>
      <Icon name={refreshing ? 'refresh' : 'clock'} size={13} color={colors.textTertiary} />
      <Text style={[typography.caption, { color: colors.textSecondary, flexShrink: 1 }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export type FilterChip = {
  id: string;
  label: string;
  dot?: boolean;
  count?: number;
};

export function ChipRow({
  chips,
  selectedId,
  onSelect,
  allLabel = 'All',
  style,
}: {
  chips: FilterChip[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  allLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, typography } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.chipContent, { alignItems: 'center' }]}
      style={[{ flexGrow: 0 }, style]}
    >
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          onSelect(null);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: selectedId === null }}
        style={[
          styles.chip,
          {
            backgroundColor: selectedId === null ? colors.accent : colors.surface,
            borderColor: selectedId === null ? colors.accent : colors.border,
          },
        ]}
      >
        <Text
          style={[
            typography.caption,
            { color: selectedId === null ? colors.onAccent : colors.text },
          ]}
          numberOfLines={1}
        >
          {allLabel}
        </Text>
      </Pressable>
      {chips.map((c) => {
        const active = selectedId === c.id;
        return (
          <Pressable
            key={c.id}
            onPress={() => {
              Keyboard.dismiss();
              onSelect(active ? null : c.id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.accent : colors.surface,
                borderColor: active ? colors.accent : colors.border,
              },
            ]}
          >
            {c.dot && !active ? (
              <View style={[styles.chipDot, { backgroundColor: colors.textSecondary }]} />
            ) : null}
            <Text
              style={[
                typography.caption,
                styles.chipLabel,
                { color: active ? colors.onAccent : colors.text },
              ]}
              numberOfLines={1}
            >
              {c.label}
            </Text>
            {c.count !== undefined && c.count > 0 ? (
              <Text
                style={[
                  typography.micro,
                  { color: active ? colors.onAccent : colors.textSecondary, opacity: 0.85 },
                ]}
              >
                {c.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'accent' | 'warning' | 'danger' | 'success' | 'neutral';
}) {
  const { colors, typography } = useTheme();
  const map = {
    accent: { bg: colors.accentSoft, fg: colors.accentText },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    success: { bg: colors.successSoft, fg: colors.success },
    neutral: { bg: colors.surfaceSecondary, fg: colors.textSecondary },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      <Text style={[typography.micro, { color: map.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  tone = 'default',
  right,
}: {
  title: string;
  subtitle?: string;
  tone?: 'default' | 'warning' | 'danger' | 'accent';
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const { spec } = useDesignVariant();
  const sh = spec.sectionHeader;

  const textColor =
    tone === 'warning'
      ? colors.warning
      : tone === 'danger'
        ? colors.danger
        : tone === 'accent'
          ? colors.accentText
          : spec.id === 'opus'
            ? colors.text
            : colors.textSecondary;

  return (
    <View
      style={[
        styles.sectionHeader,
        { paddingTop: sh.paddingTop, paddingBottom: sh.paddingBottom },
      ]}
    >
      <Text
        style={[
          {
            fontSize: sh.fontSize,
            lineHeight: sh.lineHeight,
            fontWeight: sh.fontWeight,
            letterSpacing: sh.letterSpacing,
            textTransform: sh.uppercase ? 'uppercase' : 'none',
            color: textColor,
            flex: 1,
          },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {right ? (
        right
      ) : subtitle ? (
        <Text
          style={{
            fontSize: spec.id === 'opus' ? 14 : 12,
            lineHeight: spec.id === 'opus' ? 18 : 16,
            fontWeight: spec.id === 'opus' ? '500' : '400',
            color: colors.textTertiary,
            fontVariant: ['tabular-nums'],
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Inset-grouped section container (16pt side margins, 12pt radius, hairline border).
 * Adapts surface tint per design variant (neon tints Canvas groups; astra & opus use white surface).
 */
export function InsetGroup({
  kind = 'mine',
  style,
  children,
}: {
  kind?: 'mine' | 'canvas';
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const { colors, hairline } = useTheme();
  const { spec } = useDesignVariant();
  const useTint = kind === 'canvas' && spec.tintCanvasSurface;

  return (
    <View
      style={[
        styles.insetGroup,
        {
          backgroundColor: useTint ? colors.canvasSurface : colors.surface,
          borderColor: useTint ? colors.canvasBorder : colors.border,
          borderWidth: hairline,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Shared leading kind glyph for Canvas items.
 * - neon: 30pt tinted rounded-square tile
 * - astra: plain 20pt glyph with NO tile
 * - opus: 28pt subtle rounded-square tile
 */
export function CanvasLeadingGlyph({
  icon,
  dimmed = false,
}: {
  icon: IconName;
  dimmed?: boolean;
}) {
  const { colors } = useTheme();
  const { spec } = useDesignVariant();
  const iconColor = dimmed ? colors.textTertiary : colors.textSecondary;

  if (spec.canvasIconMode === 'plain20') {
    return (
      <View style={styles.plainGlyphWrap} importantForAccessibility="no-hide-descendants">
        <Icon name={icon} size={20} color={iconColor} />
      </View>
    );
  }

  const boxSize = spec.canvasIconMode === 'tile30' ? 30 : 28;
  const iconSize = spec.canvasIconMode === 'tile30' ? 16 : 15;

  return (
    <View
      style={[
        styles.kindSquareBase,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: 8,
          backgroundColor: colors.surfaceSecondary,
        },
      ]}
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name={icon} size={iconSize} color={iconColor} />
    </View>
  );
}

/**
 * Trailing icon button for linking / opening a Canvas item in My Tasks (44pt hit target).
 * - neon: + -> checkCircleFill
 * - astra: + -> link (chain glyph)
 * - opus: plus.circle -> checkmark.circle.fill
 */
export function CanvasTaskActionButton({
  linked,
  title,
  onPress,
}: {
  linked: boolean;
  title: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { spec } = useDesignVariant();

  const iconName: IconName = linked ? spec.canvasLinkedIcon : spec.canvasAddIcon;
  const iconSize = spec.id === 'opus' ? 20 : linked && spec.id === 'astra' ? 17 : 18;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={linked ? `My task, open ${title} in Tasks` : `Add ${title} to My tasks`}
      hitSlop={10}
      style={({ pressed }) => [styles.trailingIconBtn, pressed && { opacity: 0.55 }]}
    >
      <Icon name={iconName} size={iconSize} color={colors.accent} />
    </Pressable>
  );
}

/**
 * Pure-RN circular progress ring used as the goal checkbox in Opus.
 */

function GroupRowShell({
  kind,
  groupPosition,
  showTopSeparator,
  separatorInset,
  accentBorderColor,
  children,
}: {
  kind: 'mine' | 'canvas';
  groupPosition: GroupPosition;
  showTopSeparator?: boolean;
  separatorInset: number;
  accentBorderColor?: string;
  children: React.ReactNode;
}) {
  const { colors, hairline } = useTheme();
  const { spec } = useDesignVariant();
  const useTint = kind === 'canvas' && spec.tintCanvasSurface;
  const bg = useTint ? colors.canvasSurface : colors.surface;
  const borderColor = accentBorderColor ?? (useTint ? colors.canvasBorder : colors.border);

  if (groupPosition === 'grouped') {
    return (
      <View style={{ backgroundColor: bg }}>
        {showTopSeparator ? (
          <View
            style={{
              height: hairline,
              marginLeft: separatorInset,
              backgroundColor: colors.separator,
            }}
          />
        ) : null}
        {children}
      </View>
    );
  }

  const isFirst = groupPosition === 'single' || groupPosition === 'first';
  const isLast = groupPosition === 'single' || groupPosition === 'last';

  return (
    <View
      style={[
        styles.groupRowOuter,
        {
          backgroundColor: bg,
          borderColor,
          borderLeftWidth: hairline,
          borderRightWidth: hairline,
        },
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
      ]}
    >
      {!isFirst ? (
        <View
          style={{
            height: hairline,
            marginLeft: separatorInset,
            backgroundColor: colors.separator,
          }}
        />
      ) : null}
      {children}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSecondary }]}>
        <Icon name={icon} size={28} color={colors.textSecondary} />
      </View>
      <Text style={[typography.headline, { color: colors.text, textAlign: 'center' }]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            typography.subhead,
            { color: colors.textSecondary, textAlign: 'center', maxWidth: 300 },
          ]}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.emptyButton,
            { backgroundColor: colors.accent },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={[typography.bodySemibold, { color: colors.onAccent }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function HighlightedText({
  text,
  terms,
  style,
  numberOfLines,
}: {
  text: string;
  terms?: string[];
  style: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  const parts = useMemo(
    () => (terms && terms.length > 0 ? splitHighlight(text, terms) : null),
    [text, terms],
  );

  if (!parts) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((p, idx) =>
        p.match ? (
          <Text
            key={idx}
            style={{
              backgroundColor: colors.highlightBg,
              color: colors.text,
              fontWeight: '600',
            }}
          >
            {p.text}
          </Text>
        ) : (
          <React.Fragment key={idx}>{p.text}</React.Fragment>
        ),
      )}
    </Text>
  );
}

/**
 * Mine row grammar:
 * - Interactive round circle checkbox leading (Reminders-style, accent blue)
 * - Inset-grouped white surface
 * - Context-aware metadata (max 2 items, 1 line); never shows "My task" on screen (kept in a11y label)
 */
export function TaskRow({
  task,
  context = 'tasks',
  groupPosition,
  showTopSeparator = false,
  inTodaySection = false,
  highlightTerms,
  snippet,
  onPress,
  roleBadge,
  compact = false,
  goalProgress,
  indented = false,
}: {
  task: PlannerTask;
  context?: RowContext;
  groupPosition?: GroupPosition;
  showTopSeparator?: boolean;
  inTodaySection?: boolean;
  highlightTerms?: string[];
  snippet?: string;
  onPress?: () => void;
  roleBadge?: 'Source' | 'Reference';
  hideFromCanvasPill?: boolean;
  compact?: boolean;
  /** Set for a goal (parent) task: shows "6 of 6" right after the module, same layout as any task. */
  goalProgress?: GroupProgress;
  /** Shown directly under its goal in the same list: indent one checkbox-width and drop the parent label. */
  indented?: boolean;
}) {
  const { colors, typography } = useTheme();
  const { spec } = useDesignVariant();
  const { updateTask, deadline, hasConflict } = useCanvas();
  const nowMs = useNow();

  const due = deadline(task);
  const conflict = hasConflict(task);
  const isOverridden = task.source?.kind === 'assignment' && !!task.deadlineOverride;
  const overdue = !!due && !task.done && new Date(due).getTime() < nowMs;
  // Due within the next 24 hours: yellow. Late: red.
  const dueSoon = !!due && !task.done && !overdue && new Date(due).getTime() - nowMs < 86_400_000;
  const plannedToday = !task.done && task.workDays.includes(dayKey(new Date(nowMs)));
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;
  const dueTextA11y = due ? formatDueText(due, nowMs) : null;

  const compactDate = due
    ? formatCompactDate(due, nowMs, {
        inTodaySection,
        includeTodayTime: spec.id === 'opus',
      })
    : '';
  const inlineDue = due
    ? formatInlineDue(due, nowMs, {
        done: task.done,
        inTodaySection,
        includeTodayTime: false,
      })
    : '';

  const showCourse = context !== 'course' && context !== 'goal' && !!task.courseCode;
  const showGroup = context !== 'goal' && !!task.group && !indented;
  const groupLabel = task.group ?? '';
  const showSubtasks = task.subtasks.length > 0;
  const showToday = plannedToday && !inTodaySection && !due;

  // Build line 2 metadata (max 2 items, 1 line)
  const line2Items: { text: string; tone?: 'danger' | 'accent' | 'default'; icon?: IconName }[] = [];
  if (spec.datePlacement === 'line2Inline') {
    // Astra: date on line 2 with course ("CS2030S · Due 29 Nov")
    if (showCourse && task.courseCode) line2Items.push({ text: task.courseCode });
    else if (showGroup && task.group) line2Items.push({ text: groupLabel, icon: 'subtask' });
    if (inlineDue) {
      line2Items.push({ text: inlineDue, tone: overdue ? 'danger' : 'default' });
    } else if (showGroup && task.group && line2Items.length === 0) {
      line2Items.push({ text: groupLabel, icon: 'subtask' });
    } else if (roleBadge && line2Items.length < 2) {
      line2Items.push({ text: roleBadge, tone: roleBadge === 'Source' ? 'accent' : 'default' });
    } else if (showSubtasks && line2Items.length < 2) {
      line2Items.push({ text: `${doneSubtasks}/${task.subtasks.length}` });
    } else if (showToday && line2Items.length < 2) {
      line2Items.push({ text: 'Today', tone: 'accent' });
    }
  } else {
    // Neon & Opus: date right-aligned on line 1; line 2 = course + group (or roleBadge / subtasks)
    if (showCourse && task.courseCode) line2Items.push({ text: task.courseCode });
    if (showGroup && task.group) line2Items.push({ text: groupLabel, icon: 'subtask' });
    if (line2Items.length < 2 && roleBadge) {
      line2Items.push({ text: roleBadge, tone: roleBadge === 'Source' ? 'accent' : 'default' });
    }
    if (line2Items.length < 2 && showSubtasks) {
      line2Items.push({ text: `${doneSubtasks}/${task.subtasks.length}` });
    }
    if (line2Items.length < 2 && showToday) {
      line2Items.push({ text: 'Today', tone: 'accent' });
    }
  }
  // Goals: module first, then progress, then (for line-2-date variants) the date, like any other task.
  if (goalProgress) {
    const allDone = goalProgress.total > 0 && goalProgress.done === goalProgress.total;
    const prog = { text: `${goalProgress.done} of ${goalProgress.total}`, tone: (allDone ? 'accent' : 'default') as 'accent' | 'default', icon: 'stack' as IconName };
    const courseIdx = showCourse && task.courseCode ? line2Items.findIndex((i) => i.text === task.courseCode) : -1;
    line2Items.splice(courseIdx >= 0 ? courseIdx + 1 : 0, 0, prog);
  }
  const visibleMeta = line2Items.slice(0, goalProgress ? 3 : 2);

  const a11yLabel = [
    'My task',
    task.title,
    roleBadge,
    task.group,
    task.courseCode,
    dueTextA11y && !task.done ? (isOverridden ? `${dueTextA11y}, your date` : dueTextA11y) : null,
    task.subtasks.length > 0 ? `${doneSubtasks} of ${task.subtasks.length} sub-tasks done` : null,
    task.done ? 'Completed' : null,
  ]
    .filter(Boolean)
    .join(', ');

  const resolvedPos: GroupPosition = groupPosition ?? (compact ? 'grouped' : 'single');
  const showLine1Date = spec.datePlacement === 'line1Right' && (!!compactDate || conflict);

  return (
    <GroupRowShell
      kind="mine"
      groupPosition={resolvedPos}
      showTopSeparator={showTopSeparator}
      separatorInset={spec.taskSeparatorInset}
      accentBorderColor={conflict ? colors.warning : undefined}
    >
      <View style={[styles.insetRowInner, { paddingVertical: spec.rowPaddingV }, indented && { paddingLeft: 34 }]}>
        <Pressable
          onPress={() => updateTask({ ...task, done: !task.done })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done }}
          accessibilityLabel={`My task, mark ${task.title} as ${task.done ? 'incomplete' : 'done'}`}
          hitSlop={10}
          style={styles.checkboxHit}
        >
          <Icon
            name={task.done ? 'checkCircleFill' : 'circle'}
            size={22}
            color={colors.accent}
          />
        </Pressable>

        <Pressable
          onPress={() => {
            if (onPress) onPress();
            else router.push(`/task/${task.id}`);
          }}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityHint="Opens task details"
          style={({ pressed }) => [styles.rowMainHit, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.rowBody}>
            <View style={styles.line1Row}>
              <HighlightedText
                text={task.title}
                terms={highlightTerms}
                style={[
                  {
                    fontSize: spec.titleSize,
                    lineHeight: spec.titleLineHeight,
                    // Goals read heavier than their parts.
                    fontWeight: goalProgress ? '600' : '400',
                    color: task.done ? colors.textTertiary : colors.text,
                    textDecorationLine: task.done ? 'line-through' : 'none',
                    flex: 1,
                  },
                ]}
                numberOfLines={1}
              />
            </View>

            {visibleMeta.length > 0 ? (
              <View style={styles.metaLineRow}>
                {spec.datePlacement === 'line2Inline' && conflict ? (
                  <Icon name="warning" size={12} color={colors.warning} />
                ) : null}
                {/* Order: module · [icon] parent-or-progress. */}
                {visibleMeta.map((m, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 ? <Text style={[typography.caption, { color: colors.textSecondary }]}>·</Text> : null}
                    {m.icon ? <Icon name={m.icon} size={11} color={colors.textSecondary} /> : null}
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textSecondary, flexShrink: 1 },
                        m.tone === 'danger'
                          ? { color: colors.danger, fontWeight: '600' }
                          : m.tone === 'accent'
                            ? { color: colors.accentText, fontWeight: '600' }
                            : null,
                      ]}
                      numberOfLines={1}
                    >
                      {m.text}
                    </Text>
                  </React.Fragment>
                ))}
              </View>
            ) : null}

            {snippet ? (
              <HighlightedText
                text={snippet}
                terms={highlightTerms}
                style={[typography.footnote, { color: colors.textSecondary }]}
                numberOfLines={2}
              />
            ) : null}
          </View>

          {/* Date in its own column, centred on the whole row; the title ellipsises before it. */}
          {showLine1Date ? (
            <View style={styles.line1DateWrap}>
              {conflict ? <Icon name="warning" size={13} color={colors.warning} /> : null}
              {isOverridden && spec.useStatusGlyphs ? (
                <Icon name="pin" size={11} color={colors.textTertiary} />
              ) : null}
              {compactDate ? (
                <Text
                  style={{
                    fontSize: spec.line1DateSize,
                    color: overdue ? colors.danger : dueSoon ? colors.warning : colors.textSecondary,
                    fontVariant: ['tabular-nums'],
                  }}
                  numberOfLines={1}
                >
                  {compactDate}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.trailingChevron}>
            <Icon name="chevronRight" size={14} color={colors.textTertiary} />
          </View>
        </Pressable>
      </View>
    </GroupRowShell>
  );
}

/**
 * Compact header row for a parent goal task whose title equals other tasks' `group`
 * in the same course (e.g. "Final Exam"). Adapts per design variant:
 * - neon: top row of group with "6/6" trailing count + 2pt progress bar
 * - astra: line 2 "6/6 prepared · Due today", no coloured edge
 * - opus: checkbox becomes a progress ring (round = Mine), line 2 "4 of 6 · Due today 1 PM", no bar or edge
 */
export function TaskGroupHeaderRow({
  task,
  progress,
  context = 'tasks',
  groupPosition = 'single',
  showTopSeparator = false,
  inTodaySection = false,
  onPress,
}: {
  task: PlannerTask;
  progress: GroupProgress;
  context?: RowContext;
  groupPosition?: GroupPosition;
  showTopSeparator?: boolean;
  inTodaySection?: boolean;
  onPress?: () => void;
}) {
  // A goal is a task: same row, plus "6 of 6" after the module.
  return (
    <TaskRow
      task={task}
      context={context}
      groupPosition={groupPosition}
      showTopSeparator={showTopSeparator}
      inTodaySection={inTodaySection}
      onPress={onPress}
      goalProgress={progress}
    />
  );
}

const SWIPE_MAX = 112;
const SWIPE_TRIGGER = 68;

function SwipeToTaskWrapper({
  enabled,
  alreadyLinked,
  onTrigger,
  children,
}: {
  enabled: boolean;
  alreadyLinked: boolean;
  onTrigger: () => void;
  children: React.ReactNode;
}) {
  const { colors, typography } = useTheme();
  const [translateX] = useState(() => new Animated.Value(0));

  const panResponder = useMemo(() => {
    if (!enabled) return null;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const clamped = Math.max(0, Math.min(SWIPE_MAX, g.dx));
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        const shouldFire = g.dx >= SWIPE_TRIGGER;
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
        if (shouldFire) {
          onTrigger();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
      },
    });
  }, [enabled, translateX, onTrigger]);

  if (!enabled || !panResponder) {
    return <>{children}</>;
  }

  return (
    <View style={styles.swipeContainer}>
      {/* Rows in grouped sections are transparent, so the action only appears once a swipe starts. */}
      <Animated.View
        style={[
          styles.swipeBackdrop,
          {
            backgroundColor: colors.accent,
            opacity: translateX.interpolate({ inputRange: [0, 12], outputRange: [0, 1], extrapolate: 'clamp' }),
          },
        ]}
        importantForAccessibility="no-hide-descendants"
      >
        <Icon name={alreadyLinked ? 'check' : 'add'} size={16} color={colors.onAccent} />
        <Text style={[typography.caption, { color: colors.onAccent, fontWeight: '600' }]}>
          {alreadyLinked ? 'Open Task' : 'Add to Tasks'}
        </Text>
      </Animated.View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export type CanvasRowProps = {
  courseID: number;
  courseCode: string;
  kind: FeedKind;
  itemID: number;
  title: string;
  /** Screen context for metadata trimming (no "Canvas ›" or kind word except in 'search'). */
  context?: RowContext;
  /** Position inside an inset-grouped section. */
  groupPosition?: GroupPosition;
  /** Whether to draw an inset hairline top separator (when groupPosition === 'grouped'). */
  showTopSeparator?: boolean;
  /** Breadcrumb below course, e.g. ["Files", "Lecture Slides"]. Defaults to locationOf(). */
  location?: string[];
  /** Relative timestamp or due text (fallback when rawDate is not passed). */
  metaDate?: string;
  /** Optional raw ISO date for variant-aware compact/inline formatting. */
  rawDate?: string | null;
  /** Optional secondary detail item (e.g. "20 pts" — 0 pts is dropped automatically). */
  metaExtra?: string;
  /** Optional numeric points (dropped when <= 0). */
  points?: number | null;
  /** Whether the date is overdue (renders in red / exclamation glyph only when true). */
  overdue?: boolean;
  /** Optional 2-line preview text. */
  preview?: string;
  /** Optional change indicator from Updates feed. */
  change?: FeedChange;
  /** Unseen emphasis in Updates feed. */
  unseen?: boolean;
  /** Show trailing add-to-task icon button before conversion (linked icon always shows once converted). */
  showConvertButton?: boolean;
  /** Enable leading swipe "Add to Tasks". */
  swipeable?: boolean;
  /** Search highlight terms. */
  highlightTerms?: string[];
  /** Search match type for visual hierarchy (title > body). */
  matchedIn?: 'title' | 'body';
  /** Optional callback fired before opening the Canvas reader (e.g. markSeen). */
  onOpen?: () => void;
  /** Optional compact dismiss action (e.g. for "Due soon on Canvas" strip). */
  onDismiss?: () => void;
  /** Remove outer horizontal margins when embedded inside a container card. */
  compact?: boolean;
};

/**
 * Canvas row grammar:
 * - Non-interactive kind glyph leading (distinct from Mine's round checkbox without colour)
 * - Inset-grouped surface (tinted in neon, white in astra/opus)
 * - Context-aware metadata (max 2 items, 1 line); no "Canvas ›" or kind word except in Search
 * - Trailing icon button for + Task / Linked (replaces pill row) + swipe
 * - Always opens the Canvas reader on tap.
 */
export function CanvasRow({
  courseID,
  courseCode,
  kind,
  itemID,
  title,
  context = 'updates',
  groupPosition,
  showTopSeparator = false,
  location,
  metaDate,
  rawDate,
  metaExtra,
  points,
  overdue,
  preview,
  change,
  unseen,
  showConvertButton = false,
  swipeable = false,
  highlightTerms,
  matchedIn,
  onOpen,
  onDismiss,
  compact = false,
}: CanvasRowProps) {
  const { colors, typography } = useTheme();
  const { spec } = useDesignVariant();
  const { taskForItem, makeActionable, locationOf } = useCanvas();
  const nowMs = useNow();

  const linkedTask = taskForItem(kind, itemID);
  const crumbs = useMemo(
    () => (location && location.length > 0 ? location : locationOf(courseID, kind, itemID)),
    [location, locationOf, courseID, kind, itemID],
  );

  const a11yPath = useMemo(
    () => ['Canvas', courseCode, ...crumbs].filter(Boolean).join(' › '),
    [courseCode, crumbs],
  );

  const handleOpen = () => {
    onOpen?.();
    openCanvasReader(courseID, kind, itemID);
  };

  const handleConvertOrOpenTask = () => {
    if (linkedTask) {
      router.push(`/task/${linkedTask.id}`);
    } else {
      makeActionable(courseID, kind, itemID);
    }
  };

  // Date strings per placement
  const compactDate = rawDate
    ? formatCompactDate(rawDate, nowMs, { includeTodayTime: spec.id === 'opus' })
    : (metaDate ?? '');
  const inlineDate = rawDate
    ? kind === 'assignment' || kind === 'quiz'
      ? formatInlineDue(rawDate, nowMs)
      : formatCompactDate(rawDate, nowMs)
    : (metaDate ?? '');

  // Points text: never show "0 pts"
  const pointsText =
    points !== undefined && points !== null && points > 0 ? `${formatPoints(points)} pts` : null;

  // Build line 2 metadata (max 2 items, 1 line)
  const line2Items: { text: string; tone?: 'danger' | 'warning' | 'default' }[] = [];
  const showCourse = context !== 'course' && !!courseCode;
  const showKind = context === 'search';

  if (showKind) {
    line2Items.push({ text: kindTitleLabel(kind) });
  }
  if (showCourse && line2Items.length < 2) {
    line2Items.push({ text: courseCode });
  }
  if (spec.datePlacement === 'line2Inline' && inlineDate && line2Items.length < 2) {
    line2Items.push({ text: inlineDate, tone: overdue ? 'danger' : 'default' });
  }
  if (change === 'Due date changed' && line2Items.length < 2) {
    line2Items.push({ text: 'Due date changed', tone: 'warning' });
  } else if (change === 'Updated' && line2Items.length < 2) {
    line2Items.push({ text: 'Updated' });
  }
  if (pointsText && line2Items.length < 2) {
    line2Items.push({ text: pointsText });
  }
  if (metaExtra && line2Items.length < 2) {
    line2Items.push({ text: metaExtra });
  }
  // Drop "New" text: unread dot carries it.
  const visibleMeta = line2Items.slice(0, 2);

  const a11yLabel = [
    a11yPath,
    title,
    change,
    compactDate || inlineDate || null,
    pointsText,
    linkedTask ? 'In My tasks' : null,
  ]
    .filter(Boolean)
    .join(', ');

  const resolvedPos: GroupPosition = groupPosition ?? (compact ? 'grouped' : 'single');
  const showLine1Date = spec.datePlacement === 'line1Right' && !!compactDate;

  const rowContent = (
    <View style={[styles.insetRowInner, { paddingVertical: spec.rowPaddingV }]}>
      <Pressable
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint="Opens Canvas reader"
        accessibilityActions={[
          {
            name: 'convert',
            label: linkedTask ? 'Open in My tasks' : 'Add to My tasks',
          },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'convert') {
            handleConvertOrOpenTask();
          }
        }}
        style={({ pressed }) => [styles.rowMainHit, pressed && { opacity: 0.72 }]}
      >
        <View style={styles.leadingGlyphSlot}>
          <CanvasLeadingGlyph icon={kindIconName(kind)} />
        </View>

        <View style={styles.rowBody}>
          <View style={styles.line1Row}>
            <View style={styles.titleLine}>
              {unseen ? (
                <View style={[styles.unseenDot, { backgroundColor: colors.accent }]} />
              ) : null}
              <HighlightedText
                text={title}
                terms={highlightTerms}
                style={[
                  {
                    fontSize: spec.titleSize,
                    lineHeight: spec.titleLineHeight,
                    fontWeight: unseen ? '700' : matchedIn === 'body' ? '400' : '600',
                    color: colors.text,
                    flex: 1,
                  },
                ]}
                numberOfLines={2}
              />
            </View>

            {showLine1Date ? (
              <View style={styles.line1DateWrap}>
                {overdue && spec.useStatusGlyphs ? (
                  <Icon name="exclamation" size={13} color={colors.danger} />
                ) : null}
                <Text
                  style={{
                    fontSize: spec.line1DateSize,
                    lineHeight: spec.titleLineHeight,
                    fontWeight: overdue && spec.id === 'neon' ? '600' : '400',
                    color: overdue ? colors.danger : colors.textSecondary,
                    fontVariant: ['tabular-nums'],
                  }}
                  numberOfLines={1}
                >
                  {compactDate}
                </Text>
              </View>
            ) : null}
          </View>

          {visibleMeta.length > 0 ? (
            <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
              {visibleMeta.map((m, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 ? ' · ' : null}
                  <Text
                    style={
                      m.tone === 'danger'
                        ? { color: colors.danger, fontWeight: '600' }
                        : m.tone === 'warning'
                          ? { color: colors.warning, fontWeight: '600' }
                          : undefined
                    }
                  >
                    {m.text}
                  </Text>
                </React.Fragment>
              ))}
            </Text>
          ) : null}

          {preview ? (
            <HighlightedText
              text={preview}
              terms={highlightTerms}
              style={[typography.footnote, { color: colors.textSecondary }]}
              numberOfLines={2}
            />
          ) : null}
        </View>
      </Pressable>

      <View style={styles.trailingActions}>
        {linkedTask || showConvertButton ? (
          <CanvasTaskActionButton
            linked={!!linkedTask}
            title={title}
            onPress={handleConvertOrOpenTask}
          />
        ) : null}

        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${title} from due soon`}
            hitSlop={10}
            style={({ pressed }) => [styles.trailingIconBtn, pressed && { opacity: 0.55 }]}
          >
            <Icon name="close" size={15} color={colors.textTertiary} />
          </Pressable>
        ) : null}

        {!linkedTask && !showConvertButton && !onDismiss ? (
          <View style={styles.trailingChevron}>
            <Icon name="chevronRight" size={14} color={colors.textTertiary} />
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <GroupRowShell
      kind="canvas"
      groupPosition={resolvedPos}
      showTopSeparator={showTopSeparator}
      separatorInset={spec.canvasSeparatorInset}
      accentBorderColor={change === 'Due date changed' ? colors.warning : undefined}
    >
      <SwipeToTaskWrapper
        enabled={swipeable}
        alreadyLinked={!!linkedTask}
        onTrigger={handleConvertOrOpenTask}
      >
        {rowContent}
      </SwipeToTaskWrapper>
    </GroupRowShell>
  );
}

const styles = StyleSheet.create({


  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freshness: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    maxWidth: 200,
  },
  chipLabel: {
    flexShrink: 1,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg + 2,
  },
  insetGroup: {
    marginHorizontal: spacing.lg,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  groupRowOuter: {
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  insetRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  plainGlyphWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  kindSquareBase: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  leadingGlyphSlot: {
    alignSelf: 'flex-start',
    paddingTop: 1,
  },
  line1Row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  line1DateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  metaLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trailingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  trailingIconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: 48,
    gap: spacing.sm,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyButton: {
    marginTop: spacing.md,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.md,
  },
  parentHeaderBody: {
    flex: 1,
    gap: 3,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: 3,
  },
  progressFill: {
    height: 2,
    borderRadius: 1,
  },
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  swipeBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    gap: 6,
  },
  rowMainHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  titleLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  unseenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 7,
    flexShrink: 0,
  },
  trailingChevron: {
    paddingLeft: 2,
    flexShrink: 0,
  },
  checkboxHit: {
    alignSelf: 'flex-start',
    paddingTop: 1,
  },
  tabIconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
  },
  tabBadgePill: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
});
