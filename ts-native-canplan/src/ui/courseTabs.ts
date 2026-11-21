import { CANVAS_BASE } from '../canvas/session';
import type {
  CanvasAssignment,
  CanvasTab,
  CourseSnapshot,
  FolderContents,
} from '../canvas/types';
import { htmlToReadableText } from './format';
import type { IconName } from './Icon';

export type InAppSectionId =
  | 'announcements'
  | 'modules'
  | 'files'
  | 'assignments'
  | 'quizzes'
  | 'discussions'
  | 'grades'
  | 'pages'
  | 'syllabus';

export type CourseSectionNavRow = {
  id: string;
  label: string;
  icon: IconName;
  detail?: string;
  disabled?: boolean;
  external?: boolean;
  a11yLabel: string;
  onPress?: () => void;
};

export function resolveCanvasUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${CANVAS_BASE}${trimmed}`;
  return trimmed;
}

const IN_APP_IDS = new Set<string>([
  'announcements',
  'modules',
  'files',
  'assignments',
  'quizzes',
  'discussions',
  'grades',
  'pages',
  'syllabus',
]);

const LOW_VALUE_INTERNAL_IDS = new Set<string>([
  'people',
  'collaborations',
  'notebook',
  'chat',
  'analytics',
  'new_analytics',
  'conferences',
  'bigbluebutton',
  'outcomes',
  'rubrics',
  'attendance',
  'settings',
]);

const LOW_VALUE_LABEL_PATTERNS = [
  /^people$/i,
  /^collaborations$/i,
  /^notebook$/i,
  /course analytics/i,
  /new analytics/i,
  /igniteai/i,
  /microsoft education/i,
  /microsoft teams/i,
  /student feedback/i,
  /^chat$/i,
];

function isLowValueTab(tab: CanvasTab): boolean {
  const idLower = tab.id.toLowerCase();
  if (LOW_VALUE_INTERNAL_IDS.has(idLower)) return true;
  const label = tab.label.trim();
  return LOW_VALUE_LABEL_PATTERNS.some((re) => re.test(label));
}

function externalTabIcon(tab: CanvasTab): IconName {
  const idLower = tab.id.toLowerCase();
  const label = tab.label.toLowerCase();
  if (idLower === 'people' || label === 'people') return 'people';
  if (label.includes('video') || label.includes('panopto') || label.includes('zoom')) return 'video';
  if (label.includes('reading')) return 'book';
  if (label.includes('chat')) return 'discussion';
  if (label.includes('search')) return 'search';
  return 'externalLink';
}

export function isGradedSubmission(a: CanvasAssignment): boolean {
  const sub = a.submission;
  if (!sub) return false;
  return (
    sub.workflow_state === 'graded' ||
    sub.excused === true ||
    (sub.score !== null && sub.score !== undefined) ||
    (sub.grade !== null && sub.grade !== undefined && sub.grade !== '')
  );
}

export function hasMeaningfulSubmissions(course: CourseSnapshot): boolean {
  return course.assignments.some((a) => {
    const sub = a.submission;
    if (!sub) return false;
    return (
      isGradedSubmission(a) ||
      sub.workflow_state === 'submitted' ||
      sub.workflow_state === 'pending_review' ||
      !!sub.submitted_at ||
      !!sub.missing
    );
  });
}

function makeInAppRow(
  sectionId: InAppSectionId,
  labelOverride: string | undefined,
  course: CourseSnapshot,
  rootFolder: FolderContents | null,
  onNavigate: (section: InAppSectionId) => void,
): CourseSectionNavRow {
  const totalFiles = course.files.length;
  const totalSubfolders = (course.folders ?? []).filter(
    (f) => f.parent_folder_id !== null && !f.hidden,
  ).length;

  switch (sectionId) {
    case 'modules': {
      const count = course.modules?.length ?? 0;
      const label = labelOverride || 'Modules';
      return {
        id: 'modules',
        label,
        icon: 'listModules',
        detail: `${count}`,
        a11yLabel: `Canvas, ${label}, ${count} ${count === 1 ? 'module' : 'modules'}`,
        onPress: () => onNavigate('modules'),
      };
    }
    case 'announcements': {
      const count = course.announcements.length;
      const label = labelOverride || 'Announcements';
      return {
        id: 'announcements',
        label,
        icon: 'announcement',
        detail: `${count}`,
        a11yLabel: `Canvas, ${label}, ${count} ${count === 1 ? 'announcement' : 'announcements'}`,
        onPress: () => onNavigate('announcements'),
      };
    }
    case 'assignments': {
      const count = course.assignments.length;
      const label = labelOverride || 'Assignments';
      return {
        id: 'assignments',
        label,
        icon: 'assignment',
        detail: `${count}`,
        a11yLabel: `Canvas, ${label}, ${count} ${count === 1 ? 'assignment' : 'assignments'}`,
        onPress: () => onNavigate('assignments'),
      };
    }
    case 'quizzes': {
      const count = course.quizzes?.length ?? 0;
      const label = labelOverride || 'Quizzes';
      return {
        id: 'quizzes',
        label,
        icon: 'quiz',
        detail: `${count}`,
        a11yLabel: `Canvas, ${label}, ${count} ${count === 1 ? 'quiz' : 'quizzes'}`,
        onPress: () => onNavigate('quizzes'),
      };
    }
    case 'discussions': {
      const count = course.discussions?.length ?? 0;
      const label = labelOverride || 'Discussions';
      return {
        id: 'discussions',
        label,
        icon: 'discussion',
        detail: `${count}`,
        a11yLabel: `Canvas, ${label}, ${count} ${count === 1 ? 'discussion' : 'discussions'}`,
        onPress: () => onNavigate('discussions'),
      };
    }
    case 'pages': {
      const count = course.pages.length;
      const label = labelOverride || 'Pages';
      return {
        id: 'pages',
        label,
        icon: 'page',
        detail: `${count}`,
        a11yLabel: `Canvas, ${label}, ${count} ${count === 1 ? 'page' : 'pages'}`,
        onPress: () => onNavigate('pages'),
      };
    }
    case 'syllabus': {
      const label = labelOverride || 'Syllabus';
      const hasBody = !!htmlToReadableText(course.syllabusHTML);
      return {
        id: 'syllabus',
        label,
        icon: 'book',
        detail: hasBody ? undefined : 'View in Canvas',
        a11yLabel: `Canvas, ${label}`,
        onPress: () => onNavigate('syllabus'),
      };
    }
    case 'grades': {
      const label = labelOverride || 'Grades';
      const gradedCount = course.assignments.filter(isGradedSubmission).length;
      const detail = gradedCount > 0 ? `${gradedCount} graded` : undefined;
      return {
        id: 'grades',
        label,
        icon: 'grades',
        detail,
        a11yLabel: detail ? `Canvas, ${label}, ${detail}` : `Canvas, ${label}`,
        onPress: () => onNavigate('grades'),
      };
    }
    case 'files': {
      const label = labelOverride || 'Files';
      if (rootFolder !== null) {
        const parts = [
          totalFiles > 0 ? `${totalFiles} ${totalFiles === 1 ? 'file' : 'files'}` : null,
          totalSubfolders > 0
            ? `${totalSubfolders} ${totalSubfolders === 1 ? 'folder' : 'folders'}`
            : null,
        ].filter(Boolean);
        const detail = parts.length > 0 ? parts.join(' · ') : '0';
        return {
          id: 'files',
          label,
          icon: 'folder',
          detail,
          a11yLabel: `Canvas, ${label}, ${detail}`,
          onPress: () => onNavigate('files'),
        };
      }
      if (totalFiles > 0) {
        const detail = `${totalFiles} ${totalFiles === 1 ? 'file' : 'files'}`;
        return {
          id: 'files',
          label,
          icon: 'folder',
          detail,
          a11yLabel: `Canvas, ${label}, ${detail}`,
          onPress: () => onNavigate('files'),
        };
      }
      if (course.folders !== undefined) {
        return {
          id: 'files',
          label,
          icon: 'folder',
          detail: '0',
          a11yLabel: `Canvas, ${label}, empty`,
          onPress: () => onNavigate('files'),
        };
      }
      return {
        id: 'files-locked',
        label,
        icon: 'lock',
        detail: 'Locked in Canvas',
        disabled: true,
        a11yLabel: `Canvas, ${label}, Locked in Canvas`,
      };
    }
  }
}

function makeExternalRow(
  tab: CanvasTab,
  onOpenExternal: (url: string) => void,
): CourseSectionNavRow {
  const url = resolveCanvasUrl(tab.full_url || tab.html_url);
  return {
    id: `tab-${tab.id}`,
    label: tab.label,
    icon: externalTabIcon(tab),
    external: true,
    disabled: !url,
    a11yLabel: `Canvas, ${tab.label}, opens in browser`,
    onPress: url ? () => onOpenExternal(url) : undefined,
  };
}

/**
 * Mirrors the course's Canvas navigation (`course.tabs`) in Canvas order.
 * - Skips Home.
 * - Routes known sections in-app.
 * - Keeps useful external tools (Panopto, Zoom, Course Readings) visible with ↗.
 * - Moves low-value-on-phone tabs into the collapsed "More in Canvas" list.
 * - Still surfaces real content when Canvas hides the corresponding tab (e.g. THE1001 modules).
 * - Falls back to the content-based list when `tabs` is missing (old cache).
 */
export function buildCourseNavigation(
  course: CourseSnapshot,
  rootFolder: FolderContents | null,
  onNavigate: (section: InAppSectionId) => void,
  onOpenExternal: (url: string) => void,
): { primaryRows: CourseSectionNavRow[]; moreRows: CourseSectionNavRow[] } {
  const totalFiles = course.files.length;
  const totalSubfolders = (course.folders ?? []).filter(
    (f) => f.parent_folder_id !== null && !f.hidden,
  ).length;

  const hasContent: Record<InAppSectionId, boolean> = {
    modules: (course.modules?.length ?? 0) > 0,
    announcements: course.announcements.length > 0,
    assignments: course.assignments.length > 0,
    quizzes: (course.quizzes?.length ?? 0) > 0,
    discussions: (course.discussions?.length ?? 0) > 0,
    files: totalFiles > 0 || totalSubfolders > 0,
    pages: course.pages.length > 0,
    syllabus: !!htmlToReadableText(course.syllabusHTML),
    grades: hasMeaningfulSubmissions(course),
  };

  const tabs = course.tabs?.filter((t) => !t.hidden).sort((a, b) => a.position - b.position);

  // Fallback for old caches that don't have `tabs`.
  if (!tabs || tabs.length === 0) {
    const fallbackOrder: InAppSectionId[] = [
      'modules',
      'announcements',
      'assignments',
      'quizzes',
      'discussions',
      'files',
      'pages',
      'syllabus',
      'grades',
    ];
    const primaryRows: CourseSectionNavRow[] = [];
    for (const id of fallbackOrder) {
      if (id === 'files') {
        // Legacy fallback always showed Files (or "Locked in Canvas" if none).
        primaryRows.push(makeInAppRow('files', undefined, course, rootFolder, onNavigate));
      } else if (hasContent[id]) {
        primaryRows.push(makeInAppRow(id, undefined, course, rootFolder, onNavigate));
      }
    }
    return { primaryRows, moreRows: [] };
  }

  const seenSections = new Set<InAppSectionId>();
  const primaryRows: CourseSectionNavRow[] = [];
  const moreRows: CourseSectionNavRow[] = [];

  for (const tab of tabs) {
    const idLower = tab.id.toLowerCase();
    if (idLower === 'home') continue;

    if (IN_APP_IDS.has(idLower)) {
      const sectionId = idLower as InAppSectionId;
      seenSections.add(sectionId);
      primaryRows.push(makeInAppRow(sectionId, tab.label, course, rootFolder, onNavigate));
      continue;
    }

    if (isLowValueTab(tab)) {
      moreRows.push(makeExternalRow(tab, onOpenExternal));
      continue;
    }

    if (tab.type === 'external') {
      primaryRows.push(makeExternalRow(tab, onOpenExternal));
      continue;
    }

    // Any other unrecognized internal Canvas tab goes into "More in Canvas".
    moreRows.push(makeExternalRow(tab, onOpenExternal));
  }

  // Surface real content even when Canvas didn't include a tab for it (e.g. THE1001's 12 modules).
  const missingContentOrder: InAppSectionId[] = [
    'modules',
    'announcements',
    'assignments',
    'quizzes',
    'discussions',
    'files',
    'pages',
    'syllabus',
    'grades',
  ];
  const extraContentRows: CourseSectionNavRow[] = [];
  for (const id of missingContentOrder) {
    if (!seenSections.has(id) && hasContent[id]) {
      extraContentRows.push(makeInAppRow(id, undefined, course, rootFolder, onNavigate));
    }
  }

  if (extraContentRows.length > 0) {
    // Place content-backed sections ahead of trailing external tools so they are immediately visible.
    const firstExternalIdx = primaryRows.findIndex((r) => r.external);
    if (firstExternalIdx === -1) {
      primaryRows.push(...extraContentRows);
    } else {
      primaryRows.splice(firstExternalIdx, 0, ...extraContentRows);
    }
  }

  return { primaryRows, moreRows };
}
