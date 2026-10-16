'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Clock,
  Users,
  UsersRound,
  CalendarDays,
  BarChart3,
  FileEdit,
  Building2,
  Zap,
  Bell,
  ScrollText,
  Settings,
  LogOut,
  ChevronsUpDown,
  User,
  Briefcase,
} from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { ROLE_LABELS } from '@/lib/constants/roles';
import { getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Attendance', href: '/attendance', icon: Clock },
  { label: 'Virtual Assistants', href: '/employees', icon: Users },
  { label: 'Clients', href: '/clients', icon: Briefcase },
  { label: 'Teams', href: '/teams', icon: UsersRound },
  { label: 'Schedules', href: '/schedules', icon: CalendarDays },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
] as const;

const MANAGE_ITEMS = [
  { label: 'Corrections', href: '/corrections', icon: FileEdit },
  { label: 'Virtual Office', href: '/virtual-office', icon: Building2 },
  { label: 'Automations', href: '/automations', icon: Zap },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Audit Log', href: '/audit-log', icon: ScrollText },
  { label: 'Settings', href: '/settings', icon: Settings },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useSession();
  const { state } = useSidebar();

  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="DaleSolution">
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                  DS
                </div>
                <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
                  <span className="font-semibold text-sm">DaleSolution</span>
                  <span className="text-xs text-sidebar-foreground/60">
                    Workforce OS
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' &&
                    pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MANAGE_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={profile?.full_name ?? 'Account'}
                  />
                }
              >
                <Avatar size="sm">
                  {profile?.avatar_url && (
                    <AvatarImage
                      src={profile.avatar_url}
                      alt={profile.full_name}
                    />
                  )}
                  <AvatarFallback>
                    {getInitials(profile?.full_name ?? 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
                  <span className="text-sm font-medium truncate">
                    {profile?.full_name ?? 'User'}
                  </span>
                  <span className="text-xs text-sidebar-foreground/60 truncate">
                    {profile?.role ? ROLE_LABELS[profile.role] : 'Employee'}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
              >
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {profile?.full_name}
                    </span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {profile?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem render={<Link href="/settings/profile" />}>
                    <User />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/settings" />}>
                    <Settings />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} variant="destructive">
                  <LogOut />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
