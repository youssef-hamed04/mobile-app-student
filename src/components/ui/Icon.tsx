import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';

import { useTheme } from '@/hooks/use-theme';
import { useLanguageStore } from '@/store/language-store';

/**
 * Curated icon set.
 *
 * Restricting the app to a named subset (rather than the whole Ionicons
 * surface) keeps the visual language consistent and makes an icon swap a
 * one-line change here instead of a repo-wide find-and-replace.
 */
export const ICONS = {
  // navigation
  home: 'home',
  homeOutline: 'home-outline',
  courses: 'library',
  coursesOutline: 'library-outline',
  myCourses: 'bookmarks',
  myCoursesOutline: 'bookmarks-outline',
  search: 'search',
  searchOutline: 'search-outline',
  bell: 'notifications',
  bellOutline: 'notifications-outline',
  person: 'person',
  personOutline: 'person-outline',

  // chrome
  'chevron-left': 'chevron-back',
  'chevron-right': 'chevron-forward',
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up',
  close: 'close',
  menu: 'menu',
  more: 'ellipsis-horizontal',
  filter: 'options-outline',
  sort: 'swap-vertical-outline',
  check: 'checkmark',
  checkCircle: 'checkmark-circle',
  add: 'add',
  refresh: 'refresh',
  external: 'open-outline',
  settings: 'settings-outline',
  logout: 'log-out-outline',
  edit: 'create-outline',
  trash: 'trash-outline',
  camera: 'camera-outline',
  info: 'information-circle-outline',
  warning: 'warning-outline',
  error: 'alert-circle-outline',
  success: 'checkmark-circle-outline',
  help: 'help-circle-outline',

  // domain
  play: 'play',
  playCircle: 'play-circle',
  pause: 'pause',
  replay: 'refresh-circle',
  forward10: 'play-forward',
  back10: 'play-back',
  volume: 'volume-high',
  volumeMute: 'volume-mute',
  fullscreen: 'expand',
  fullscreenExit: 'contract',
  captions: 'text',
  speed: 'speedometer-outline',
  quality: 'options',
  lock: 'lock-closed',
  lockOpen: 'lock-open',
  document: 'document-text-outline',
  pdf: 'document-attach-outline',
  clock: 'time-outline',
  calendar: 'calendar-outline',
  star: 'star',
  starOutline: 'star-outline',
  people: 'people-outline',
  school: 'school-outline',
  teacher: 'person-circle-outline',
  price: 'pricetag-outline',
  code: 'key-outline',
  shield: 'shield-checkmark-outline',
  shieldAlert: 'shield-half-outline',
  device: 'phone-portrait-outline',
  wifiOff: 'cloud-offline-outline',
  moon: 'moon-outline',
  sun: 'sunny-outline',
  language: 'globe-outline',
  phone: 'call-outline',
  whatsapp: 'logo-whatsapp',
  mail: 'mail-outline',
  send: 'send-outline',
  archive: 'archive-outline',
  eye: 'eye-outline',
  eyeOff: 'eye-off-outline',
  download: 'download-outline',
  progress: 'stats-chart-outline',
  flame: 'flame-outline',
  empty: 'file-tray-outline',
} as const satisfies Record<string, React.ComponentProps<typeof Ionicons>['name']>;

export type IconName = keyof typeof ICONS;

/** Icons whose meaning is directional and must mirror in RTL. */
const MIRRORS = new Set<IconName>([
  'chevron-left',
  'chevron-right',
  'forward10',
  'back10',
  'send',
  'logout',
  'external',
]);

/**
 * Transport controls (seek forward/back) are an explicit exception: the video
 * timeline itself is not mirrored, so mirroring the seek buttons would make
 * "forward" point backwards. See src/i18n/direction.ts.
 */
const NEVER_MIRROR = new Set<IconName>(['forward10', 'back10']);

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Opt in to RTL mirroring for directional glyphs. */
  mirror?: boolean;
  className?: string;
}

export function Icon({ name, size = 22, color, mirror = false, className }: IconProps) {
  const { colors } = useTheme();
  const isRTL = useLanguageStore((s) => s.isRTL);

  const shouldMirror =
    isRTL && mirror && MIRRORS.has(name) && !NEVER_MIRROR.has(name);

  return (
    <Ionicons
      name={ICONS[name]}
      size={size}
      color={color ?? colors.foreground}
      className={className}
      style={shouldMirror ? { transform: [{ scaleX: -1 }] } : undefined}
      // Icons are decorative unless the parent gives them a label.
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
