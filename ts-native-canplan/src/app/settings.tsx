import { router, Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCanvas } from '../canvas/store';
import type { NotionTaskExport } from '../canvas/types';
import { useAppState } from '../state/AppState';
import { formatDateTime } from '../ui/format';
import { Icon } from '../ui/Icon';
import { radii, spacing, useTheme } from '../ui/theme';

// A 403 means the course locks that section; a 404 means it doesn't use it. Neither is a failure.
const LOCKED_TAB_RE = /^(.+?)\s+(files|pages|folders|quizzes|discussions|modules|module items|syllabus|tabs):\s+Canvas returned HTTP (403|404)\.?$/i;

export default function SettingsScreen() {
  const { colors, typography } = useTheme();
  const { user, source, savedAt, signOut } = useAppState();
  const { courses, indexSize, errors, clearAll, importNotion, tasks } = useCanvas();
  const importedCount = tasks.filter((t) => t.notionID).length;

  // A local, git-ignored export of the Notion Task Tracker (made with the Notion connector). Dev builds only.
  const runNotionImport = () => {
    const items: NotionTaskExport[] = require('../../demo/notion-tasks.json').items;
    const r = importNotion(items);
    Alert.alert(
      'Imported from Notion',
      `${r.added} added, ${r.updated} updated` + (r.linked ? `, ${r.linked} linked to Canvas assignments.` : '.'),
    );
  };
  const [lockedExpanded, setLockedExpanded] = useState(false);

  const { lockedTabs, realErrors } = useMemo(() => {
    const locked: string[] = [];
    const real: string[] = [];
    for (const err of errors) {
      const m = LOCKED_TAB_RE.exec(err);
      if (m) {
        locked.push(`${m[1]} ${m[2].toLowerCase()}`);
      } else {
        real.push(err);
      }
    }
    return { lockedTabs: locked, realErrors: real };
  }, [errors]);

  const handleDone = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const confirmClear = () => {
    Alert.alert(
      'Clear cached data?',
      'Removes cached Canvas courses, feed history, and planner tasks on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => clearAll(),
        },
      ],
    );
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out of Canvas?', 'You can sign back in with your NUS account anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          signOut();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
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
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={styles.content}
      >
        <Text
          style={[
            typography.caption,
            styles.groupLabel,
            { color: colors.textSecondary },
          ]}
        >
          CANVAS SESSION
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <InfoRow label="Signed in as" value={user.name} />
          <InfoRow label="Session source" value={source} divider testID="session-source" />
          {savedAt ? <InfoRow label="Saved" value={formatDateTime(savedAt)} divider /> : null}
          <InfoRow
            label="Cached content"
            value={`${courses.length} courses · ${indexSize} items`}
            divider
          />
        </View>

        {realErrors.length > 0 ? (
          <>
            <Text style={[typography.caption, styles.groupLabel, { color: colors.danger }]}>
              LAST REFRESH ERRORS ({realErrors.length})
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.danger },
              ]}
            >
              {realErrors.map((err, i) => (
                <View
                  key={`${err}-${i}`}
                  style={[
                    styles.errorRow,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.separator,
                    },
                  ]}
                >
                  <Icon name="warning" size={14} color={colors.danger} style={{ marginTop: 2 }} />
                  <Text style={[typography.footnote, { color: colors.text, flex: 1 }]}>{err}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {lockedTabs.length > 0 ? (
          <View
            style={[
              styles.card,
              styles.lockedCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => setLockedExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: lockedExpanded }}
              accessibilityLabel={`Locked in Canvas, ${lockedTabs.length} tabs`}
              accessibilityHint={
                lockedExpanded ? 'Collapses locked tabs list' : 'Expands locked tabs list'
              }
              style={({ pressed }) => [
                styles.lockedRow,
                pressed && { backgroundColor: colors.pressed },
              ]}
            >
              <Icon name="lock" size={14} color={colors.textTertiary} style={{ marginTop: 2 }} />
              <Text
                style={[typography.footnote, { color: colors.textSecondary, flex: 1 }]}
                numberOfLines={lockedExpanded ? undefined : 2}
              >
                <Text style={{ fontWeight: '600', color: colors.text }}>Locked in Canvas: </Text>
                {lockedTabs.join(', ')}
              </Text>
              <Icon
                name={lockedExpanded ? 'chevronUp' : 'chevronDown'}
                size={14}
                color={colors.textTertiary}
                style={{ marginTop: 2 }}
              />
            </Pressable>
          </View>
        ) : null}

        <Text style={[typography.caption, styles.groupLabel, { color: colors.textSecondary }]}>
          DATA & ACCOUNT
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {__DEV__ ? (
            <Pressable
              onPress={runNotionImport}
              accessibilityRole="button"
              accessibilityHint="Adds your Notion Task Tracker tasks to My tasks. Running it again updates them."
              style={({ pressed }) => [
                styles.actionRow,
                { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
                pressed && { backgroundColor: colors.pressed },
              ]}
            >
              <Text style={[typography.bodyMedium, { color: colors.accentText }]}>
                {importedCount ? `Re-import Notion tasks (${importedCount} imported)` : 'Import Notion tasks'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={confirmClear}
            accessibilityRole="button"
            style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: colors.pressed }]}
          >
            <Text style={[typography.bodyMedium, { color: colors.text }]}>Clear cached data</Text>
          </Pressable>
          <Pressable
            onPress={confirmSignOut}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.actionRow,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
              pressed && { backgroundColor: colors.pressed },
            ]}
          >
            <Text style={[typography.bodySemibold, { color: colors.danger }]}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

function InfoRow({
  label,
  value,
  divider,
  testID,
}: {
  label: string;
  value: string;
  divider?: boolean;
  testID?: string;
}) {
  const { colors, typography } = useTheme();
  return (
    <View
      style={[
        styles.infoRow,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
      ]}
    >
      <Text style={[typography.subhead, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        testID={testID}
        style={[
          typography.subhead,
          { color: colors.text, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
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
  lockedCard: {
    marginTop: spacing.md,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  variantCard: {
    padding: spacing.sm,
  },
  segmentTrack: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radii.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  actionRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
});
