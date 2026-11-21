// Minimal Canvas REST shapes. Dates are ISO strings as Canvas sends them.

export type CanvasUser = { id: number; name: string };

export type CanvasCourse = {
  id: number;
  name?: string;
  course_code?: string;
  term?: { name?: string };
};

export type CanvasAssignment = {
  id: number;
  name: string;
  due_at: string | null;
  updated_at: string | null;
  html_url?: string;
  points_possible?: number | null;
  description?: string | null;
  is_quiz_assignment?: boolean;
  /** This student's submission and grade. */
  submission?: CanvasSubmission;
};

export type CanvasAnnouncement = {
  id: number;
  title: string;
  posted_at: string | null;
  message?: string | null;
  html_url?: string;
};

export type CanvasFile = {
  id: number;
  folder_id?: number;
  display_name: string;
  'content-type'?: string;
  updated_at: string | null;
  modified_at: string | null;
  size?: number;
  url?: string;
};

export type CanvasPage = {
  page_id: number;
  /** The page's slug, used to fetch its body on demand. */
  url?: string;
  title: string;
  updated_at: string | null;
  html_url?: string;
};

/** Everything fetched for one course, cached between launches. */
export type CourseSnapshot = {
  courseID: number;
  code: string;
  name: string;
  term: string;
  fetchedAt: string;
  assignments: CanvasAssignment[];
  announcements: CanvasAnnouncement[];
  files: CanvasFile[];
  pages: CanvasPage[];
  /** Folder id → path below the course root, e.g. "Lecture Slides/Week 3". */
  folderPaths?: Record<number, string>;
  /** The Files tab as a tree: every folder with its parent. The root ("course files") has no parent. */
  folders?: CanvasFolder[];
  /** The Modules tab: how many courses organise their content, in order. */
  modules?: CanvasModule[];
  /** The course's own navigation, exactly as Canvas shows it to this student (order and visibility vary per course). */
  tabs?: CanvasTab[];
  /** Discussion topics that are not announcements. */
  discussions?: CanvasDiscussion[];
  /** Classic quizzes. (New Quizzes appear as assignments.) */
  quizzes?: CanvasQuiz[];
  /** The Syllabus tab's HTML, if the course has one. */
  syllabusHTML?: string | null;
};

export type CanvasTab = {
  /** e.g. "home", "announcements", "assignments", "discussions", "grades", "people", "pages", "files",
   *  "syllabus", "quizzes", "modules", or "context_external_tool_123" for tools like lecture recordings. */
  id: string;
  label: string;
  type: 'internal' | 'external';
  html_url: string;
  /** Full URL for external tools. */
  full_url?: string;
  position: number;
  hidden?: boolean;
};

export type CanvasDiscussion = {
  id: number;
  title: string;
  posted_at: string | null;
  last_reply_at?: string | null;
  message?: string | null;
  discussion_subentry_count?: number;
  html_url?: string;
};

export type CanvasQuiz = {
  id: number;
  title: string;
  due_at: string | null;
  unlock_at?: string | null;
  lock_at?: string | null;
  points_possible?: number | null;
  question_count?: number;
  time_limit?: number | null;
  description?: string | null;
  html_url?: string;
};

/** The student's own submission on an assignment (from include[]=submission). */
export type CanvasSubmission = {
  workflow_state?: 'unsubmitted' | 'submitted' | 'graded' | 'pending_review' | string;
  submitted_at?: string | null;
  score?: number | null;
  grade?: string | null;
  late?: boolean;
  missing?: boolean;
  excused?: boolean | null;
};

export type CanvasFolder = {
  id: number;
  name: string;
  full_name: string;
  parent_folder_id: number | null;
  position?: number | null;
  files_count?: number;
  folders_count?: number;
  hidden?: boolean | null;
  locked?: boolean;
};

export type CanvasModuleItemType =
  | 'File' | 'Page' | 'Discussion' | 'Assignment' | 'Quiz' | 'SubHeader' | 'ExternalUrl' | 'ExternalTool';

export type CanvasModuleItem = {
  id: number;
  title: string;
  type: CanvasModuleItemType;
  position?: number;
  /** Nesting level Canvas shows (0 = top). */
  indent?: number;
  /** The File / Assignment / Quiz / Discussion id. */
  content_id?: number;
  /** For Page items: the page slug. */
  page_url?: string;
  html_url?: string;
  external_url?: string;
};

export type CanvasModule = {
  id: number;
  name: string;
  position: number;
  unlock_at?: string | null;
  items_count?: number;
  items_url?: string;
  items?: CanvasModuleItem[];
};

