export type DesignVariant = 'neon' | 'astra' | 'opus';

export type RowContext = 'tasks' | 'course' | 'goal' | 'search' | 'updates';

export type GroupPosition = 'single' | 'first' | 'middle' | 'last' | 'grouped';

export function rowPosition(index: number, total: number): GroupPosition {
  if (total <= 1) return 'single';
  if (index === 0) return 'first';
  if (index === total - 1) return 'last';
  return 'middle';
}

export type VariantSpec = {
  id: DesignVariant;
  label: string;
  /** Vertical padding inside each list row. */
  rowPaddingV: number;
  /** Row title font size & line height. */
  titleSize: number;
  titleLineHeight: number;
  /** Date placement on TaskRow & CanvasRow. */
  datePlacement: 'line1Right' | 'line2Inline';
  /** Date font size when right-aligned on line 1. */
  line1DateSize: number;
  /** Whether Canvas groups use tinted canvasSurface (neon) vs white surface (astra/opus). */
  tintCanvasSurface: boolean;
  /** Leading kind icon style on Canvas rows. */
  canvasIconMode: 'tile30' | 'plain20' | 'tile28';
  /** Leading separator inset (aligns hairline to text). */
  taskSeparatorInset: number;
  canvasSeparatorInset: number;
  /** Trailing convert/linked button icons on Canvas rows. */
  canvasAddIcon: 'add' | 'plusCircle';
  canvasLinkedIcon: 'checkCircleFill' | 'link';
  /** Overdue & override glyphs (opus uses glyphs instead of words). */
  useStatusGlyphs: boolean;
  /** Goal header style. */
  goalHeaderStyle: 'bar' | 'prepared' | 'ring';
  /** Course card unread badge style. */
  courseUnreadStyle: 'text' | 'capsule';
  /** Section header typography & spacing. */
  sectionHeader: {
    fontSize: number;
    lineHeight: number;
    fontWeight: '500' | '600';
    uppercase: boolean;
    letterSpacing: number;
    paddingTop: number;
    paddingBottom: number;
  };
};

/** The one row/list design (the owner removed the variant switch). */
export const SPEC: VariantSpec = {
    id: 'opus',
    label: 'Opus',
    rowPaddingV: 11,
    titleSize: 15,
    titleLineHeight: 21,
    datePlacement: 'line1Right',
    line1DateSize: 15,
    tintCanvasSurface: false,
    canvasIconMode: 'tile28',
    taskSeparatorInset: 46,
    canvasSeparatorInset: 52,
    canvasAddIcon: 'plusCircle',
    canvasLinkedIcon: 'checkCircleFill',
    useStatusGlyphs: true,
    goalHeaderStyle: 'ring',
    courseUnreadStyle: 'capsule',
    sectionHeader: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '600',
      uppercase: false,
      letterSpacing: -0.1,
      paddingTop: 18,
      paddingBottom: 6,
    },
  };
