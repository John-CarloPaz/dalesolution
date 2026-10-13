'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/supabase-provider';
import { formatDuration } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  CheckCircle2,
  TrendingUp,
  Flame,
  Timer,
  CalendarCheck,
} from 'lucide-react';
import { cn } from 'cn';

interface Stats {
  totalCheckInsMonth: number;
  onTimePercentage: number;
  avgHoursPerDay: number;
  totalHoursWeek: number;
  totalHoursMonth: number;
  streak: number;
}

export default function StatsPage() {
  const { supabase, user } = useSupabase();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchStats() {
      const now = new Date();

      // Start of current month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Start of current week (Monday)
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
      weekStart.setHours(0, 0, 0, 0);

      // Fetch this month's completed sessions
      const { data: monthSessions } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('profile_id', user!.id)
        .eq('state', 'clocked_out')
        .gte('clock_in_at', monthStart.toISOString())
        .order('clock_in_at', { ascending: false });

      const sessions = monthSessions ?? [];

      // Total check-ins this month
      const totalCheckInsMonth = sessions.length;

      // On-time percentage
      const lateSessions = sessions.filter((s) => s.is_late).length;
      const onTimePercentage =
        totalCheckInsMonth > 0
          ? Math.round(((totalCheckInsMonth - lateSessions) / totalCheckInsMonth) * 100)
          : 0;

      // Average hours per day
      const totalWorkedMinutes = sessions.reduce(
        (sum, s) => sum + (s.total_worked_minutes ?? 0),
        0
      );
      const uniqueDays = new Set(
        sessions.map((s) =>
          new Date(s.clock_in_at).toLocaleDateString()
        )
      ).size;
      const avgHoursPerDay =
        uniqueDays > 0
          ? Math.round((totalWorkedMinutes / uniqueDays / 60) * 10) / 10
          : 0;

      // Total hours this week
      const weekSessions = sessions.filter(
        (s) => new Date(s.clock_in_at) >= weekStart
      );
      const totalHoursWeek = Math.round(
        weekSessions.reduce(
          (sum, s) => sum + (s.total_worked_minutes ?? 0),
          0
        ) / 60 * 10
      ) / 10;

      // Total hours this month
      const totalHoursMonth = Math.round((totalWorkedMinutes / 60) * 10) / 10;

      // Attendance streak: consecutive calendar days with at least one session
      // Look back from today
      let streak = 0;

      // Fetch recent sessions for streak (last 90 days)
      const streakStart = new Date();
      streakStart.setDate(streakStart.getDate() - 90);
      const { data: recentSessions } = await supabase
        .from('attendance_sessions')
        .select('clock_in_at')
        .eq('profile_id', user!.id)
        .eq('state', 'clocked_out')
        .gte('clock_in_at', streakStart.toISOString())
        .order('clock_in_at', { ascending: false });

      if (recentSessions && recentSessions.length > 0) {
        const sessionDays = new Set(
          recentSessions.map((s) => {
            const d = new Date(s.clock_in_at);
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          })
        );

        const checkDate = new Date();
        checkDate.setHours(0, 0, 0, 0);

        // If today has no session yet, start from yesterday
        const todayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
        if (!sessionDays.has(todayKey)) {
          checkDate.setDate(checkDate.getDate() - 1);
        }

        while (true) {
          const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
          if (sessionDays.has(key)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      setStats({
        totalCheckInsMonth,
        onTimePercentage,
        avgHoursPerDay,
        totalHoursWeek,
        totalHoursMonth,
        streak,
      });
      setLoading(false);
    }

    fetchStats();
  }, [supabase, user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Check-ins This Month',
      value: String(stats?.totalCheckInsMonth ?? 0),
      icon: CalendarCheck,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10',
    },
    {
      label: 'On-Time Rate',
      value: `${stats?.onTimePercentage ?? 0}%`,
      icon: CheckCircle2,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-500/10',
    },
    {
      label: 'Avg Hours / Day',
      value: `${stats?.avgHoursPerDay ?? 0}h`,
      icon: TrendingUp,
      iconColor: 'text-violet-600 dark:text-violet-400',
      iconBg: 'bg-violet-500/10',
    },
    {
      label: 'Hours This Week',
      value: `${stats?.totalHoursWeek ?? 0}h`,
      icon: Clock,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-500/10',
    },
    {
      label: 'Hours This Month',
      value: `${stats?.totalHoursMonth ?? 0}h`,
      icon: Timer,
      iconColor: 'text-sky-600 dark:text-sky-400',
      iconBg: 'bg-sky-500/10',
    },
    {
      label: 'Day Streak',
      value: String(stats?.streak ?? 0),
      icon: Flame,
      iconColor: 'text-orange-600 dark:text-orange-400',
      iconBg: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Stats</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your personal attendance statistics
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {statCards.map((card) => (
          <Card key={card.label} size="sm">
            <CardContent className="flex flex-col gap-3 py-4">
              <div
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg',
                  card.iconBg
                )}
              >
                <card.icon className={cn('size-4', card.iconColor)} />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {card.label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
