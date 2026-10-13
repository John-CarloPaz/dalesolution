'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useClock } from '@/hooks/use-clock';
import { useSupabase } from '@/providers/supabase-provider';
import { ATTENDANCE_STATE_LABELS } from '@/lib/constants/attendance-states';
import { formatTime, formatDuration, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  Coffee,
  LogOut,
  CheckCircle2,
  Loader2,
  Play,
  Pause,
  Timer,
} from 'lucide-react';
import { cn } from 'cn';
import type { AttendanceBreak, WorkSchedule } from '@/types/database';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.round((Date.now() - new Date(startTime).getTime()) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.round((Date.now() - new Date(startTime).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  return (
    <span className="font-mono tabular-nums text-3xl font-bold tracking-tight">
      {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:
      {String(seconds).padStart(2, '0')}
    </span>
  );
}

export default function PortalPage() {
  const {
    activeSession,
    activeBreak,
    attendanceState,
    loading,
    error,
    actionLoading,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
  } = useClock();

  const { supabase, user, profile } = useSupabase();
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [todayBreaks, setTodayBreaks] = useState<AttendanceBreak[]>([]);
  const [todayCompleted, setTodayCompleted] = useState<{
    totalWorked: number | null;
    totalBreak: number;
    clockIn: string | null;
    clockOut: string | null;
  } | null>(null);

  const firstName = useMemo(() => {
    if (!profile?.full_name) return 'there';
    return profile.full_name.split(' ')[0];
  }, [profile]);

  // Fetch assigned schedule
  useEffect(() => {
    if (!user) return;

    async function fetchSchedule() {
      const { data: assignment } = await supabase
        .from('schedule_assignments')
        .select('schedule_id')
        .eq('profile_id', user!.id)
        .is('effective_until', null)
        .limit(1)
        .maybeSingle();

      if (assignment) {
        const { data: sched } = await supabase
          .from('work_schedules')
          .select('*')
          .eq('id', assignment.schedule_id)
          .single();
        setSchedule(sched);
      }
    }

    fetchSchedule();
  }, [supabase, user]);

  // Fetch today's breaks for the timeline
  useEffect(() => {
    if (!activeSession) {
      setTodayBreaks([]);
      return;
    }

    async function fetchBreaks() {
      const { data } = await supabase
        .from('attendance_breaks')
        .select('*')
        .eq('session_id', activeSession!.id)
        .order('start_at', { ascending: true });
      setTodayBreaks(data ?? []);
    }

    fetchBreaks();
  }, [supabase, activeSession, attendanceState]);

  // Check if there was a completed session today (for clocked_out state)
  useEffect(() => {
    if (!user || attendanceState !== 'not_started') {
      setTodayCompleted(null);
      return;
    }

    async function fetchCompleted() {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('profile_id', user!.id)
        .eq('state', 'clocked_out')
        .gte('clock_in_at', todayStart.toISOString())
        .order('clock_out_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setTodayCompleted({
          totalWorked: data.total_worked_minutes,
          totalBreak: data.total_break_minutes,
          clockIn: data.clock_in_at,
          clockOut: data.clock_out_at,
        });
      }
    }

    fetchCompleted();
  }, [supabase, user, attendanceState]);

  const handleClockIn = useCallback(() => clockIn(), [clockIn]);
  const handleStartBreak = useCallback(() => startBreak(), [startBreak]);
  const handleEndBreak = useCallback(() => endBreak(), [endBreak]);
  const handleClockOut = useCallback(() => clockOut(), [clockOut]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {formatDate(new Date())}
          {schedule && (
            <span>
              {' '}&middot; Shift: {schedule.start_time.slice(0, 5)} &ndash;{' '}
              {schedule.end_time.slice(0, 5)}
            </span>
          )}
        </p>
      </div>

      {/* Status + Action Card */}
      <Card>
        <CardContent className="flex flex-col items-center py-8 gap-6">
          {/* Current state badge */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium',
              attendanceState === 'not_started' && !todayCompleted &&
                'bg-muted text-muted-foreground',
              attendanceState === 'not_started' && todayCompleted &&
                'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              attendanceState === 'clocked_in' &&
                'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              attendanceState === 'on_break' &&
                'bg-amber-500/10 text-amber-600 dark:text-amber-400',
            )}
          >
            {attendanceState === 'clocked_in' && <Play className="size-3.5" />}
            {attendanceState === 'on_break' && <Pause className="size-3.5" />}
            {attendanceState === 'not_started' && todayCompleted && (
              <CheckCircle2 className="size-3.5" />
            )}
            {attendanceState === 'not_started' && todayCompleted
              ? 'Completed'
              : ATTENDANCE_STATE_LABELS[attendanceState]}
          </div>

          {/* Live timer */}
          {activeSession && (
            <div className="flex flex-col items-center gap-1">
              <LiveTimer startTime={activeSession.clock_in_at} />
              <p className="text-xs text-muted-foreground">Total session time</p>
            </div>
          )}

          {/* Completed summary */}
          {attendanceState === 'not_started' && todayCompleted && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-bold tracking-tight">
                {todayCompleted.totalWorked != null
                  ? formatDuration(todayCompleted.totalWorked)
                  : '--'}
              </span>
              <p className="text-xs text-muted-foreground">Total worked today</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            {/* Clock In */}
            {attendanceState === 'not_started' && !todayCompleted && (
              <button
                onClick={handleClockIn}
                disabled={actionLoading}
                className={cn(
                  'relative flex items-center justify-center gap-2 rounded-2xl px-10 py-4 text-lg font-semibold text-white transition-all',
                  'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97]',
                  'disabled:opacity-50 disabled:pointer-events-none',
                  'w-full',
                  !actionLoading && 'ring-4 ring-emerald-500/20 animate-pulse'
                )}
              >
                {actionLoading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Clock className="size-5" />
                )}
                Clock In
              </button>
            )}

            {/* Clock In again after completion */}
            {attendanceState === 'not_started' && todayCompleted && (
              <Button
                onClick={handleClockIn}
                disabled={actionLoading}
                className="w-full h-11"
                variant="outline"
              >
                {actionLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Clock className="size-4" />
                )}
                Clock In Again
              </Button>
            )}

            {/* Break / Clock Out buttons */}
            {attendanceState === 'clocked_in' && (
              <>
                <button
                  onClick={handleStartBreak}
                  disabled={actionLoading}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-2xl px-10 py-4 text-lg font-semibold text-white transition-all w-full',
                    'bg-amber-500 hover:bg-amber-600 active:scale-[0.97]',
                    'disabled:opacity-50 disabled:pointer-events-none'
                  )}
                >
                  {actionLoading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Coffee className="size-5" />
                  )}
                  Start Break
                </button>

                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="destructive"
                        className="w-full h-11"
                        disabled={actionLoading}
                      />
                    }
                  >
                    <LogOut className="size-4" />
                    Clock Out
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clock Out?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will end your current work session. This action cannot be
                        undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClockOut}
                        variant="destructive"
                      >
                        Yes, Clock Out
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {/* End Break */}
            {attendanceState === 'on_break' && (
              <button
                onClick={handleEndBreak}
                disabled={actionLoading}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-2xl px-10 py-4 text-lg font-semibold text-white transition-all w-full',
                  'bg-blue-600 hover:bg-blue-700 active:scale-[0.97]',
                  'disabled:opacity-50 disabled:pointer-events-none'
                )}
              >
                {actionLoading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Play className="size-5" />
                )}
                End Break
              </button>
            )}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Status details */}
      {activeSession && (
        <div className="grid grid-cols-2 gap-3">
          <Card size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Clocked in</p>
                <p className="text-sm font-medium">
                  {formatTime(activeSession.clock_in_at)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10">
                <Coffee className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Break time</p>
                <p className="text-sm font-medium">
                  {formatDuration(activeSession.total_break_minutes)}
                </p>
              </div>
            </CardContent>
          </Card>

          {schedule && (
            <>
              <Card size="sm">
                <CardContent className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10">
                    <Timer className="size-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Shift start</p>
                    <p className="text-sm font-medium">
                      {schedule.start_time.slice(0, 5)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card size="sm">
                <CardContent className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-slate-500/10">
                    <Timer className="size-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Shift end</p>
                    <p className="text-sm font-medium">
                      {schedule.end_time.slice(0, 5)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Completed summary cards */}
      {attendanceState === 'not_started' && todayCompleted && (
        <div className="grid grid-cols-2 gap-3">
          <Card size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Clocked in</p>
                <p className="text-sm font-medium">
                  {formatTime(todayCompleted.clockIn!)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-slate-500/10">
                <LogOut className="size-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Clocked out</p>
                <p className="text-sm font-medium">
                  {formatTime(todayCompleted.clockOut!)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Today's Timeline */}
      {activeSession && todayBreaks.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-sm font-medium mb-4">Today&apos;s Timeline</h2>
            <div className="relative space-y-0">
              {/* Vertical line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              {/* Clock in event */}
              <TimelineEvent
                icon={<Clock className="size-3 text-emerald-600 dark:text-emerald-400" />}
                iconBg="bg-emerald-500/10"
                label="Clocked In"
                time={formatTime(activeSession.clock_in_at)}
              />

              {/* Break events */}
              {todayBreaks.map((brk) => (
                <div key={brk.id}>
                  <TimelineEvent
                    icon={<Coffee className="size-3 text-amber-600 dark:text-amber-400" />}
                    iconBg="bg-amber-500/10"
                    label={`Break (${brk.break_type})`}
                    time={formatTime(brk.start_at)}
                  />
                  {brk.end_at && (
                    <TimelineEvent
                      icon={<Play className="size-3 text-blue-600 dark:text-blue-400" />}
                      iconBg="bg-blue-500/10"
                      label="Resumed Work"
                      time={formatTime(brk.end_at)}
                      detail={
                        brk.duration_minutes != null
                          ? `${brk.duration_minutes}m break`
                          : undefined
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TimelineEvent({
  icon,
  iconBg,
  label,
  time,
  detail,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  time: string;
  detail?: string;
}) {
  return (
    <div className="relative flex items-center gap-3 py-2">
      <div
        className={cn(
          'relative z-10 flex size-[30px] items-center justify-center rounded-full',
          iconBg
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && (
          <p className="text-xs text-muted-foreground">{detail}</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">{time}</p>
    </div>
  );
}
