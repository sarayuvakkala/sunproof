import type { CSSProperties } from 'react'
import {
  IconAlertTriangle, IconArrowRight, IconBrush, IconBulb, IconCalendar, IconChartLine, IconCheck,
  IconChevronDown, IconChevronLeft, IconChevronRight, IconCircleCheck, IconClock, IconCloudRain,
  IconCopy, IconDatabase, IconEyeOff, IconFileText, IconHome, IconLeaf, IconMail,
  IconMessageCircle, IconPlayerPause, IconPlayerPlay, IconPropeller, IconRefresh, IconSearch,
  IconShare, IconSun, IconTarget, IconTool, IconUser, IconUsers, IconDroplet, IconBriefcase, IconArrowsExchange, IconLock, IconX, IconPhone, IconCar, IconNavigation,
} from '@tabler/icons-react'

const ICONS = {
  'alert-triangle': IconAlertTriangle, 'arrow-right': IconArrowRight, brush: IconBrush, bulb: IconBulb,
  calendar: IconCalendar, 'chart-line': IconChartLine, check: IconCheck, 'chevron-down': IconChevronDown,
  'chevron-left': IconChevronLeft, 'chevron-right': IconChevronRight, 'circle-check': IconCircleCheck,
  clock: IconClock, 'cloud-rain': IconCloudRain, copy: IconCopy, database: IconDatabase,
  'eye-off': IconEyeOff, 'file-text': IconFileText, home: IconHome, leaf: IconLeaf, mail: IconMail,
  'message-circle': IconMessageCircle, 'player-pause': IconPlayerPause, 'player-play': IconPlayerPlay,
  propeller: IconPropeller, refresh: IconRefresh, search: IconSearch, share: IconShare, sun: IconSun,
  target: IconTarget, tool: IconTool, user: IconUser, users: IconUsers, droplet: IconDroplet,
  briefcase: IconBriefcase, swap: IconArrowsExchange, lock: IconLock, x: IconX, phone: IconPhone, car: IconCar, nav: IconNavigation,
} as const

export type IconName = keyof typeof ICONS

export function Ic({ n, size = 18, color, style, className }: {
  n: IconName
  size?: number
  color?: string
  style?: CSSProperties
  className?: string
}) {
  const C = ICONS[n]
  return <C size={size} stroke={2} color={color} style={{ flex: '0 0 auto', display: 'inline-block', ...style }} className={className} aria-hidden />
}
