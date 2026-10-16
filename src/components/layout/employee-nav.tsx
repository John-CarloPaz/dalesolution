'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Clock,
  History,
  Calendar,
  BarChart2,
  Bell,
  User,
} from 'lucide-react';
import { cn } from 'cn';
import { useSupabase } from '@/providers/supabase-provider';

const NAV_ITEMS = [
  { href: '/portal', label: 'My Attendance', icon: Clock },
  { href: '/portal/history', label: 'History', icon: History },
  { href: '/portal/schedule', label: 'Schedule', icon: Calendar },
  { href: '/portal/stats', label: 'Stats', icon: BarChart2 },
  { href: '/portal/notifications', label: 'Notifications', icon: Bell },
  { href: '/portal/profile', label: 'Profile', icon: User },
] as const;

export function EmployeeNav() {
  const pathname = usePathname();
  const { supabase, user } = useSupabase();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    async function fetchUnread() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', user!.id)
        .is('read_at', null);

      setUnreadCount(count ?? 0);
    }

    fetchUnread();
  }, [supabase, user]);

  function isActive(href: string) {
    if (href === '/portal') return pathname === '/portal';
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex md:flex-col md:w-60 md:border-r md:bg-card md:min-h-screen">
        <div className="px-4 py-5 border-b">
          <p className="text-sm font-semibold text-foreground tracking-tight">
            DaleSolution Portal
          </p>
        </div>
        <div className="flex flex-col gap-1 p-2 flex-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive(href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
              {href === '/portal/notifications' && unreadCount > 0 && (
                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t bg-card/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative flex flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium transition-colors min-w-[52px]',
              isActive(href)
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            {isActive(href) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary" />
            )}
            <span className="relative">
              <Icon className="size-5" />
              {href === '/portal/notifications' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
