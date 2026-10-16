'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  User,
} from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/providers/theme-provider';
import { getInitials } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/constants/roles';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';

const PATH_LABELS: Record<string, string> = {
  dashboard: 'Overview',
  attendance: 'Attendance',
  employees: 'Virtual Assistants',
  clients: 'Clients',
  teams: 'Teams',
  schedules: 'Schedules',
  analytics: 'Analytics',
  corrections: 'Corrections',
  'virtual-office': 'Virtual Office',
  automations: 'Automations',
  notifications: 'Notifications',
  'audit-log': 'Audit Log',
  settings: 'Settings',
  profile: 'Profile',
};

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-sm">
      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        Home
      </Link>
      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/');
        const label = PATH_LABELS[segment] ?? segment;
        const isLast = index === segments.length - 1;

        return (
          <span key={href} className="flex items-center gap-1.5">
            <span className="text-muted-foreground/40">/</span>
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link
                href={href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function AdminTopbar() {
  const { profile, signOut } = useSession();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur-sm px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />

      <Breadcrumb />

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="w-56 pl-8 h-8 bg-muted/50 border-none"
          />
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() =>
            setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
          }
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          render={<Link href="/notifications" />}
        >
          <Bell className="size-4" />
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            3
          </span>
        </Button>

        <Separator orientation="vertical" className="h-5 hidden sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
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
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" sideOffset={8}>
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
      </div>
    </header>
  );
}
