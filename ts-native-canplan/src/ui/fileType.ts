import { TurboModuleRegistry, type TurboModule } from 'react-native';
import type { IconName } from './Icon';

export type FileCategory = 'pdf' | 'slides' | 'doc' | 'sheet' | 'image' | 'video' | 'zip' | 'other';

export type FileTypeInfo = {
  category: FileCategory;
  label: string;
  icon: IconName;
};

const EXT_MAP: Record<string, FileCategory> = {
  pdf: 'pdf',
  ppt: 'slides',
  pptx: 'slides',
  key: 'slides',
  odp: 'slides',
  doc: 'doc',
  docx: 'doc',
  rtf: 'doc',
  txt: 'doc',
  md: 'doc',
  odt: 'doc',
  pages: 'doc',
  xls: 'sheet',
  xlsx: 'sheet',
  csv: 'sheet',
  tsv: 'sheet',
  numbers: 'sheet',
  ods: 'sheet',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  heic: 'image',
  bmp: 'image',
  mp4: 'video',
  mov: 'video',
  mkv: 'video',
  avi: 'video',
  webm: 'video',
  m4v: 'video',
  zip: 'zip',
  tar: 'zip',
  gz: 'zip',
  tgz: 'zip',
  '7z': 'zip',
  rar: 'zip',
  bz2: 'zip',
};

const CATEGORY_INFO: Record<FileCategory, FileTypeInfo> = {
  pdf: { category: 'pdf', label: 'PDF', icon: 'filePdf' },
  slides: { category: 'slides', label: 'Slides', icon: 'fileSlides' },
  doc: { category: 'doc', label: 'Document', icon: 'fileDoc' },
  sheet: { category: 'sheet', label: 'Spreadsheet', icon: 'fileSheet' },
  image: { category: 'image', label: 'Image', icon: 'fileImage' },
  video: { category: 'video', label: 'Video', icon: 'fileVideo' },
  zip: { category: 'zip', label: 'Archive', icon: 'fileZip' },
  other: { category: 'other', label: 'File', icon: 'fileGeneric' },
};

export function getFileTypeInfo(name?: string, contentType?: string): FileTypeInfo {
  const lowerName = (name ?? '').trim().toLowerCase();
  const dot = lowerName.lastIndexOf('.');
  if (dot > 0 && dot < lowerName.length - 1) {
    const ext = lowerName.slice(dot + 1);
    const byExt = EXT_MAP[ext];
    if (byExt) return CATEGORY_INFO[byExt];
  }

  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('pdf')) return CATEGORY_INFO.pdf;
  if (ct.includes('presentation') || ct.includes('powerpoint')) return CATEGORY_INFO.slides;
  if (ct.includes('spreadsheet') || ct.includes('excel') || ct.includes('csv')) {
    return CATEGORY_INFO.sheet;
  }
  if (ct.includes('word') || ct.includes('msword') || ct.startsWith('text/')) {
    return CATEGORY_INFO.doc;
  }
  if (ct.startsWith('image/')) return CATEGORY_INFO.image;
  if (ct.startsWith('video/')) return CATEGORY_INFO.video;
  if (
    ct.includes('zip') ||
    ct.includes('compressed') ||
    ct.includes('archive') ||
    ct.includes('tar') ||
    ct.includes('gzip')
  ) {
    return CATEGORY_INFO.zip;
  }

  return CATEGORY_INFO.other;
}

interface ClipboardSpec extends TurboModule {
  setString(content: string): void;
}

/**
 * Writes text to the native pasteboard via RN's built-in Clipboard TurboModule
 * without adding a new native dependency or triggering the deprecated JS getter warning.
 */
export function copyToClipboard(text: string): boolean {
  try {
    const mod = TurboModuleRegistry.get<ClipboardSpec>('Clipboard');
    if (mod && typeof mod.setString === 'function') {
      mod.setString(text);
      return true;
    }
  } catch {
    // Ignore if unavailable (e.g. web or test runtime).
  }
  return false;
}
