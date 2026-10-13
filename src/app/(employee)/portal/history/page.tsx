'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/providers/supabase-provider';
import { formatTime, formatDate, formatDuration } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  LogOut,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { cn } from 'cn';
import type { AttendanceSession } from '@/types/database';

export default function HistoryPage() {
  const { supabase, user } = useSupabase();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  });

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('profile_id', user.id)
      .gte('clock_in_at', dateRange.start.toISOString())
      .lte('clock_in_at', dateRange.end.toISOString())
      .order('clock_in_at', { ascending: false });

    setSessions(data ?? []);
    setLoading(false);
  }, [supabase, user, dateRange]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  function shiftRange(days: number) {
    setDateRange((prev) => {
      const start = new Date(prev.start);
      const end = new Date(prev.end);
      start.setDate(start.getDate() + days);
      end.setDate(end.getDate() + days);
      return { start, end };
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Attendance History
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your attendance records
        </p>
      </div>

      {/* Date range controls */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" onClick={() => shiftRange(-30)}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="size-4" />
          <span>
            {formatDate(dateRange.start)} &ndash; {formatDate(dateRange.end)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => shiftRange(30)}
          disabled={dateRange.end >= new Date()}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Sessions list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No attendance records found for this period
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: AttendanceSession }) {
  const clockInDate = new Date(session.clock_in_at);
  const isCompleted = session.state === 'clocked_out';

  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        {/* Date header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{formatDate(clockInDate)}</p>
          <div className="flex items-center gap-2">
            {session.is_late && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="size-2.5 mr-0.5" />
                Late
              </Badge>
            )}
            <Badge
              variant={isCompleted ? 'secondary' : 'outline'}
              className="text-[10px]"
            >
              {session.state === 'clocked_in'
                ? 'In Progress'
                : session.state === 'on_break'
                  ? 'On Break'
                  : 'Completed'}
            </Badge>
          </div>
        </div>

        {/* Time details */}
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-3.5 text-emerald-500" />
            <span>In: {formatTime(session.clock_in_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <LogOut className="size-3.5 text-slate-400" />
            <span>
              Out:{' '}
              {session.clock_out_at
                ? formatTime(session.clock_out_at)
                : '--:--'}
            </span>
          </div>
        </div>

        {/* Totals */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2">
          <span>
            Worked:{' '}
            <span className={cn('font-medium', isCompleted && 'text-foreground')}>
              {session.total_worked_minutes != null
                ? formatDuration(session.total_worked_minutes)
                : '--'}
            </span>
          </span>
          {session.total_break_minutes > 0 && (
            <span>
              Break:{' '}
              <span className="font-medium">
                {formatDuration(session.total_break_minutes)}
              </span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
