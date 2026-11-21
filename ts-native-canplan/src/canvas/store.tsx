import { File, Paths } from 'expo-file-system';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiGetAll, CanvasHTTPError, fetchCourses } from './session';
import {
  stripHTML,
  type CanvasAnnouncement,
  type CanvasAssignment,
  type CanvasFile,
  type CanvasFolder,
  type CanvasModule,
  type CanvasModuleItem,
  type CanvasTab,
  type CanvasDiscussion,
  type CanvasQuiz,
  type FolderContents,
  type FeedKind,
  type NotionTaskExport,
  type SourceRef,
  SECTION_OF,
  type CanvasPage,
  type CourseSnapshot,
  type FeedItem,
  type PlannerTask,
  type SearchDoc,
  type SearchHit,
} from './types';

/**
 * Shared data layer for all three variants.
 * Fetch on open → cache on the device → diff against the last fetch → feed of real changes.
 */

const BASELINE_DAYS = 14;
const cacheFile = () => new File(Paths.document, 'canvas-cache.json');
const plannerFile = () => new File(Paths.document, 'planner.json');

type Cache = {
  snapshots: Record<number, CourseSnapshot>;
  feed: FeedItem[];
  seen: string[];
  lastRefresh: string | null;
};

type Planner = { tasks: PlannerTask[]; decided: string[]; hiddenCourses?: number[] };

export type CanvasStore = {
  // Canvas data
  courses: CourseSnapshot[];
  feed: FeedItem[];
  seen: Set<string>;
  unseenCount: number;
  lastRefresh: string | null;
  refreshing: boolean;
  progress: string;
  errors: string[];
  refresh: () => Promise<void>;
  markSeen: (id: string) => void;
  markAllSeen: () => void;
  deadlines: { course: CourseSnapshot; assignment: CanvasAssignment }[];
  /** Searches Canvas content and the student's tasks. Needs at least 2 characters. */
  search: (query: string, courseCode?: string) => SearchHit[];
  indexSize: number;
  // Planner (variant B)
  tasks: PlannerTask[];
  inbox: { course: CourseSnapshot; assignment: CanvasAssignment }[];
  acceptInbox: (course: CourseSnapshot, a: CanvasAssignment) => void;
  /** Turns any Canvas item into one of the student's tasks, linked back to it. Returns the task id. */
  makeActionable: (courseID: number, kind: FeedKind, itemID: number) => string | null;
  /** The task made from this Canvas item (its source link), else the first task referencing it. */
  taskForItem: (kind: FeedKind, itemID: number) => PlannerTask | undefined;
  /** Every task linked to this Canvas item, as source or reference. */
  tasksForItem: (kind: FeedKind, itemID: number) => PlannerTask[];
  /** Adds a Canvas item as a reference on a task. No-op if already its source or a reference. */
  linkItem: (taskID: string, ref: SourceRef) => void;
  /** Removes a reference (or, if it is the source, clears the source). */
  unlinkItem: (taskID: string, ref: SourceRef) => void;
  /** Makes a linked Canvas item the task's source (deadline comes from it if it's an assignment). The old source becomes a reference. */
  setSource: (taskID: string, ref: SourceRef | undefined) => void;
  /** The Canvas items a task is linked to, source first, with their titles and locations, for display. */
  linkedItemsOf: (task: PlannerTask) => { ref: SourceRef; isSource: boolean; title: string; courseCode: string; location: string[] }[];
  /** Imports Notion Task Tracker rows. Re-importing updates by Notion id. Returns counts. */
  importNotion: (items: NotionTaskExport[]) => { added: number; updated: number; linked: number };
  /**
   * A folder in a module's Files tab, like a file browser. `folderID` undefined = the root.
   * Returns null when the course has no folder data (e.g. its Files tab is locked).
   */
  folderContents: (courseID: number, folderID?: number) => FolderContents | null;
  /** Where a Canvas item lives, e.g. ["Files", "Lecture Slides"]. */
  locationOf: (courseID: number, kind: FeedKind, itemID: number) => string[];
  dismissInbox: (course: CourseSnapshot, a: CanvasAssignment) => void;
  addTask: (t: Omit<PlannerTask, 'id' | 'workDays' | 'subtasks' | 'done'> & Partial<PlannerTask>) => void;
  updateTask: (t: PlannerTask) => void;
  deleteTask: (id: string) => void;
  canvasDue: (t: PlannerTask) => string | null;
  deadline: (t: PlannerTask) => string | null;
  hasConflict: (t: PlannerTask) => boolean;
  useCanvasValue: (t: PlannerTask) => void;
  // Housekeeping
  clearAll: () => void;
  /** Every module, hidden ones included, in display order. `courses` excludes hidden ones. */
  allCourses: CourseSnapshot[];
  isAcademic: (c: CourseSnapshot) => boolean;
  isHidden: (courseID: number) => boolean;
  setHidden: (courseID: number, hidden: boolean) => void;
};

