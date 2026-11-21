import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { dayKey, useCanvas } from '../../../../canvas/store';
import type { SourceRef } from '../../../../canvas/types';
import {
  Badge,
  EmptyState,
  InsetGroup,
  kindIconName,
  NativeDatePicker,
  openCanvasReader,
  TaskRow,
} from '../../../../ui/components';
import { partsOf } from '../../../../ui/taskGroups';
import { getFileTypeInfo } from '../../../../ui/fileType';
import {
  formatDayHeading,
  formatWeekdayDate,
  isoFromDayKey,
  nextNDays,
  useNow,
} from '../../../../ui/format';
import { Icon, type IconName } from '../../../../ui/Icon';
import { radii, spacing, useTheme } from '../../../../ui/theme';

export default function TaskDetailScreen() {
  const { taskID } = useLocalSearchParams<{ taskID: string }>();
  const { colors, typography } = useTheme();
  const store = useCanvas();
  const {
    tasks,
    courses,
    allCourses,
    updateTask,
    deleteTask,
    canvasDue,
    hasConflict,
    linkedItemsOf,
    unlinkItem,
    setSource,
  } = store;
  const nowMs = useNow();

  const task = useMemo(() => tasks.find((t) => t.id === taskID), [tasks, taskID]);
  // If this task is a goal (other tasks in its module are grouped under its title), list its parts.
  const parts = useMemo(() => (task ? partsOf(task, tasks) : []), [task, tasks]);
  const [newSubtask, setNewSubtask] = useState('');
  const [deadlineEditing, setDeadlineEditing] = useState(false);
  const [workDaysExpanded, setWorkDaysExpanded] = useState(false);
  const [modulePickerExpanded, setModulePickerExpanded] = useState(false);
  const [pickedWorkDay, setPickedWorkDay] = useState<Date>(
    () => new Date(Date.now() + 7 * 86_400_000),
  );

  const upcomingDays = useMemo(() => nextNDays(7), []);

  const linkedItems = useMemo(() => (task ? linkedItemsOf(task) : []), [task, linkedItemsOf]);

  if (!task) {
    return (
      <>
        <Stack.Screen options={{ title: 'My task' }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <EmptyState
            icon="delete"
            title="Task deleted"
            description="This task is no longer in your list."
            actionLabel="Go back"
            onAction={() => router.back()}
          />
        </ScrollView>
      </>
    );
  }

  const isLinkedAssignment = task.source?.kind === 'assignment';
  const canvasDate = canvasDue(task);
  const conflict = hasConflict(task);
  const effectiveDeadline = isLinkedAssignment
    ? (task.deadlineOverride ?? canvasDate ?? task.ownDeadline ?? null)
    : (task.ownDeadline ?? null);
  const overdue = !!effectiveDeadline && !task.done && new Date(effectiveDeadline).getTime() < nowMs;
  const isOverridden = isLinkedAssignment && !!task.deadlineOverride;

  const applyAssignmentOverride = (nextDate: Date) => {
    const iso = nextDate.toISOString();
    updateTask({
      ...task,
      deadlineOverride: iso,
      canvasDueWhenOverridden: task.deadlineOverride ? task.canvasDueWhenOverridden : canvasDate,
    });
  };

  const applyOwnDeadline = (nextDate: Date) => {
    updateTask({ ...task, ownDeadline: nextDate.toISOString() });
  };

  const shiftDeadline = (daysDelta: number) => {
    const base = effectiveDeadline ? new Date(effectiveDeadline) : new Date(nowMs);
    const shifted = new Date(base.getTime() + daysDelta * 86_400_000);
    if (isLinkedAssignment) applyAssignmentOverride(shifted);
    else applyOwnDeadline(shifted);
  };

  const openLinkedItemActions = (item: {
    ref: SourceRef;
    isSource: boolean;
    title: string;
  }) => {
    const handleOpen = () =>
      openCanvasReader(item.ref.courseID, item.ref.kind, item.ref.itemID);
    const handleMakeSource = () => setSource(task.id, item.ref);
    const handleUnlink = () => unlinkItem(task.id, item.ref);

    if (Platform.OS === 'ios') {
      const options = item.isSource
        ? ['Open in reader', 'Unlink', 'Cancel']
        : ['Open in reader', 'Make source', 'Unlink', 'Cancel'];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: item.title,
          options,
          destructiveButtonIndex: item.isSource ? 1 : 2,
          cancelButtonIndex: item.isSource ? 2 : 3,
        },
        (index) => {
          if (index === 0) handleOpen();
          else if (!item.isSource && index === 1) handleMakeSource();
          else if ((item.isSource && index === 1) || (!item.isSource && index === 2)) {
            handleUnlink();
          }
        },
      );
    } else {
      Alert.alert(item.title, undefined, [
        { text: 'Open in reader', onPress: handleOpen },
        ...(!item.isSource ? [{ text: 'Make source', onPress: handleMakeSource }] : []),
        { text: 'Unlink', style: 'destructive', onPress: handleUnlink },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const toggleWorkDay = (key: string) => {
    const exists = task.workDays.includes(key);
    const workDays = exists ? task.workDays.filter((d) => d !== key) : [...task.workDays, key];
    updateTask({ ...task, workDays });
  };

  const addWorkDayDate = (date: Date) => {
    const key = dayKey(date);
    if (!task.workDays.includes(key)) {
      updateTask({ ...task, workDays: [...task.workDays, key] });
    }
  };

  const handlePickWorkDay = (date: Date) => {
    setPickedWorkDay(date);
    addWorkDayDate(date);
  };

  const pickedWorkDayKey = dayKey(pickedWorkDay);
  const pickedAlreadyScheduled = task.workDays.includes(pickedWorkDayKey);

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title) return;
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    updateTask({ ...task, subtasks: [...task.subtasks, { id, title, done: false }] });
    setNewSubtask('');
  };

  const toggleSubtask = (id: string) => {
    updateTask({
      ...task,
      subtasks: task.subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    });
  };

  const removeSubtask = (id: string) => {
    updateTask({
      ...task,
      subtasks: task.subtasks.filter((s) => s.id !== id),
    });
  };

  const confirmDelete = () => {
    Alert.alert('Delete task?', 'This removes the task and its sub-tasks from My tasks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTask(task.id);
          router.back();
        },
      },
    ]);
  };

  const workDaysSummary =
    task.workDays.length === 0
      ? 'None'
      : task.workDays.length === 1
        ? formatDayHeading(task.workDays[0], nowMs)
        : `${task.workDays.length} days`;

  return (
    <>
      <Stack.Screen options={{ title: 'My task' }} />

      <KeyboardAvoidingView
        collapsable={false}
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustsScrollIndicatorInsets
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {/* Editable title beside circle checkbox + Module */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.titleRow}>
              <Pressable
                onPress={() => updateTask({ ...task, done: !task.done })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: task.done }}
                accessibilityLabel={`My task, mark ${task.title} as ${task.done ? 'incomplete' : 'done'}`}
                hitSlop={8}
              >
                <Icon
                  name={task.done ? 'checkCircleFill' : 'circle'}
                  size={24}
                  color={colors.accent}
                />
              </Pressable>
              <TextInput
                value={task.title}
                onChangeText={(title) => updateTask({ ...task, title })}
                placeholder="Task title"
                placeholderTextColor={colors.textTertiary}
                multiline
                style={[
                  typography.headline,
                  styles.titleInput,
                  {
                    color: task.done ? colors.textTertiary : colors.text,
                    textDecorationLine: task.done ? 'line-through' : 'none',
                  },
                ]}
              />
            </View>

            <View
              style={[
                styles.dividerRow,
                { borderTopColor: colors.separator },
              ]}
            >
              <Pressable
                onPress={() => setModulePickerExpanded((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: modulePickerExpanded }}
                accessibilityLabel={`My task, module ${task.courseCode ?? 'None'}`}
                style={styles.kvRow}
              >
                <Text style={[typography.subhead, { color: colors.textSecondary }]}>Module</Text>
                <View style={styles.kvRight}>
                  <Text
                    style={[
                      typography.subhead,
                      { color: task.courseCode ? colors.text : colors.textTertiary, fontWeight: '500' },
                    ]}
                    numberOfLines={1}
                  >
                    {task.courseCode ?? 'None'}
                  </Text>
                  <Icon
                    name={modulePickerExpanded ? 'chevronUp' : 'chevronDown'}
                    size={13}
                    color={colors.textTertiary}
                  />
                </View>
              </Pressable>

              {modulePickerExpanded ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.dayChipScroll}
                  contentContainerStyle={styles.dayChipRow}
                >
                  <Pressable
                    onPress={() => {
                      updateTask({ ...task, courseCode: undefined });
                      setModulePickerExpanded(false);
                    }}
                    accessibilityRole="button"
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: !task.courseCode ? colors.accent : colors.surfaceSecondary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption,
                        { color: !task.courseCode ? colors.onAccent : colors.text },
                      ]}
                    >
                      None
                    </Text>
                  </Pressable>
                  {courses.map((c) => {
                    const active = task.courseCode === c.code;
                    return (
                      <Pressable
                        key={c.courseID}
                        onPress={() => {
                          updateTask({ ...task, courseCode: c.code });
                          setModulePickerExpanded(false);
                        }}
                        accessibilityRole="button"
                        style={[
                          styles.dayChip,
                          {
                            backgroundColor: active ? colors.accent : colors.surfaceSecondary,
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
              ) : null}
            </View>
          </View>

          {/* Deadline */}
          <Text style={[typography.caption, styles.groupLabel, { color: colors.textSecondary }]}>
            DEADLINE
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: conflict ? colors.warning : colors.border,
              },
            ]}
          >
            {/* Single-line default deadline summary + trailing Change */}
            <View style={styles.deadlineSummaryRow}>
              <Text
                style={[
                  typography.bodyMedium,
                  { color: effectiveDeadline ? colors.text : colors.textTertiary, flex: 1 },
                ]}
              >
                {isLinkedAssignment ? (
                  isOverridden ? (
                    <>
                      <Text style={overdue ? { color: colors.danger, fontWeight: '600' } : undefined}>
                        {`Due ${formatWeekdayDate(task.deadlineOverride)}`}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontWeight: '400' }}>
                        {` · your date (Canvas: ${canvasDate ? formatWeekdayDate(canvasDate) : 'No due date'})`}
                      </Text>
                    </>
                  ) : canvasDate ? (
                    <>
                      <Text style={overdue ? { color: colors.danger, fontWeight: '600' } : undefined}>
                        {`Due ${formatWeekdayDate(canvasDate)}`}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontWeight: '400' }}>
                        {' · from Canvas'}
                      </Text>
                    </>
                  ) : task.ownDeadline ? (
                    <Text style={overdue ? { color: colors.danger, fontWeight: '600' } : undefined}>
                      {`Due ${formatWeekdayDate(task.ownDeadline)}`}
                    </Text>
                  ) : (
                    'No due date'
                  )
                ) : task.ownDeadline ? (
                  <Text style={overdue ? { color: colors.danger, fontWeight: '600' } : undefined}>
                    {`Due ${formatWeekdayDate(task.ownDeadline)}`}
                  </Text>
                ) : (
                  'No due date'
                )}
              </Text>

              <Pressable
                onPress={() => setDeadlineEditing((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: deadlineEditing }}
                hitSlop={8}
                style={({ pressed }) => [styles.changeActionBtn, pressed && { opacity: 0.65 }]}
              >
                <Text style={[typography.subhead, { color: colors.accentText, fontWeight: '600' }]}>
                  {deadlineEditing ? 'Done' : 'Change'}
                </Text>
              </Pressable>
            </View>

            {/* Canvas conflict warning (always visible when Canvas changed after override) */}
            {isLinkedAssignment && conflict ? (
              <View style={styles.conflictBlock}>
                <View style={[styles.conflictBox, { backgroundColor: colors.warningSoft }]}>
                  <Icon name="warning" size={16} color={colors.warning} />
                  <Text style={[typography.footnote, { color: colors.warning, flex: 1 }]}>
                    Canvas changed this due date after you overrode it.
                  </Text>
                </View>
                {!deadlineEditing ? (
                  <Pressable
                    onPress={() => {
                      store.useCanvasValue(task);
                      setDeadlineEditing(false);
                    }}
                    accessibilityRole="button"
                    style={[styles.fullBtn, { backgroundColor: colors.warningSoft }]}
                  >
                    <Text
                      style={[
                        typography.subhead,
                        { color: colors.warning, fontWeight: '600' },
                      ]}
                    >
                      Use Canvas date
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Expanded editor */}
            {deadlineEditing ? (
              <View style={[styles.dividerRow, { borderTopColor: colors.separator }]}>
                {isLinkedAssignment ? (
                  <>
                    <View style={styles.kvRow}>
                      <Text style={[typography.subhead, { color: colors.textSecondary }]}>
                        Your date
                      </Text>
                      <NativeDatePicker
                        value={
                          task.deadlineOverride
                            ? new Date(task.deadlineOverride)
                            : canvasDate
                              ? new Date(canvasDate)
                              : new Date(nowMs + 86_400_000)
                        }
                        mode="datetime"
                        accessibilityLabel="Your override deadline date and time"
                        onChange={applyAssignmentOverride}
                      />
                    </View>

                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      Canvas: {canvasDate ? formatWeekdayDate(canvasDate) : 'No due date'}
                    </Text>

                    <View style={styles.presetRow}>
                      <SmallChip label="-1 day" onPress={() => shiftDeadline(-1)} />
                      <SmallChip label="+1 day" onPress={() => shiftDeadline(1)} />
                      <SmallChip label="+3 days" onPress={() => shiftDeadline(3)} />
                    </View>

                    <Pressable
                      onPress={() => {
                        store.useCanvasValue(task);
                        setDeadlineEditing(false);
                      }}
                      accessibilityRole="button"
                      style={[
                        styles.fullBtn,
                        {
                          backgroundColor: conflict ? colors.warningSoft : colors.surfaceSecondary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.subhead,
                          {
                            color: conflict ? colors.warning : colors.accentText,
                            fontWeight: '600',
                          },
                        ]}
                      >
                        Use Canvas date
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={styles.kvRow}>
                      <Text style={[typography.subhead, { color: colors.textSecondary }]}>
                        Due date
                      </Text>
                      <NativeDatePicker
                        value={
                          task.ownDeadline
                            ? new Date(task.ownDeadline)
                            : new Date(nowMs + 86_400_000)
                        }
                        mode="datetime"
                        accessibilityLabel="Task deadline date and time"
                        onChange={applyOwnDeadline}
                      />
                    </View>
                    <View style={styles.presetRow}>
                      <SmallChip
                        label="Today"
                        onPress={() =>
                          updateTask({
                            ...task,
                            ownDeadline: isoFromDayKey(dayKey(new Date(nowMs))) ?? undefined,
                          })
                        }
                      />
                      <SmallChip
                        label="Tomorrow"
                        onPress={() =>
                          updateTask({
                            ...task,
                            ownDeadline:
                              isoFromDayKey(dayKey(new Date(nowMs + 86_400_000))) ?? undefined,
                          })
                        }
                      />
                      {task.ownDeadline ? (
                        <SmallChip label="+1 day" onPress={() => shiftDeadline(1)} />
                      ) : (
                        <SmallChip
                          label="In 3 days"
                          onPress={() =>
                            updateTask({
                              ...task,
                              ownDeadline:
                                isoFromDayKey(dayKey(new Date(nowMs + 3 * 86_400_000))) ?? undefined,
                            })
                          }
                        />
                      )}
                      {task.ownDeadline ? (
                        <SmallChip
                          label="Clear"
                          onPress={() => {
                            updateTask({ ...task, ownDeadline: undefined });
                            setDeadlineEditing(false);
                          }}
                        />
                      ) : null}
                    </View>
                  </>
                )}
              </View>
            ) : null}
          </View>

          {/* Plan work days (collapsed by default) */}
          <View
            style={[
              styles.card,
              styles.workDaysCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => setWorkDaysExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: workDaysExpanded }}
              accessibilityLabel={`My task, plan work days, ${workDaysSummary}`}
              style={styles.kvRow}
            >
              <View style={styles.workDaysTitleRow}>
                <Icon name="calendar" size={16} color={colors.accent} />
                <Text style={[typography.bodyMedium, { color: colors.text }]}>Plan work days</Text>
              </View>
              <View style={styles.kvRight}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {workDaysSummary}
                </Text>
                <Icon
                  name={workDaysExpanded ? 'chevronUp' : 'chevronDown'}
                  size={14}
                  color={colors.textTertiary}
                />
              </View>
            </Pressable>

            {workDaysExpanded ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.dayChipScroll}
                  contentContainerStyle={styles.dayChipRow}
                >
                  {upcomingDays.map((d) => {
                    const active = task.workDays.includes(d.key);
                    return (
                      <Pressable
                        key={d.key}
                        onPress={() => toggleWorkDay(d.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.dayChip,
                          {
                            backgroundColor: active ? colors.accent : colors.surfaceSecondary,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            typography.caption,
                            { color: active ? colors.onAccent : colors.text },
                          ]}
                        >
                          {d.shortLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {task.workDays.length === 0 ? (
                  <Text style={[typography.footnote, { color: colors.textTertiary }]}>
                    Tap any day above to schedule when you will work on this task.
                  </Text>
                ) : (
                  task.workDays.map((d) => (
                    <View
                      key={d}
                      style={[
                        styles.listItemRow,
                        {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: colors.separator,
                        },
                      ]}
                    >
                      <Icon name="calendar" size={15} color={colors.accent} />
                      <Text style={[typography.subhead, { color: colors.text, flex: 1 }]}>
                        {formatDayHeading(d, nowMs)}
                      </Text>
                      <Pressable
                        onPress={() => toggleWorkDay(d)}
                        accessibilityLabel={`Remove ${d}`}
                        hitSlop={8}
                      >
                        <Icon name="close" size={14} color={colors.textTertiary} />
                      </Pressable>
                    </View>
                  ))
                )}

                <View
                  style={[
                    styles.pickerRow,
                    { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
                  ]}
                >
                  <Text style={[typography.subhead, { color: colors.textSecondary, flex: 1 }]}>
                    Other day
                  </Text>
                  <NativeDatePicker
                    value={pickedWorkDay}
                    mode="date"
                    accessibilityLabel="Pick another work day"
                    onChange={handlePickWorkDay}
                  />
                  {Platform.OS === 'ios' ? (
                    <Pressable
                      onPress={() => addWorkDayDate(pickedWorkDay)}
                      disabled={pickedAlreadyScheduled}
                      accessibilityRole="button"
                      style={[
                        styles.smallPrimaryBtn,
                        {
                          backgroundColor: pickedAlreadyScheduled
                            ? colors.surfaceSecondary
                            : colors.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.caption,
                          {
                            color: pickedAlreadyScheduled ? colors.textTertiary : colors.onAccent,
                            fontWeight: '600',
                          },
                        ]}
                      >
                        {pickedAlreadyScheduled ? 'Added' : 'Add'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>

          {/* Notes (multiline) */}
          <Text style={[typography.caption, styles.groupLabel, { color: colors.textSecondary }]}>
            NOTES
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TextInput
              value={task.notes ?? ''}
              onChangeText={(notes) => updateTask({ ...task, notes })}
              placeholder="Add notes, reminders, or checklist details…"
              placeholderTextColor={colors.textTertiary}
              multiline
              textAlignVertical="top"
              style={[typography.body, styles.notesInput, { color: colors.text }]}
            />
          </View>

          {/* Sub-tasks: the goal's parts (full tasks, e.g. past papers) first, then quick checklist items. */}
          <Text style={[typography.caption, styles.groupLabel, { color: colors.textSecondary }]}>
            SUB-TASKS ({parts.filter((p) => p.done).length + task.subtasks.filter((s) => s.done).length}/
            {parts.length + task.subtasks.length})
          </Text>
          {parts.length > 0 ? (
            <InsetGroup kind="mine" style={styles.partsList}>
              {parts.map((p, idx) => (
                <TaskRow
                  key={p.id}
                  task={p}
                  context="goal"
                  groupPosition="grouped"
                  showTopSeparator={idx > 0}
                />
              ))}
            </InsetGroup>
          ) : null}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {task.subtasks.map((s, idx) => (
              <View
                key={s.id}
                style={[
                  styles.listItemRow,
                  idx > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.separator,
                  },
                ]}
              >
                <Pressable
                  onPress={() => toggleSubtask(s.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: s.done }}
                  accessibilityLabel={`My task sub-task, ${s.title}`}
                  style={styles.subtaskBtn}
                >
                  <Icon
                    name={s.done ? 'checkCircleFill' : 'circle'}
                    size={19}
                    color={colors.accent}
                  />
                  <Text
                    style={[
                      typography.subhead,
                      {
                        color: s.done ? colors.textTertiary : colors.text,
                        textDecorationLine: s.done ? 'line-through' : 'none',
                        flex: 1,
                      },
                    ]}
                  >
                    {s.title}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => removeSubtask(s.id)}
                  accessibilityLabel={`Remove sub-task ${s.title}`}
                  hitSlop={8}
                >
                  <Icon name="close" size={14} color={colors.textTertiary} />
                </Pressable>
              </View>
            ))}

            <View style={styles.inlineInputRow}>
              <TextInput
                value={newSubtask}
                onChangeText={setNewSubtask}
                placeholder="Add a sub-task…"
                placeholderTextColor={colors.textTertiary}
                returnKeyType="done"
                onSubmitEditing={addSubtask}
                style={[
                  typography.subhead,
                  styles.inputBox,
                  // Explicit: on iOS a struck-through title input nearby can leak into this placeholder.
                  { color: colors.text, backgroundColor: colors.surfaceSecondary, textDecorationLine: 'none' },
                ]}
              />
              <Pressable
                onPress={addSubtask}
                disabled={!newSubtask.trim()}
                accessibilityRole="button"
                style={[
                  styles.smallPrimaryBtn,
                  {
                    backgroundColor: newSubtask.trim() ? colors.accent : colors.surfaceSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.caption,
                    {
                      color: newSubtask.trim() ? colors.onAccent : colors.textTertiary,
                      fontWeight: '600',
                    },
                  ]}
                >
                  Add
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Linked Canvas items (Canvas visual grammar) */}
          <Text style={[typography.caption, styles.groupLabel, { color: colors.textSecondary }]}>
            {linkedItems.length > 0
              ? `LINKED CANVAS ITEMS (${linkedItems.length})`
              : 'LINKED CANVAS ITEMS'}
          </Text>
          <View style={styles.linkedList}>
            {linkedItems.map((item) => {
              const overline = ['Canvas', item.courseCode, ...item.location]
                .filter(Boolean)
                .join(' › ');
              const fileContentType =
                item.ref.kind === 'file'
                  ? allCourses
                      .find((c) => c.courseID === item.ref.courseID)
                      ?.files.find((f) => f.id === item.ref.itemID)?.['content-type']
                  : undefined;
              const iconName: IconName =
                item.ref.kind === 'file'
                  ? getFileTypeInfo(item.title, fileContentType).icon
                  : kindIconName(item.ref.kind);

              return (
                <LinkedCanvasItemRow
                  key={`${item.ref.courseID}-${item.ref.kind}-${item.ref.itemID}`}
                  overline={overline}
                  title={item.title}
                  icon={iconName}
                  isSource={item.isSource}
                  setsDeadline={item.isSource && item.ref.kind === 'assignment'}
                  onPress={() =>
                    openCanvasReader(item.ref.courseID, item.ref.kind, item.ref.itemID)
                  }
                  onMenu={() => openLinkedItemActions(item)}
                  onMakeSource={!item.isSource ? () => setSource(task.id, item.ref) : undefined}
                  onUnlink={() => unlinkItem(task.id, item.ref)}
                />
              );
            })}

            <Pressable
              onPress={() =>
                router.push({ pathname: '/link-picker', params: { taskID: task.id } })
              }
              accessibilityRole="button"
              accessibilityLabel="Link Canvas item"
              style={({ pressed }) => [
                styles.linkCanvasBtn,
                { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Icon name="link" size={15} color={colors.accentText} />
              <Text style={[typography.subhead, { color: colors.accentText, fontWeight: '600', flex: 1 }]}>
                Link Canvas item…
              </Text>
              <Icon name="chevronRight" size={14} color={colors.textTertiary} />
            </Pressable>
          </View>

          {/* Delete */}
          <Pressable
            onPress={confirmDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete my task"
            style={({ pressed }) => [
              styles.deleteCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { backgroundColor: colors.dangerSoft },
            ]}
          >
            <Icon name="delete" size={16} color={colors.danger} />
            <Text style={[typography.bodySemibold, { color: colors.danger }]}>Delete task</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const UNLINK_SWIPE_MAX = 96;
const UNLINK_SWIPE_TRIGGER = 64;

function LinkedCanvasItemRow({
  overline,
  title,
  icon,
  isSource,
  setsDeadline,
  onPress,
  onMenu,
  onMakeSource,
  onUnlink,
}: {
  overline: string;
  title: string;
  icon: IconName;
  isSource: boolean;
  setsDeadline: boolean;
  onPress: () => void;
  onMenu: () => void;
  onMakeSource?: () => void;
  onUnlink: () => void;
}) {
  const { colors, typography } = useTheme();
  const [translateX] = useState(() => new Animated.Value(0));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_, g) => {
          const clamped = Math.min(0, Math.max(-UNLINK_SWIPE_MAX, g.dx));
          translateX.setValue(clamped);
        },
        onPanResponderRelease: (_, g) => {
          const shouldUnlink = g.dx <= -UNLINK_SWIPE_TRIGGER;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
          if (shouldUnlink) onUnlink();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        },
      }),
    [translateX, onUnlink],
  );

  const a11yActions = [
    { name: 'open', label: 'Open in reader' },
    ...(onMakeSource ? [{ name: 'makeSource', label: 'Make source' }] : []),
    { name: 'unlink', label: 'Unlink' },
  ];

  return (
    <View style={styles.swipeRowWrap}>
      <View
        style={[styles.unlinkBackdrop, { backgroundColor: colors.danger }]}
        importantForAccessibility="no-hide-descendants"
      >
        <Icon name="close" size={14} color="#FFFFFF" />
        <Text style={[typography.caption, { color: '#FFFFFF', fontWeight: '600' }]}>Unlink</Text>
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <View
          style={[
            styles.fromCanvasCard,
            { backgroundColor: colors.canvasSurface, borderColor: colors.canvasBorder },
          ]}
        >
          <Pressable
            onPress={onPress}
            onLongPress={onMenu}
            delayLongPress={350}
            accessibilityRole="button"
            accessibilityLabel={`${overline}, ${title}${isSource ? ', Source' : ''}${setsDeadline ? ', sets the deadline' : ''}`}
            accessibilityHint="Opens Canvas item in reader. Long press or swipe left for actions."
            accessibilityActions={a11yActions}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'open') onPress();
              else if (e.nativeEvent.actionName === 'makeSource') onMakeSource?.();
              else if (e.nativeEvent.actionName === 'unlink') onUnlink();
            }}
            style={({ pressed }) => [styles.linkedRowMain, pressed && { opacity: 0.72 }]}
          >
            <View style={[styles.kindSquare, { backgroundColor: colors.surfaceSecondary }]}>
              <Icon name={icon} size={16} color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                style={[typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}
                numberOfLines={2}
              >
                {overline}
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.text }]} numberOfLines={2}>
                {title}
              </Text>
              {isSource ? (
                <View style={styles.sourceBadgeRow}>
                  <Badge label="Source" tone="accent" />
                  {setsDeadline ? (
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      sets the deadline
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </Pressable>

          <Pressable
            onPress={onMenu}
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${title}`}
            hitSlop={8}
            style={({ pressed }) => [styles.rowMenuBtn, pressed && { opacity: 0.55 }]}
          >
            <Icon name="more" size={18} color={colors.textTertiary} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function SmallChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.smallChip,
        { backgroundColor: colors.surfaceSecondary },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[typography.caption, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  partsList: { marginHorizontal: 0, marginBottom: spacing.sm },
  content: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
  groupLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    letterSpacing: 0.5,
  },
  card: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  workDaysCard: {
    marginTop: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleInput: {
    flex: 1,
    padding: 0,
    marginTop: 1,
  },
  dividerRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  kvRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  expandedBlock: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  deadlineSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  changeActionBtn: {
    paddingVertical: 2,
    paddingLeft: spacing.xs,
    flexShrink: 0,
  },
  conflictBlock: {
    gap: spacing.sm,
  },
  linkedList: {
    gap: spacing.sm,
  },
  swipeRowWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radii.md,
  },
  unlinkBackdrop: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: spacing.lg,
    gap: 5,
  },
  linkedRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sourceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  rowMenuBtn: {
    padding: 4,
  },
  linkCanvasBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  notesInput: {
    minHeight: 72,
    padding: 0,
  },
  conflictBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputBox: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.sm,
  },
  smallPrimaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.sm,
  },
  fullBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: radii.sm,
  },
  workDaysTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayChipScroll: {
    flexGrow: 0,
    marginHorizontal: -spacing.md,
  },
  dayChipRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 10,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 10,
  },
  subtaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  fromCanvasCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  kindSquare: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  deleteCard: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
  },
});
