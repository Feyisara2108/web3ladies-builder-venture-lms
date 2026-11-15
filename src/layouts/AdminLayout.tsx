import { LayoutDashboard, Layers, Users, CalendarDays, FolderKanban, Settings, UserRound } from 'lucide-react'
import { AppShell, type NavItem } from '@/layouts/AppShell'

const nav: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Cohorts', to: '/admin/cohorts', icon: Layers },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'Sessions', to: '/admin/sessions', icon: CalendarDays },
  { label: 'Projects', to: '/admin/projects', icon: FolderKanban },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
  { label: 'Profile', to: '/admin/profile', icon: UserRound },
]

export function AdminLayout() {
  return <AppShell nav={nav} />
}
