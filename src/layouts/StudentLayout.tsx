import { LayoutDashboard, UserRound, CalendarDays, FolderKanban, LineChart } from 'lucide-react'
import { AppShell, type NavItem } from '@/layouts/AppShell'

const nav: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Profile', to: '/profile', icon: UserRound },
  { label: 'Sessions', to: '/sessions', icon: CalendarDays },
  { label: 'Project', to: '/workspace', icon: FolderKanban },
  { label: 'Updates', to: '/progress', icon: LineChart },
]

export function StudentLayout() {
  return <AppShell nav={nav} />
}
