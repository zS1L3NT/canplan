import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import React from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

type CrossPlatformSymbol = Exclude<SymbolViewProps['name'], string>;

export type IconName =
  | 'sparkles'
  | 'bell'
  | 'modules'
  | 'calendar'
  | 'today'
  | 'inbox'
  | 'tasks'
  | 'search'
  | 'settings'
  | 'refresh'
  | 'check'
  | 'checkCircle'
  | 'checkCircleFill'
  | 'circle'
  | 'announcement'
  | 'assignment'
  | 'file'
  | 'page'
  | 'folder'
  | 'add'
  | 'close'
  | 'warning'
  | 'edit'
  | 'delete'
  | 'chevronRight'
  | 'chevronDown'
  | 'chevronUp'
  | 'lock'
  | 'eye'
  | 'eyeOff'
  | 'externalLink'
  | 'doneAll'
  | 'clock'
  | 'stack'
  | 'subtask'
  | 'listModules'
  | 'quiz'
  | 'discussion'
  | 'link'
  | 'tool'
  | 'sort'
  | 'copy'
  | 'folderFill'
  | 'filePdf'
  | 'fileSlides'
  | 'fileDoc'
  | 'fileSheet'
  | 'fileImage'
  | 'fileVideo'
  | 'fileZip'
  | 'fileGeneric'
  | 'grades'
  | 'book'
  | 'video'
  | 'more'
  | 'people'
  | 'plusCircle'
  | 'exclamation'
  | 'pin';

const ICON_MAP: Record<IconName, CrossPlatformSymbol> = {
  sparkles: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  modules: { ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  today: { ios: 'sun.max', android: 'wb_sunny', web: 'wb_sunny' },
  inbox: { ios: 'tray', android: 'inbox', web: 'inbox' },
  tasks: { ios: 'checklist', android: 'checklist', web: 'checklist' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  subtask: { ios: 'arrow.turn.down.right', android: 'subdirectory_arrow_right', web: 'subdirectory_arrow_right' },
  stack: { ios: 'square.stack.3d.up', android: 'layers', web: 'layers' },
  checkCircle: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
  checkCircleFill: { ios: 'checkmark.circle.fill', android: 'task_alt', web: 'task_alt' },
  circle: { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' },
  announcement: { ios: 'megaphone', android: 'campaign', web: 'campaign' },
  assignment: { ios: 'doc.text', android: 'assignment', web: 'assignment' },
  file: { ios: 'paperclip', android: 'attach_file', web: 'attach_file' },
  page: { ios: 'doc.richtext', android: 'article', web: 'article' },
  folder: { ios: 'folder', android: 'folder', web: 'folder' },
  folderFill: { ios: 'folder.fill', android: 'folder', web: 'folder' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  delete: { ios: 'trash', android: 'delete', web: 'delete' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  chevronUp: { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  externalLink: { ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' },
  doneAll: { ios: 'checkmark.circle', android: 'done_all', web: 'done_all' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  listModules: { ios: 'list.bullet.rectangle', android: 'view_list', web: 'view_list' },
  quiz: { ios: 'questionmark.circle', android: 'quiz', web: 'quiz' },
  discussion: { ios: 'bubble.left.and.bubble.right', android: 'forum', web: 'forum' },
  link: { ios: 'link', android: 'link', web: 'link' },
  tool: { ios: 'wrench.and.screwdriver', android: 'extension', web: 'extension' },
  sort: { ios: 'arrow.up.arrow.down', android: 'sort', web: 'sort' },
  copy: { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' },
  filePdf: { ios: 'doc.richtext', android: 'picture_as_pdf', web: 'picture_as_pdf' },
  fileSlides: { ios: 'rectangle.stack', android: 'slideshow', web: 'slideshow' },
  fileDoc: { ios: 'doc.text', android: 'description', web: 'description' },
  fileSheet: { ios: 'tablecells', android: 'table_chart', web: 'table_chart' },
  fileImage: { ios: 'photo', android: 'image', web: 'image' },
  fileVideo: { ios: 'play.rectangle', android: 'movie', web: 'movie' },
  fileZip: { ios: 'doc.zipper', android: 'folder_zip', web: 'folder_zip' },
  fileGeneric: { ios: 'doc', android: 'insert_drive_file', web: 'insert_drive_file' },
  grades: { ios: 'graduationcap', android: 'school', web: 'school' },
  book: { ios: 'book', android: 'menu_book', web: 'menu_book' },
  video: { ios: 'video', android: 'videocam', web: 'videocam' },
  more: { ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' },
  people: { ios: 'person.2', android: 'group', web: 'group' },
  plusCircle: { ios: 'plus.circle', android: 'add_circle_outline', web: 'add_circle_outline' },
  exclamation: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' },
  pin: { ios: 'pin.fill', android: 'push_pin', web: 'push_pin' },
};

export function Icon({
  name,
  size = 20,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SymbolView
      name={ICON_MAP[name]}
      size={size}
      tintColor={color}
      resizeMode="scaleAspectFit"
      style={[{ width: size, height: size }, style]}
    />
  );
}