const Ctx = createContext<CanvasStore | null>(null);

export function useCanvas(): CanvasStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCanvas must be used inside <CanvasProvider>');
  return v;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const itemKey = (kind: FeedKind, itemID: number) => `${kind}-${itemID}`;

/** Older saves linked tasks with { courseID, assignmentID } and keyed decisions as "course-assignment". */
function migratePlanner(p: any): Planner {
  const tasks = (p.tasks ?? []).map((t: any) =>
    t.source && t.source.assignmentID !== undefined
      ? { ...t, source: { courseID: t.source.courseID, kind: 'assignment', itemID: t.source.assignmentID } }
      : t).map((t: any) => (t.source ? { ...t, title: cleanTitle(t.title) } : t));
  const decided = (p.decided ?? []).map((k: string) => (/^\d+-\d+$/.test(k) ? `assignment-${k.split('-')[1]}` : k));
  return { tasks, decided, hiddenCourses: p.hiddenCourses ?? [] };
}

/** Canvas titles often carry markdown emphasis ("**[IMPORTANT]** Final Exam"). Tasks get the plain words. */
function cleanTitle(t: string): string {
  return t.replace(/[*_]{1,3}/g, '').replace(/\s+/g, ' ').trim();
}

function folderContentsOf(c: CourseSnapshot | undefined, folderID?: number): FolderContents | null {
  const folders = c?.folders;
  if (!c || !folders?.length) return null;
  const byID = new Map(folders.map((f) => [f.id, f]));
  const folder = folderID !== undefined ? byID.get(folderID) : folders.find((f) => f.parent_folder_id === null);
  if (!folder) return null;
  const path: CanvasFolder[] = [];
  for (let f: CanvasFolder | undefined = folder; f; f = f.parent_folder_id !== null ? byID.get(f.parent_folder_id) : undefined) {
    path.unshift(f);
    if (path.length > 20) break; // guard against a malformed cycle
  }
  // Canvas lists folders by position then name, and files by name.
  const children = folders
    .filter((f) => f.parent_folder_id === folder.id && !f.hidden)
    .sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  const files = c.files
    .filter((f) => f.folder_id === folder.id)
    .sort((a, b) => a.display_name.localeCompare(b.display_name, undefined, { numeric: true }));
  return { folder, path, folders: children, files };
}

const sameRef = (a?: SourceRef, b?: SourceRef) => !!a && !!b && a.kind === b.kind && a.itemID === b.itemID && a.courseID === b.courseID;

function canvasTitle(c: CourseSnapshot | undefined, kind: FeedKind, itemID: number): string | undefined {
  if (!c) return undefined;
  return kind === 'assignment' ? c.assignments.find((x) => x.id === itemID)?.name
    : kind === 'announcement' ? c.announcements.find((x) => x.id === itemID)?.title
    : kind === 'file' ? c.files.find((x) => x.id === itemID)?.display_name
    : kind === 'quiz' ? c.quizzes?.find((x) => x.id === itemID)?.title
    : kind === 'discussion' ? c.discussions?.find((x) => x.id === itemID)?.title
    : c.pages.find((x) => x.page_id === itemID)?.title;
}

/** A date-only Notion deadline means "by the end of that day" in Singapore time. */
function notionDeadline(d?: string | null): string | undefined {
  if (!d) return undefined;
  return d.length === 10 ? `${d}T23:59:00+08:00` : d;
}

/**
 * Links a Notion task to a Canvas assignment only when the match is unambiguous:
 * the same normalised title, or exactly one assignment whose title starts with the task's title.
 */
function matchAssignment(c: CourseSnapshot, title: string): CanvasAssignment | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const t = norm(title);
  if (t.length < 5) return undefined;
  const exact = c.assignments.filter((a) => norm(a.name) === t);
  if (exact.length === 1) return exact[0];
  const prefix = c.assignments.filter((a) => norm(a.name).startsWith(t + ' '));
  return prefix.length === 1 ? prefix[0] : undefined;
}

/** Term names for credit-bearing modules mention a semester or special term. */
export function isAcademic(c: CourseSnapshot): boolean {
  return /semester|special term/i.test(c.term);
}