/** What a folder contains, ready to list like a file browser. */
export type FolderContents = {
  folder: CanvasFolder;
  /** Root first, ending with this folder. */
  path: CanvasFolder[];
  folders: CanvasFolder[];
  files: CanvasFile[];
};

/** Every Canvas item kind the app can show, search and link to tasks. (The change feed only produces the first four.) */
export type FeedKind = 'announcement' | 'assignment' | 'file' | 'page' | 'quiz' | 'discussion';
/** 'Posted' = history: an item that was already on Canvas before this app started watching (never unread). */
export type FeedChange = 'New' | 'Updated' | 'Due date changed' | 'Posted';

/** One thing that is new or changed since the previous fetch. */
export type FeedItem = {
  id: string; // `${kind}-${itemID}`
  kind: FeedKind;
  itemID: number;
  courseID: number;
  courseCode: string;
  title: string;
  change: FeedChange;
  date: string;
  detail?: string;
  url?: string;
};

/** Where a search result lives. "task" is one of the student's own actionables. */
export type SearchSource = 'canvas' | 'task';

/** The Canvas section an item belongs to, as the student sees it in Canvas. */
export type CanvasSection = 'Announcements' | 'Assignments' | 'Files' | 'Pages' | 'Quizzes' | 'Discussions';

export const SECTION_OF: Record<FeedKind, CanvasSection> = {
  announcement: 'Announcements',
  assignment: 'Assignments',
  file: 'Files',
  page: 'Pages',
  quiz: 'Quizzes',
  discussion: 'Discussions',
};

/** A searchable item: Canvas content or one of the student's tasks. */
export type SearchDoc = {
  id: string;
  source: SearchSource;
  /** Canvas kind. Undefined for tasks. */
  kind?: FeedKind;
  /** Canvas section for Canvas items; undefined for tasks. */
  section?: CanvasSection;
  courseID?: number;
  courseCode?: string;
  /** Breadcrumb below the module, e.g. ["Files", "Lecture Slides", "Week 3"] or ["Announcements"]. */
  location: string[];
  title: string;
  body: string;
  /** Posted/modified date for Canvas, deadline for tasks. */
  date: string | null;
  url?: string;
  /** Canvas item id (for kind) or task id. */
  itemID?: number;
  taskID?: string;
  /** For Canvas items already turned into a task (the first linked task). */
  linkedTaskID?: string;
  /** Every task this Canvas item is linked to, as source or reference. */
  linkedTaskIDs?: string[];
  /** For tasks: done state. */
  done?: boolean;
};

export type SearchHit = {
  doc: SearchDoc;
  score: number;
  /** Text around the first match in the body, if the body matched. */
  snippet?: string;
  /** Whether every query term matched the title (strong) or some only matched the body (weak). */
  matchedIn: 'title' | 'body';
};

// ---- Planner (variant B) ----

/** The Canvas item a task was made from. Assignments also give the task its deadline. */
export type SourceRef = { courseID: number; kind: FeedKind; itemID: number };

export type Subtask = { id: string; title: string; done: boolean };

export type PlannerTask = {
  id: string;
  title: string;
  courseCode?: string;
  /** The Canvas item this task was made from. An assignment source also sets the deadline. */
  source?: SourceRef;
  /** Student's own date. Undefined means "use the Canvas value". */
  deadlineOverride?: string;
  /** Canvas due date when the override was made, to flag later Canvas changes. */
  canvasDueWhenOverridden?: string | null;
  /** Deadline for own tasks with no source. */
  ownDeadline?: string;
  /** Planned "work on it" days as YYYY-MM-DD. */
  workDays: string[];
  subtasks: Subtask[];
  done: boolean;
  /** Free-form notes. */
  notes?: string;
  /** Set for tasks imported from the Notion Task Tracker, so re-importing updates instead of duplicating. */
  notionID?: string;
  /**
   * Other Canvas items this task refers to (past-paper files, slides, announcements…), beyond its `source`.
   * Together with `source` this makes tasks ↔ Canvas items many-to-many. References never set the deadline.
   */
  links?: SourceRef[];
  /** A parent goal this task belongs to, e.g. "Final Exam" for a past-paper task. Group by (courseCode, group). */
  group?: string;
};

/** One row exported from the Notion Task Tracker. */
export type NotionTaskExport = {
  notionID: string;
  title: string;
  status: 'Not started' | 'In progress' | 'Done' | 'Unreleased' | string;
  priority?: string | null;
  courseCode?: string | null;
  parentID?: string | null;
  parentTitle?: string | null;
  /** Notion due dates are often ranges used as study windows; the end is the real deadline. */
  dueStart?: string | null;
  dueEnd?: string | null;
  /** "Scheduled date": the day the student planned to work on it. */
  scheduled?: string | null;
};

export const stripHTML = (html?: string | null): string =>
  (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
