import { dayKey } from '../canvas/store';
import type { PlannerTask } from '../canvas/types';
import { formatShortWeekdayDate } from './format';

export type GroupProgress = {
  done: number;
  total: number;
};

export type TaskScheduleSection = {
  key: string;
  title: string;
  tone?: 'default' | 'danger' | 'accent';
  isToday?: boolean;
  data: PlannerTask[];
  /** Parts placed directly under their goal in this section; render them indented without the parent label. */
  indentedIDs?: Set<string>;
};

/**
 * Within one section, move each goal's parts directly under the goal (when both are in the section),
 * so the hierarchy is visible without a separate tree. Returns the new order and the ids to indent.
 */
export function nestPartsUnderGoals(data: PlannerTask[]): { data: PlannerTask[]; indentedIDs: Set<string> } {
  const key = (course: string | undefined, title: string) => `${course ?? ''}::${title.trim().toLowerCase()}`;
  const goals = new Map(data.map((t) => [key(t.courseCode, t.title), t]));
  const partsByGoal = new Map<string, PlannerTask[]>();
  const indentedIDs = new Set<string>();
  for (const t of data) {
    if (!t.group) continue;
    const g = goals.get(key(t.courseCode, t.group));
    if (!g || g.id === t.id) continue;
    partsByGoal.set(g.id, [...(partsByGoal.get(g.id) ?? []), t]);
    indentedIDs.add(t.id);
  }
  const out: PlannerTask[] = [];
  for (const t of data) {
    if (indentedIDs.has(t.id)) continue;
    out.push(t, ...(partsByGoal.get(t.id) ?? []));
  }
  return { data: out, indentedIDs };
}

/**
 * Groups tasks into Overdue, Today, planned days, Upcoming (not planned), No date, and optionally Completed.
 */
export function groupTasksBySchedule(
  tasks: PlannerTask[],
  getDeadline: (t: PlannerTask) => string | null,
  nowMs: number,
  options?: { includeDone?: boolean; titlePrefix?: string },
): TaskScheduleSection[] {
  const includeDone = options?.includeDone ?? false;
  const prefix = options?.titlePrefix ?? '';
  const fmtTitle = (label: string) => (prefix ? `${prefix} · ${label}` : label);
  const keyPrefix = prefix || 'tasks';
  const todayStr = dayKey(new Date(nowMs));

  const overdue: PlannerTask[] = [];
  const today: PlannerTask[] = [];
  const plannedByDay = new Map<string, PlannerTask[]>();
  const upcomingNotPlanned: PlannerTask[] = [];
  const noDate: PlannerTask[] = [];
  const completed: PlannerTask[] = [];

  for (const t of tasks) {
    if (t.done) {
      if (includeDone) completed.push(t);
      continue;
    }
    const due = getDeadline(t);
    const dueDate = due ? new Date(due) : null;
    const dueMs = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.getTime() : null;
    const nextPlannedDay = t.workDays.filter((d) => d > todayStr).sort()[0];

    if (dueMs !== null && dueMs < nowMs) {
      overdue.push(t);
    } else if (t.workDays.includes(todayStr) || (dueDate && dayKey(dueDate) === todayStr)) {
      today.push(t);
    } else if (nextPlannedDay) {
      const list = plannedByDay.get(nextPlannedDay) ?? [];
      list.push(t);
      plannedByDay.set(nextPlannedDay, list);
    } else if (dueMs !== null) {
      upcomingNotPlanned.push(t);
    } else {
      noDate.push(t);
    }
  }

  const byDueAsc = compareTasks(getDeadline);

  overdue.sort(byDueAsc);
  today.sort(byDueAsc);
  upcomingNotPlanned.sort(byDueAsc);
  noDate.sort(byDueAsc);

  const out: TaskScheduleSection[] = [];
  if (overdue.length > 0) {
    out.push({ key: `${keyPrefix}-overdue`, title: fmtTitle('Overdue'), tone: 'danger', data: overdue });
  }
  if (today.length > 0) {
    out.push({
      key: `${keyPrefix}-today`,
      title: fmtTitle('Today'),
      tone: 'accent',
      isToday: true,
      data: today,
    });
  }

  const sortedDays = [...plannedByDay.keys()].sort();
  for (const day of sortedDays) {
    const dayTasks = plannedByDay.get(day)!;
    dayTasks.sort(byDueAsc);
    out.push({
      key: `${keyPrefix}-plan-${day}`,
      title: fmtTitle(formatShortWeekdayDate(day)),
      data: dayTasks,
    });
  }

  if (upcomingNotPlanned.length > 0) {
    out.push({
      key: `${keyPrefix}-upcoming-unplanned`,
      title: fmtTitle('Upcoming'),
      data: upcomingNotPlanned,
    });
  }
  if (noDate.length > 0) {
    out.push({ key: `${keyPrefix}-nodate`, title: fmtTitle('No date'), data: noDate });
  }
  if (completed.length > 0) {
    out.push({ key: `${keyPrefix}-completed`, title: fmtTitle('Completed'), data: completed });
  }
  return out.map((sec) => {
    const nested = nestPartsUnderGoals(sec.data);
    return { ...sec, data: nested.data, indentedIDs: nested.indentedIDs };
  });
}

function groupKey(courseCode: string | undefined, name: string): string {
  return `${(courseCode ?? '').trim().toLowerCase()}::${name.trim().toLowerCase()}`;
}

/**
 * Counts child tasks per `(courseCode, group)` pair so parent tasks whose title equals
 * another task's `group` (in the same course) can show progress ("4 of 12 done").
 */
export function buildGroupProgressMap(tasks: PlannerTask[]): Map<string, GroupProgress> {
  const map = new Map<string, GroupProgress>();
  for (const t of tasks) {
    const group = t.group?.trim();
    if (!group) continue;
    const key = groupKey(t.courseCode, group);
    const cur = map.get(key) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (t.done) cur.done += 1;
    map.set(key, cur);
  }
  return map;
}

/**
 * Returns child completion progress if `task` is a parent goal for other tasks in the same course.
 */
export function getParentTaskProgress(
  task: PlannerTask,
  progressMap: Map<string, GroupProgress>,
): GroupProgress | undefined {
  const title = task.title.trim();
  if (!title) return undefined;
  // Don't treat a child task as its own parent if its group name matches its title.
  if (task.group?.trim().toLowerCase() === title.toLowerCase()) return undefined;
  return progressMap.get(groupKey(task.courseCode, title));
}

/**
 * The parts of a goal: tasks in the same module whose `group` is the goal's title.
 * Open parts first (by next planned day, then title), then done parts.
 */
/**
 * The owner's task order everywhere: incomplete before complete, then later deadline before earlier
 * (no deadline last), then name.
 */
export function compareTasks(getDeadline: (t: PlannerTask) => string | null | undefined) {
  return (a: PlannerTask, b: PlannerTask) =>
    Number(a.done) - Number(b.done) ||
    (getDeadline(b) ?? '').localeCompare(getDeadline(a) ?? '') ||
    a.title.localeCompare(b.title, undefined, { numeric: true });
}

export function partsOf(goal: PlannerTask, tasks: PlannerTask[]): PlannerTask[] {
  const title = goal.title.trim().toLowerCase();
  if (!title) return [];
  return tasks
    .filter((t) => t.id !== goal.id && t.courseCode === goal.courseCode && t.group?.trim().toLowerCase() === title)
    .sort(compareTasks((t) => t.deadlineOverride ?? t.ownDeadline ?? null));
}