function compareCourses(a: CourseSnapshot, b: CourseSnapshot): number {
  const ac = isAcademic(a), bc = isAcademic(b);
  if (ac !== bc) return ac ? -1 : 1;
  if (a.term !== b.term) return b.term.localeCompare(a.term); // latest term first
  return a.code.localeCompare(b.code);
}

/** Canvas folder full_name is "course files/Lecture Slides/Week 3"; keep the part below the root. */
function folderPathMap(folders: CanvasFolder[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const f of folders) out[f.id] = f.full_name.split('/').slice(1).join('/');
  return out;
}

/** The Canvas due date for a task made from an assignment; null otherwise. */
function canvasDueOf(snapshots: Record<number, CourseSnapshot>, t: PlannerTask): string | null {
  if (t.source?.kind !== 'assignment') return null;
  const itemID = t.source.itemID;
  return snapshots[t.source.courseID]?.assignments.find((a) => a.id === itemID)?.due_at ?? null;
}

function folderCrumbs(c: CourseSnapshot, f: CanvasFile): string[] {
  const path = f.folder_id !== undefined ? c.folderPaths?.[f.folder_id] : undefined;
  return path ? path.split('/').filter(Boolean) : [];
}

/**
 * `demo`: load the git-ignored fixture in demo/ (real data from a local cache) instead of Canvas,
 * so UI work can continue without signing in. Refresh does nothing in demo mode.
 */
