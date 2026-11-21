import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { dayKey, useCanvas } from '../canvas/store';
import { NativeDatePicker } from '../ui/components';
import { isoFromDayKey, useNow } from '../ui/format';
import { radii, spacing, useTheme } from '../ui/theme';

type DeadlinePreset = 'today' | 'tomorrow' | '3days' | 'week' | 'none' | 'custom';

function defaultCustomDate() {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(23, 59, 0, 0);
  return d;
}

export default function NewTaskModal() {
  const params = useLocalSearchParams<{ courseCode?: string; title?: string; deadline?: string }>();
  const { colors, typography } = useTheme();
  const { courses, addTask } = useCanvas();

  const initialDeadline = useMemo(() => {
    if (typeof params.deadline !== 'string' || !params.deadline) return null;
    const d = new Date(params.deadline);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [params.deadline]);

  const [title, setTitle] = useState(
    typeof params.title === 'string' && params.title.length > 0 ? params.title : '',
  );
  const [notes, setNotes] = useState('');
  const [courseCode, setCourseCode] = useState<string | undefined>(
    typeof params.courseCode === 'string' && params.courseCode.length > 0
      ? params.courseCode
      : undefined,
  );
  const [preset, setPreset] = useState<DeadlinePreset>(initialDeadline ? 'custom' : 'none');
  const [customDate, setCustomDate] = useState<Date>(() => initialDeadline ?? defaultCustomDate());
  const [planToday, setPlanToday] = useState(false);
  const nowMs = useNow();

  const computedDeadline = useMemo<string | undefined>(() => {
    switch (preset) {
      case 'today':
        return isoFromDayKey(dayKey(new Date(nowMs))) ?? undefined;
      case 'tomorrow':
        return isoFromDayKey(dayKey(new Date(nowMs + 86_400_000))) ?? undefined;
      case '3days':
        return isoFromDayKey(dayKey(new Date(nowMs + 3 * 86_400_000))) ?? undefined;
      case 'week':
        return isoFromDayKey(dayKey(new Date(nowMs + 7 * 86_400_000))) ?? undefined;
      case 'custom':
        return customDate.toISOString();
      case 'none':
        return undefined;
    }
  }, [preset, customDate, nowMs]);

  const canSave = title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    addTask({
      title: title.trim(),
      courseCode,
      notes: notes.trim() || undefined,
      ownDeadline: computedDeadline,
      workDays: planToday ? [dayKey(new Date())] : [],
    });
    router.back();
  };

  return (
    <>
      {Platform.OS === 'ios' ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button onPress={() => router.back()}>Cancel</Stack.Toolbar.Button>
          </Stack.Toolbar>
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button variant="done" disabled={!canSave} onPress={handleSave}>
              Add
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
        </>
      ) : (
        <Stack.Screen
          options={{
            title: 'New task',
            headerLeft: () => (
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => ({ paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={[typography.body, { color: colors.accent }]}>Cancel</Text>
              </Pressable>
            ),
            headerRight: () => (
              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => ({
                  paddingHorizontal: 4,
                  opacity: !canSave ? 0.35 : pressed ? 0.6 : 1,
                })}
              >
                <Text style={[typography.bodySemibold, { color: colors.accent }]}>Add</Text>
              </Pressable>
            ),
          }}
        />
      )}

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
          <Text
            style={[
              typography.caption,
              styles.groupLabel,
              styles.firstGroupLabel,
              { color: colors.textSecondary },
            ]}
          >
            MY TASK
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Final AY24/25 S1 practice"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
              style={[typography.body, { color: colors.text, paddingVertical: 4 }]}
            />
          </View>

          <Text style={[typography.caption, styles.groupLabel, { color: colors.textSecondary }]}>
            MODULE (OPTIONAL)
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={[styles.chipRow, { alignItems: 'center' }]}
          >
            <Pressable
              onPress={() => setCourseCode(undefined)}
              accessibilityRole="button"
              style={[
                styles.chip,
                {
                  backgroundColor: !courseCode ? colors.accent : colors.surface,
                  borderColor: !courseCode ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  typography.caption,
                  { color: !courseCode ? colors.onAccent : colors.text },
                ]}
              >
                None
              </Text>
            </Pressable>
            {courses.map((c) => {
              const active = courseCode === c.code;
              return (
                <Pressable
                  key={c.courseID}
                  onPress={() => setCourseCode(active ? undefined : c.code)}
                  accessibilityRole="button"
                  style={[
                    styles.chip,
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

          <Text style={[typography.caption, styles.groupLabel, { color: colors.textSecondary }]}>
            DEADLINE
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, gap: spacing.sm },
            ]}
          >
            <View style={styles.wrapChips}>
              {(
                [
                  ['none', 'No deadline'],
                  ['today', 'Today'],
                  ['tomorrow', 'Tomorrow'],
                  ['3days', 'In 3 days'],
                  ['week', 'Next week'],
                  ['custom', 'Custom'],
                ] as [DeadlinePreset, string][]
              ).map(([id, label]) => {
                const active = preset === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setPreset(id)}
                    accessibilityRole="button"
                    style={[
                      styles.presetChip,
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
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {preset === 'custom' ? (
              <View
                style={[
                  styles.customPickerRow,
                  { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
                ]}
              >
                <Text style={[typography.subhead, { color: colors.textSecondary, flex: 1 }]}>
                  Pick date
                </Text>
                <NativeDatePicker
                  value={customDate}
                  mode="datetime"
                  accessibilityLabel="Custom deadline date and time"
                  onChange={setCustomDate}
                />
              </View>
            ) : null}
          </View>

          <Text style={[typography.caption, styles.groupLabel, { color: colors.textSecondary }]}>
            NOTES (OPTIONAL)
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes…"
              placeholderTextColor={colors.textTertiary}
              multiline
              textAlignVertical="top"
              style={[typography.body, styles.notesInput, { color: colors.text }]}
            />
          </View>

          <View
            style={[
              styles.switchCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typography.bodyMedium, { color: colors.text }]}>Work on it today</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Adds today to your planned work days
              </Text>
            </View>
            <Switch
              value={planToday}
              onValueChange={setPlanToday}
              trackColor={{ false: colors.surfaceSecondary, true: colors.accent }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  groupLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    letterSpacing: 0.5,
  },
  firstGroupLabel: {
    marginTop: spacing.xs,
  },
  card: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  notesInput: {
    minHeight: 60,
    padding: 0,
  },
  chipRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    maxWidth: 180,
  },
  wrapChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  customPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  switchCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
});
