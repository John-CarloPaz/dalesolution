'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/providers/supabase-provider';
import { formatDate, formatTime } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Inbox,
} from 'lucide-react';
import { cn } from 'cn';
import type { Notification } from '@/types/database';

export default function NotificationsPage() {
  const { supabase, user } = useSupabase();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setNotifications(data ?? []);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markAsRead(id: string) {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
  }

  async function markAllAsRead() {
    if (!user) return;

    const unreadIds = notifications
      .filter((n) => !n.read_at)
      .map((n) => n.id);

    if (unreadIds.length === 0) return;

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds);

    setNotifications((prev) =>
      prev.map((n) =>
        unreadIds.includes(n.id)
          ? { ...n, read_at: new Date().toISOString() }
          : n
      )
    );
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <Skeleton className="h-8 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="size-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <BellOff className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No notifications yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => {
                if (!notification.read_at) markAsRead(notification.id);
              }}
              className={cn(
                'w-full text-left transition-colors rounded-xl ring-1 ring-foreground/10',
                !notification.read_at
                  ? 'bg-primary/5 hover:bg-primary/10'
                  : 'bg-card hover:bg-muted/50'
              )}
            >
              <div className="flex gap-3 p-4">
                <div
                  className={cn(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                    !notification.read_at
                      ? 'bg-primary/10'
                      : 'bg-muted'
                  )}
                >
                  {!notification.read_at ? (
                    <Bell className="size-3.5 text-primary" />
                  ) : (
                    <Check className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        'text-sm',
                        !notification.read_at ? 'font-medium' : 'text-foreground'
                      )}
                    >
                      {notification.title}
                    </p>
                    {!notification.read_at && (
                      <span className="mt-1.5 flex size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  {notification.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.body}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {formatDate(notification.created_at)}{' '}
                    {formatTime(notification.created_at)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
