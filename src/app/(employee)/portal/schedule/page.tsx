'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/supabase-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, Coffee, Inbox } from 'lucide-react';
import { cn } from 'cn';
import type { WorkSchedule } from '@/types/database';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export default function SchedulePage() {
  const { supabase, user } = useSupabase();
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchSchedule() {
      // Find active assignment
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

      setLoading(false);
    }

    fetchSchedule();
  }, [supabase, user]);

  const today = new Date().getDay();

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My Schedule</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your assigned work schedule
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No schedule assigned yet
            </p>
            <p className="text-xs text-muted-foreground">
              Contact your manager to get a schedule assigned
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Schedule</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your assigned work schedule
        </p>
      </div>

      {/* Schedule details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-4" />
            {schedule.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Time info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
              <Clock className="size-4 text-emerald-500 mb-1" />
              <p className="text-xs text-muted-foreground">Start</p>
              <p className="text-sm font-medium">
                {schedule.start_time.slice(0, 5)}
              </p>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
              <Clock className="size-4 text-slate-400 mb-1" />
              <p className="text-xs text-muted-foreground">End</p>
              <p className="text-sm font-medium">
                {schedule.end_time.slice(0, 5)}
              </p>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
              <Coffee className="size-4 text-amber-500 mb-1" />
              <p className="text-xs text-muted-foreground">Break</p>
              <p className="text-sm font-medium">
                {schedule.break_duration_minutes}m
              </p>
            </div>
          </div>

          {/* Grace period */}
          {schedule.grace_period_minutes > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Grace period: {schedule.grace_period_minutes} minutes
            </p>
          )}

          {/* Work days */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Work Days</p>
            <div className="flex gap-2 justify-center">
              {DAY_NAMES.map((day, index) => {
                const isWorkDay = schedule.days_of_week.includes(index);
                const isToday = index === today;
                return (
                  <div
                    key={day}
                    className={cn(
                      'flex size-10 items-center justify-center rounded-full text-xs font-medium transition-colors',
                      isWorkDay && !isToday &&
                        'bg-primary/10 text-primary',
                      isWorkDay && isToday &&
                        'bg-primary text-primary-foreground',
                      !isWorkDay &&
                        'bg-muted/50 text-muted-foreground'
                    )}
                  >
                    {day.charAt(0)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full day list */}
          <div className="border-t pt-3 space-y-1.5">
            {DAY_NAMES_FULL.map((day, index) => {
              const isWorkDay = schedule.days_of_week.includes(index);
              const isToday = index === today;
              return (
                <div
                  key={day}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                    isToday && 'bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(isToday && 'font-medium')}>
                      {day}
                    </span>
                    {isToday && (
                      <Badge variant="secondary" className="text-[10px]">
                        Today
                      </Badge>
                    )}
                  </div>
                  {isWorkDay ? (
                    <span className="text-xs text-muted-foreground">
                      {schedule.start_time.slice(0, 5)} &ndash;{' '}
                      {schedule.end_time.slice(0, 5)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Day off
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
