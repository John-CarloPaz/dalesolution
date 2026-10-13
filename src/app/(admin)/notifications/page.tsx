'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from 'cn';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/hooks/use-session';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Clock,
  FileEdit,
  Bell,
  CheckCheck,
  Inbox,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'correction', label: 'Corrections' },
  { value: 'system', label: 'System' },
];

interface Notification {
  id: string;
  org_id: string;
  profile_id: string;
  type: string;
  title: string;
  body: string | null;
  data: unknown;
  read_at: string | null;
  created_at: string;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'attendance':
      return <Clock className="size-5 text-blue-500" />;
    case 'correction':
      return <FileEdit className="size-5 text-amber-500" />;
    case 'system':
      return <Bell className="size-5 text-violet-500" />;
    default:
      return <Bell className="size-5 text-muted-foreground" />;
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="h-3 w-24 shrink-0" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const { orgId, user } = useSession();
  const supabase = createClient();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const fetchNotifications = useCallback(async () => {
    if (!orgId || !user) return;
    setLoading(true);

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('org_id', orgId)
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false });

    if (typeFilter !== 'all') {
      query = query.eq('type', typeFilter);
    }

    const { data } = await query;
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, [orgId, user, typeFilter, supabase]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('Failed to mark notification as read');
      return;
    }

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
  };

  const markAllAsRead = async () => {
    if (!orgId || !user) return;
    setMarkingAll(true);

    const unreadIds = notifications
      .filter((n) => !n.read_at)
      .map((n) => n.id);

    if (unreadIds.length === 0) {
      setMarkingAll(false);
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds);

    if (error) {
      toast.error('Failed to mark all as read');
      setMarkingAll(false);
      return;
    }

    setNotifications((prev) =>
      prev.map((n) =>
        unreadIds.includes(n.id)
          ? { ...n, read_at: new Date().toISOString() }
          : n
      )
    );
    toast.success('All notifications marked as read');
    setMarkingAll(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Stay updated with your organization activity.
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="default" className="h-6 px-2.5">
              {unreadCount} unread
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? 'all')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0 || markingAll}
          >
            <CheckCheck className="size-4 mr-1.5" />
            Mark All Read
          </Button>
        </div>
      </div>

      {/* Notification List */}
      {loading ? (
        <LoadingSkeleton />
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                <Inbox className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No notifications
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                You're all caught up. New notifications will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                'transition-colors cursor-pointer hover:bg-muted/30',
                !notification.read_at && 'border-primary/20 bg-primary/[0.02]'
              )}
              onClick={() => {
                if (!notification.read_at) markAsRead(notification.id);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className={cn(
                        'text-sm',
                        !notification.read_at ? 'font-semibold' : 'font-medium'
                      )}>
                        {notification.title}
                      </p>
                      {/* Unread dot */}
                      {!notification.read_at && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    {notification.body && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/70 mt-1.5">
                      {formatDateTime(notification.created_at)}
                    </p>
                  </div>

                  {/* Read action */}
                  {!notification.read_at && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="shrink-0 text-xs text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