export function CanvasProvider({ children, demo = false }: { children: React.ReactNode; demo?: boolean }) {
  const [cache, setCache] = useState<Cache>({ snapshots: {}, feed: [], seen: [], lastRefresh: null });
  const [planner, setPlanner] = useState<Planner>({ tasks: [], decided: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const loaded = useRef(false);
  const refreshingRef = useRef(false);

  // Load from disk once.
  useEffect(() => {
    (async () => {
      if (demo) {
        setCache(require('../../demo/canvas-cache.demo.json'));
      } else try {
        const f = cacheFile();
        if (f.exists) setCache(JSON.parse(await f.text()));
      } catch {}
      try {
        const f = plannerFile();
        if (f.exists) setPlanner(migratePlanner(JSON.parse(await f.text())));
      } catch {}
      loaded.current = true;
    })();
  }, [demo]);

  const saveCache = useCallback((c: Cache) => {
    if (demo) return;
    try { cacheFile().write(JSON.stringify(c)); } catch {}
  }, [demo]);
  const savePlanner = (p: Planner) => {
    try { plannerFile().write(JSON.stringify(p)); } catch {}
  };

  const refresh = useCallback(async () => {
    if (refreshingRef.current || demo) return;
    refreshingRef.current = true;
    setRefreshing(true);
    const errs: string[] = [];
    try {
      const list = await fetchCourses();
      const prev = cache.snapshots;
      const firstFetch = Object.keys(prev).length === 0;
      const snapshots: Record<number, CourseSnapshot> = { ...prev };
      let newFeed: FeedItem[] = [];

      for (const course of list) {
        const code = course.course_code ?? `Course ${course.id}`;
        setProgress(`Fetching ${code}…`);
        const base = `/api/v1/courses/${course.id}`;
        // Each list is fetched on its own so one locked tab (403/404) doesn't hide the rest.
        const get = async <T,>(what: string, path: string): Promise<T[] | null> => {
          try { return await apiGetAll<T>(path); } catch (e: any) {
            // 404 = the course doesn't use this section: record it as empty, not as an error.
            if (e instanceof CanvasHTTPError && e.status === 404 && what !== 'assignments' && what !== 'announcements') return [];
            errs.push(`${code} ${what}: ${e.message}`);
            return null;
          }
        };
        const [assignments, announcements, files, pages, folders, modules, tabs, discussions, quizzes] = await Promise.all([
          get<CanvasAssignment>('assignments', `${base}/assignments?include[]=submission&per_page=100`),
          get<CanvasAnnouncement>('announcements', `${base}/discussion_topics?only_announcements=true&per_page=100`),
          get<CanvasFile>('files', `${base}/files?per_page=100`),
          get<CanvasPage>('pages', `${base}/pages?per_page=100`),
          get<CanvasFolder>('folders', `${base}/folders?per_page=100`),
          get<CanvasModule>('modules', `${base}/modules?include[]=items&per_page=100`),
          get<CanvasTab>('tabs', `${base}/tabs`),
          get<CanvasDiscussion>('discussions', `${base}/discussion_topics?per_page=100`),
          get<CanvasQuiz>('quizzes', `${base}/quizzes?per_page=100`),
        ]);
        // The syllabus only matters when the course shows a Syllabus tab.
        let syllabusHTML: string | null | undefined;
        if (tabs?.some((t) => t.id === 'syllabus')) {
          try { syllabusHTML = (await apiGet<{ syllabus_body?: string | null }>(`${base}?include[]=syllabus_body`)).syllabus_body ?? null; }
          catch (e: any) { errs.push(`${code} syllabus: ${e.message}`); }
        }
        // Canvas leaves out `items` for large modules; fetch those separately.
        if (modules) {
          for (const m of modules) {
            if (!m.items && (m.items_count ?? 0) > 0) {
              m.items = (await get<CanvasModuleItem>('module items', `${base}/modules/${m.id}/items?per_page=100`)) ?? undefined;
            }
          }
        }
        const old = prev[course.id];
        const snap: CourseSnapshot = {
          courseID: course.id,
          code,
          name: course.name ?? code,
          term: course.term?.name ?? 'No term',
          fetchedAt: new Date().toISOString(),
          // A failed fetch keeps the old list, so an error never reads as "everything was removed".
          assignments: assignments ?? old?.assignments ?? [],
          announcements: announcements ?? old?.announcements ?? [],
          files: files ?? old?.files ?? [],
          pages: pages ?? old?.pages ?? [],
          folderPaths: folders ? folderPathMap(folders) : old?.folderPaths,
          folders: folders ?? old?.folders,
          modules: modules ? [...modules].sort((a, b) => a.position - b.position) : old?.modules,
          tabs: tabs ? tabs.filter((t) => !t.hidden).sort((a, b) => a.position - b.position) : old?.tabs,
          discussions: discussions ?? old?.discussions,
          quizzes: quizzes ?? old?.quizzes,
          syllabusHTML: syllabusHTML !== undefined ? syllabusHTML : old?.syllabusHTML,
        };
        newFeed = newFeed.concat(diff(old, snap, firstFetch || !old));
        snapshots[course.id] = snap;
      }

      setCache((c) => {
        const replaced = new Set(newFeed.map((f) => f.id));
        const feed = [...newFeed, ...c.feed.filter((f) => !replaced.has(f.id))].sort((a, b) => b.date.localeCompare(a.date));
        const next: Cache = {
          snapshots,
          feed,
          seen: c.seen.filter((id) => !replaced.has(id)),
          lastRefresh: new Date().toISOString(),
        };
        saveCache(next);
        return next;
      });
    } catch (e: any) {
      errs.push(`Courses: ${e.message}`);
    } finally {
      setErrors(errs);
      setProgress('');
      setRefreshing(false);
      refreshingRef.current = false;
    }
  }, [cache.snapshots, demo, saveCache]);

  // Academic modules of the latest term first; non-academic (career, residential, admin) after.
  const allCourses = useMemo(() => Object.values(cache.snapshots).sort(compareCourses), [cache.snapshots]);
  const hidden = useMemo(() => new Set(planner.hiddenCourses ?? []), [planner.hiddenCourses]);
  const courses = useMemo(() => allCourses.filter((c) => !hidden.has(c.courseID)), [allCourses, hidden]);
  const seen = useMemo(() => new Set(cache.seen), [cache.seen]);

  const deadlines = useMemo(
    () =>
      courses
        .flatMap((course) => course.assignments.filter((a) => a.due_at).map((assignment) => ({ course, assignment })))
        .sort((x, y) => x.assignment.due_at!.localeCompare(y.assignment.due_at!)),
    [courses],
  );

  // Every Canvas item → the tasks linked to it. The source link comes first.
  const tasksByItem = useMemo(() => {
    const m = new Map<string, PlannerTask[]>();
    const push = (k: string, t: PlannerTask, first: boolean) => {
      const arr = m.get(k) ?? [];
      if (!arr.includes(t)) {
        if (first) arr.unshift(t);
        else arr.push(t);
      }
      m.set(k, arr);
    };
    for (const t of planner.tasks) {
      if (t.source) push(itemKey(t.source.kind, t.source.itemID), t, true);
      for (const l of t.links ?? []) push(itemKey(l.kind, l.itemID), t, false);
    }
    return m;
  }, [planner.tasks]);
  const taskByItem = useMemo(() => {
    const m = new Map<string, PlannerTask>();
    for (const [k, ts] of tasksByItem) m.set(k, ts[0]);
    return m;
  }, [tasksByItem]);

  const index = useMemo<SearchDoc[]>(() => {
    const canvas = courses.flatMap((c) => {
      const doc = (kind: FeedKind, itemID: number, title: string, body: string, date: string | null, url?: string, sub: string[] = []): SearchDoc => ({
        id: `${kind}-${itemID}`,
        source: 'canvas',
        kind,
        section: SECTION_OF[kind],
        courseID: c.courseID,
        courseCode: c.code,
        location: [SECTION_OF[kind], ...sub],
        title,
        body,
        date,
        url,
        itemID,
        linkedTaskID: taskByItem.get(`${kind}-${itemID}`)?.id,
        linkedTaskIDs: tasksByItem.get(`${kind}-${itemID}`)?.map((t) => t.id),
      });
      return [
        ...c.announcements.map((a) => doc('announcement', a.id, a.title, stripHTML(a.message), a.posted_at, a.html_url)),
        ...c.assignments.map((a) => doc('assignment', a.id, a.name, stripHTML(a.description), a.due_at, a.html_url)),
        ...c.files.map((f) => doc('file', f.id, f.display_name, '', f.modified_at, f.url, folderCrumbs(c, f))),
        ...c.pages.map((p) => doc('page', p.page_id, p.title, '', p.updated_at, p.html_url)),
        ...(c.quizzes ?? []).map((q) => doc('quiz', q.id, q.title, stripHTML(q.description), q.due_at, q.html_url)),
        ...(c.discussions ?? []).map((d) => doc('discussion', d.id, d.title, stripHTML(d.message), d.last_reply_at ?? d.posted_at, d.html_url)),
      ];
    });
    const tasks: SearchDoc[] = planner.tasks.map((t) => ({
      id: `task-${t.id}`,
      source: 'task',
      courseCode: t.courseCode,
      location: [],
      title: t.title,
      body: t.subtasks.map((st) => st.title).join(' · '),
      date: t.deadlineOverride ?? canvasDueOf(cache.snapshots, t) ?? t.ownDeadline ?? null,
      taskID: t.id,
      done: t.done,
    }));
    return [...tasks, ...canvas];
  }, [courses, planner.tasks, taskByItem, tasksByItem, cache.snapshots]);

  const search = useCallback(
    (query: string, courseCode?: string) => searchIndex(index, query, courseCode),
    [index],
  );

  // ---- Planner ----
  const updatePlanner = (f: (p: Planner) => Planner) =>
    setPlanner((p) => { const n = f(p); savePlanner(n); return n; });

  const decided = useMemo(() => new Set(planner.decided), [planner.decided]);
  // "Now" advances with each refresh, so past-due items leave the inbox without a restart.
  const now = cache.lastRefresh ? Date.parse(cache.lastRefresh) : 0;
  const inbox = useMemo(
    () => deadlines.filter(({ course, assignment }) =>
      new Date(assignment.due_at!).getTime() > now && !decided.has(itemKey('assignment', assignment.id))),
    [deadlines, decided, now],
  );

  const canvasDue = useCallback((t: PlannerTask) => canvasDueOf(cache.snapshots, t), [cache.snapshots]);

  // The feed is real changes first, then the rest of each course's Canvas history, so Updates scrolls to term start.
  const fullFeed = useMemo(() => {
    const inFeed = new Set(cache.feed.map((f) => f.id));
    const history: FeedItem[] = [];
    const push = (c: CourseSnapshot, kind: FeedKind, itemID: number, title: string, date: string | null, detail?: string, url?: string) => {
      const id = `${kind}-${itemID}`;
      if (!date || inFeed.has(id)) return;
      history.push({ id, kind, itemID, courseID: c.courseID, courseCode: c.code, title, change: 'Posted', date, detail, url });
    };
    for (const c of courses) {
      c.announcements.forEach((a) => push(c, 'announcement', a.id, a.title, a.posted_at, stripHTML(a.message), a.html_url));
      c.assignments.forEach((a) => push(c, 'assignment', a.id, a.name, a.updated_at, undefined, a.html_url));
      c.files.forEach((f) => push(c, 'file', f.id, f.display_name, f.modified_at ?? f.updated_at, undefined, f.url));
      c.pages.forEach((pg) => push(c, 'page', pg.page_id, pg.title, pg.updated_at, undefined, pg.html_url));
    }
    return [...cache.feed, ...history].sort((a, b) => b.date.localeCompare(a.date));
  }, [cache.feed, courses]);
  // History items never count as unread.
  const seenWithHistory = useMemo(() => {
    const s2 = new Set(seen);
    for (const f of fullFeed) if (f.change === 'Posted') s2.add(f.id);
    return s2;
  }, [seen, fullFeed]);

  const makeActionable = (courseID: number, kind: FeedKind, itemID: number): string | null => {
    const existing = taskByItem.get(itemKey(kind, itemID));
    if (existing) return existing.id;
    const c = cache.snapshots[courseID];
    if (!c) return null;
    const title = canvasTitle(c, kind, itemID);
    if (!title) return null;
    const id = uid();
    const clean = cleanTitle(title);
    updatePlanner((p) => ({
      decided: [...new Set([...p.decided, itemKey(kind, itemID)])],
      tasks: [...p.tasks, { id, title: clean, courseCode: c.code, source: { courseID, kind, itemID }, workDays: [], subtasks: [], done: false }],
    }));
    return id;
  };

  const store: CanvasStore = {
    courses,
    feed: fullFeed.filter((f) => !hidden.has(f.courseID)),
    seen: seenWithHistory,
    unseenCount: cache.feed.filter((f) => !seen.has(f.id) && !hidden.has(f.courseID)).length,
    lastRefresh: cache.lastRefresh,
    refreshing,
    progress,
    errors,
    refresh,
    markSeen: (id) => setCache((c) => { const n = { ...c, seen: [...new Set([...c.seen, id])] }; saveCache(n); return n; }),
    markAllSeen: () => setCache((c) => { const n = { ...c, seen: c.feed.map((f) => f.id) }; saveCache(n); return n; }),
    deadlines,
    search,
    indexSize: index.length,

    tasks: planner.tasks,
    inbox,
    acceptInbox: (course, a) => { makeActionable(course.courseID, 'assignment', a.id); },
    dismissInbox: (_course, a) => updatePlanner((p) => ({ ...p, decided: [...new Set([...p.decided, itemKey('assignment', a.id)])] })),
    makeActionable,
    importNotion: (items) => {
      const result = { added: 0, updated: 0, linked: 0 };
      // Computed from the current state, not inside a state updater, so the counts are exact.
      const p = planner;
      {
        const byNotion = new Map(p.tasks.filter((t) => t.notionID).map((t) => [t.notionID!, t]));
        const tasks = [...p.tasks];
        for (const it of items) {
          const course = courses.find((c) => c.code === it.courseCode);
          const match = course ? matchAssignment(course, it.title) : undefined;
          const deadline = notionDeadline(it.dueEnd ?? it.dueStart);
          const notes = [
            it.parentTitle ? `Part of: ${it.parentTitle}` : null,
            `Imported from Notion${it.priority ? ` · Priority: ${it.priority}` : ''}`,
          ].filter(Boolean).join('\n');
          const existing = byNotion.get(it.notionID);
          const base: PlannerTask = {
            id: existing?.id ?? uid(),
            title: it.title,
            courseCode: it.courseCode ?? undefined,
            source: existing?.source ?? (match && course ? { courseID: course.courseID, kind: 'assignment', itemID: match.id } : undefined),
            ownDeadline: deadline,
            workDays: [...new Set([...(existing?.workDays ?? []), ...(it.scheduled ? [it.scheduled.slice(0, 10)] : [])])].sort(),
            subtasks: existing?.subtasks ?? [],
            done: it.status === 'Done',
            notes: existing?.notes ?? notes,
            notionID: it.notionID,
            group: it.parentTitle ?? existing?.group,
            deadlineOverride: existing?.deadlineOverride,
            canvasDueWhenOverridden: existing?.canvasDueWhenOverridden,
          };
          if (base.source && !existing?.source) result.linked++;
          if (existing) {
            tasks[tasks.findIndex((t) => t.id === existing.id)] = base;
            result.updated++;
          } else {
            tasks.push(base);
            result.added++;
          }
        }
        const decided = new Set(p.decided);
        for (const t of tasks) if (t.source) decided.add(itemKey(t.source.kind, t.source.itemID));
        const next: Planner = { ...p, tasks, decided: [...decided] };
        setPlanner(next);
        savePlanner(next);
      }
      return result;
    },
    folderContents: (courseID, folderID) => folderContentsOf(cache.snapshots[courseID], folderID),
    taskForItem: (kind, itemID) => taskByItem.get(itemKey(kind, itemID)),
    tasksForItem: (kind, itemID) => tasksByItem.get(itemKey(kind, itemID)) ?? [],
    linkItem: (taskID, ref) => updatePlanner((p) => ({
      ...p,
      tasks: p.tasks.map((t) => {
        if (t.id !== taskID || sameRef(t.source, ref) || (t.links ?? []).some((l) => sameRef(l, ref))) return t;
        return { ...t, links: [...(t.links ?? []), ref] };
      }),
    })),
    unlinkItem: (taskID, ref) => updatePlanner((p) => ({
      ...p,
      tasks: p.tasks.map((t) => {
        if (t.id !== taskID) return t;
        if (sameRef(t.source, ref)) return { ...t, source: undefined, deadlineOverride: undefined, canvasDueWhenOverridden: undefined };
        return { ...t, links: (t.links ?? []).filter((l) => !sameRef(l, ref)) };
      }),
    })),
    setSource: (taskID, ref) => updatePlanner((p) => ({
      ...p,
      tasks: p.tasks.map((t) => {
        if (t.id !== taskID || sameRef(t.source, ref)) return t;
        const links = (t.links ?? []).filter((l) => !sameRef(l, ref));
        if (t.source) links.unshift(t.source);
        // A new source means a different Canvas date: an old override no longer refers to it.
        return { ...t, source: ref, links, deadlineOverride: undefined, canvasDueWhenOverridden: undefined };
      }),
    })),
    linkedItemsOf: (task) =>
      [...(task.source ? [{ ref: task.source, isSource: true }] : []), ...(task.links ?? []).map((ref) => ({ ref, isSource: false }))].map(({ ref, isSource }) => {
        const c = cache.snapshots[ref.courseID];
        return { ref, isSource, title: canvasTitle(c, ref.kind, ref.itemID) ?? 'Item no longer on Canvas', courseCode: c?.code ?? '', location: c ? [SECTION_OF[ref.kind], ...(ref.kind === 'file' ? (() => { const f = c.files.find((x) => x.id === ref.itemID); return f ? folderCrumbs(c, f) : []; })() : [])] : [] };
      }),
    locationOf: (courseID, kind, itemID) => {
      const c = cache.snapshots[courseID];
      const f = kind === 'file' ? c?.files.find((x) => x.id === itemID) : undefined;
      return [SECTION_OF[kind], ...(c && f ? folderCrumbs(c, f) : [])];
    },
    addTask: (t) => updatePlanner((p) => ({ ...p, tasks: [...p.tasks, { workDays: [], subtasks: [], done: false, ...t, id: uid() }] })),
    updateTask: (t) => updatePlanner((p) => ({
      ...p,
      // A work day is a calendar day; the same day twice is one day.
      tasks: p.tasks.map((x) => (x.id === t.id ? { ...t, workDays: [...new Set(t.workDays)].sort() } : x)),
    })),
    deleteTask: (id) => updatePlanner((p) => ({ ...p, tasks: p.tasks.filter((x) => x.id !== id) })),
    canvasDue,
    deadline: (t) => t.deadlineOverride ?? canvasDue(t) ?? t.ownDeadline ?? null,
    hasConflict: (t) => !!t.deadlineOverride && !!t.source && canvasDue(t) !== (t.canvasDueWhenOverridden ?? null),
    useCanvasValue: (t) => updatePlanner((p) => ({
      ...p,
      tasks: p.tasks.map((x) => (x.id === t.id ? { ...x, deadlineOverride: undefined, canvasDueWhenOverridden: undefined } : x)),
    })),

    allCourses,
    isAcademic,
    isHidden: (id) => hidden.has(id),
    setHidden: (id, h) => updatePlanner((p) => {
      const set = new Set(p.hiddenCourses ?? []);
      if (h) set.add(id); else set.delete(id);
      return { ...p, hiddenCourses: [...set] };
    }),
    clearAll: () => {
      const empty: Cache = { snapshots: {}, feed: [], seen: [], lastRefresh: null };
      setCache(empty); saveCache(empty);
      const p: Planner = { tasks: [], decided: [] };
      setPlanner(p); savePlanner(p);
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

// ---- Change detection ----

function diff(old: CourseSnapshot | undefined, snap: CourseSnapshot, baseline: boolean): FeedItem[] {
  const out: FeedItem[] = [];
  const add = (kind: FeedItem['kind'], itemID: number, title: string, change: FeedItem['change'], date: string | null, detail?: string, url?: string) =>
    out.push({ id: `${kind}-${itemID}`, kind, itemID, courseID: snap.courseID, courseCode: snap.code, title, change, date: date ?? new Date().toISOString(), detail, url });
  const due = (d: string | null) => (d ? `Due ${new Date(d).toLocaleString()}` : undefined);

  if (baseline) {
    // First fetch: nothing is "new", so seed the feed with recent items only.
    const cutoff = new Date(Date.now() - BASELINE_DAYS * 86_400_000).toISOString();
    snap.announcements.filter((a) => (a.posted_at ?? '') > cutoff).forEach((a) => add('announcement', a.id, a.title, 'New', a.posted_at, stripHTML(a.message), a.html_url));
    snap.files.filter((f) => (f.modified_at ?? f.updated_at ?? '') > cutoff).forEach((f) => add('file', f.id, f.display_name, 'New', f.modified_at ?? f.updated_at, undefined, f.url));
    snap.assignments.filter((a) => (a.updated_at ?? '') > cutoff).forEach((a) => add('assignment', a.id, a.name, 'Updated', a.updated_at, due(a.due_at), a.html_url));
    return out;
  }
  if (!old) return out;

  const oldAnn = new Map(old.announcements.map((a) => [a.id, a]));
  snap.announcements.filter((a) => !oldAnn.has(a.id)).forEach((a) => add('announcement', a.id, a.title, 'New', a.posted_at, stripHTML(a.message), a.html_url));

  const oldFiles = new Map(old.files.map((f) => [f.id, f]));
  for (const f of snap.files) {
    const o = oldFiles.get(f.id);
    if (!o) add('file', f.id, f.display_name, 'New', f.modified_at ?? f.updated_at, undefined, f.url);
    // Only a new modified_at or size counts. A bumped updated_at alone is timestamp noise.
    else if (o.modified_at !== f.modified_at || o.size !== f.size) add('file', f.id, f.display_name, 'Updated', f.modified_at, 'File replaced', f.url);
  }

  const oldAsg = new Map(old.assignments.map((a) => [a.id, a]));
  for (const a of snap.assignments) {
    const o = oldAsg.get(a.id);
    if (!o) add('assignment', a.id, a.name, 'New', a.updated_at, due(a.due_at), a.html_url);
    else if (o.due_at !== a.due_at) {
      const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : 'none');
      add('assignment', a.id, a.name, 'Due date changed', new Date().toISOString(), `${fmt(o.due_at)} → ${fmt(a.due_at)}`, a.html_url);
    } else if (o.description !== a.description || o.name !== a.name) add('assignment', a.id, a.name, 'Updated', a.updated_at, undefined, a.html_url);
  }

  const oldPages = new Map(old.pages.map((p) => [p.page_id, p]));
  snap.pages.filter((p) => !oldPages.has(p.page_id)).forEach((p) => add('page', p.page_id, p.title, 'New', p.updated_at, undefined, p.html_url));
  return out;
}

// ---- Search ----

export function searchIndex(index: SearchDoc[], query: string, courseCode?: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1);
  // "where is the exam" → "exam". If only stopwords remain, keep them so the query still means something.
  const content = words.filter((t) => !STOPWORDS.has(t));
  const terms = content.length ? content : words;
  if (!terms.length) return [];
  const hits: SearchHit[] = [];
  for (const doc of index) {
    if (courseCode && doc.courseCode !== courseCode) continue;
    const title = doc.title.toLowerCase();
    const body = doc.body.toLowerCase();
    let score = 0;
    let allInTitle = true;
    let ok = true;
    for (const t of terms) {
      const inTitle = title.includes(t);
      const bodyCount = inTitle ? 0 : Math.min(body.split(t).length - 1, 3);
      if (!inTitle && !bodyCount) { ok = false; break; } // every term must match somewhere
      if (!inTitle) allInTitle = false;
      // A title hit outweighs any amount of body text; whole-word title hits rank above partial ones.
      score += inTitle
        ? new RegExp(`\\b${escapeRe(t)}\\b`).test(title) ? 14 : new RegExp(`\\b${escapeRe(t)}`).test(title) ? 10 : 7
        : bodyCount;
    }
    if (!ok) continue;
    if (terms.length > 1 && (title.includes(q) || body.includes(q))) score += 10; // exact phrase
    if (doc.source === 'task' && !doc.done) score += 4; // your own open tasks first among equals
    // Show body context whenever the body mentions a term: for questions the answer is usually in the body.
    const bodyTerm = terms.find((t) => !title.includes(t) && body.includes(t)) ?? terms.find((t) => body.includes(t));
    hits.push({ doc, score, snippet: bodyTerm ? snippet(doc.body, bodyTerm) : undefined, matchedIn: allInTitle ? 'title' : 'body' });
  }
  return hits.sort((a, b) => b.score - a.score || (b.doc.date ?? '').localeCompare(a.doc.date ?? ''));
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or',
  'what', 'where', 'when', 'which', 'who', 'how', 'why', 'do', 'does', 'did', 'can', 'could', 'i', 'my',
  'me', 'we', 'it', 'its', 'this', 'that', 'there', 'about', 'with', 'any', 'allowed', 'even',
]);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function snippet(text: string, term: string): string | undefined {
  if (!text) return undefined;
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return text.slice(0, 160);
  const start = Math.max(0, i - 80);
  const end = Math.min(text.length, i + term.length + 160);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}
