import { LayoutDashboard, Users, CalendarDays, MessageSquareText, UserRound } from 'lucide-react'
import { AppShell, type NavItem } from '@/layouts/AppShell'

const nav: NavItem[] = [
  { label: 'Dashboard', to: '/mentor', icon: LayoutDashboard, end: true },
  { label: 'Students', to: '/mentor/students', icon: Users },
  { label: 'Sessions', to: '/mentor/sessions', icon: CalendarDays },
  { label: 'Reviews', to: '/mentor/reviews', icon: MessageSquareText },
  { label: 'Profile', to: '/mentor/profile', icon: UserRound },
]

export function MentorLayout() {
  return <AppShell nav={nav} />
}
