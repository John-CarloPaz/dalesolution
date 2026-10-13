'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/hooks/use-session';
import { formatDuration, getInitials } from '@/lib/utils';
import {
  BarChart3,
  Clock,
  TrendingUp,
  Users,
  CalendarDays,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DateRange = 7 | 30 | 90;

interface AttendanceSession {
  id: string;
  org_id: string;
  profile_id: string;
  state: 'clocked_in' | 'on_break' | 'clocked_out';
  clock_in_at: string;
  clock_out_at: string | null;
  total_break_minutes: number;
  total_worked_minutes: number | null;
  is_late: boolean;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  position: string | null;
}

interface Team {
  id: string;
  name: string;
  color: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  profile_id: string;
}

// Computed types for chart data
interface DailyAttendance {
  date: string;
  label: string;
  rate: number;
  total: number;
}

interface DailyOnTime {
  date: string;
  label: string;
  onTime: number;
  late: number;
}

interface HoursBucket {
  range: string;
  count: number;
  color: string;
}

interface TeamAvg {
  name: string;
  avgHours: number;
  color: string;
}

interface EmployeeStat {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  daysPresent: number;
  avgHours: number;
  onTimeRate: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_COLORS = {
  emerald: '#10b981',
  amber: '#f59e0b',
  indigo: '#6366f1',
  slate: '#64748b',
  violet: '#8b5cf6',
};

const RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'Last 7 Days', value: 7 },
  { label: 'Last 30 Days', value: 30 },
  { label: 'Last 90 Days', value: 90 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRangeStart(days: DateRange): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold">
            {typeof entry.value === 'number'
              ? entry.value % 1 !== 0
                ? entry.value.toFixed(1)
                : entry.value
              : entry.value}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
          <Skeleton className="size-10 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCardSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

function LeaderboardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Top Employees by Attendance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-4 w-6" />
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Data processing
// ---------------------------------------------------------------------------

function processData(
  sessions: AttendanceSession[],
  profiles: Profile[],
  teams: Team[],
  teamMembers: TeamMember[],
  range: DateRange,
  totalEmployees: number
) {
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const profileTeamMap = new Map(teamMembers.map((tm) => [tm.profile_id, tm.team_id]));

  // Build daily buckets
  const dailyMap = new Map<
    string,
    { profiles: Set<string>; onTime: number; late: number }
  >();
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { profiles: new Set(), onTime: 0, late: 0 });
  }

  // Per-employee aggregation
  const employeeMap = new Map<
    string,
    { days: Set<string>; totalMinutes: number; sessions: number; onTime: number }
  >();

  // Team aggregation
  const teamSessionMap = new Map<string, { totalMinutes: number; count: number }>();

  // Hours buckets
  const hoursBuckets = [0, 0, 0, 0]; // 0-4, 4-6, 6-8, 8+

  for (const session of sessions) {
    const dk = dayKey(session.clock_in_at);
    const daily = dailyMap.get(dk);
    if (daily) {
      daily.profiles.add(session.profile_id);
      if (session.is_late) {
        daily.late++;
      } else {
        daily.onTime++;
      }
    }

    // Employee stats
    let emp = employeeMap.get(session.profile_id);
    if (!emp) {
      emp = { days: new Set(), totalMinutes: 0, sessions: 0, onTime: 0 };
      employeeMap.set(session.profile_id, emp);
    }
    emp.days.add(dk);
    emp.sessions++;
    if (!session.is_late) emp.onTime++;
    const worked = session.total_worked_minutes ?? 0;
    emp.totalMinutes += worked;

    // Hours distribution
    const hours = worked / 60;
    if (hours < 4) hoursBuckets[0]++;
    else if (hours < 6) hoursBuckets[1]++;
    else if (hours < 8) hoursBuckets[2]++;
    else hoursBuckets[3]++;

    // Team aggregation
    const teamId = profileTeamMap.get(session.profile_id);
    if (teamId) {
      let ts = teamSessionMap.get(teamId);
      if (!ts) {
        ts = { totalMinutes: 0, count: 0 };
        teamSessionMap.set(teamId, ts);
      }
      ts.totalMinutes += worked;
      ts.count++;
    }
  }

  // Build chart arrays
  const dailyAttendance: DailyAttendance[] = [];
  const dailyOnTime: DailyOnTime[] = [];
  for (const [date, data] of dailyMap) {
    const label = formatShortDate(date);
    const rate = totalEmployees > 0
      ? Math.round((data.profiles.size / totalEmployees) * 100)
      : 0;
    dailyAttendance.push({ date, label, rate, total: data.profiles.size });
    dailyOnTime.push({ date, label, onTime: data.onTime, late: data.late });
  }

  const hoursDistribution: HoursBucket[] = [
    { range: '0-4h', count: hoursBuckets[0], color: CHART_COLORS.slate },
    { range: '4-6h', count: hoursBuckets[1], color: CHART_COLORS.amber },
    { range: '6-8h', count: hoursBuckets[2], color: CHART_COLORS.indigo },
    { range: '8+h', count: hoursBuckets[3], color: CHART_COLORS.emerald },
  ];

  const teamColors = [
    CHART_COLORS.emerald,
    CHART_COLORS.indigo,
    CHART_COLORS.amber,
    CHART_COLORS.violet,
    CHART_COLORS.slate,
  ];

  const teamComparison: TeamAvg[] = teams
    .map((team, i) => {
      const ts = teamSessionMap.get(team.id);
      if (!ts || ts.count === 0) return null;
      return {
        name: team.name,
        avgHours: Math.round((ts.totalMinutes / ts.count / 60) * 10) / 10,
        color: teamColors[i % teamColors.length],
      };
    })
    .filter(Boolean) as TeamAvg[];

  // Employee leaderboard: sort by days present desc, then on-time rate desc
  const employeeStats: EmployeeStat[] = Array.from(employeeMap.entries())
    .map(([profileId, data]) => {
      const profile = profileMap.get(profileId);
      return {
        profileId,
        name: profile?.full_name ?? 'Unknown',
        avatarUrl: profile?.avatar_url ?? null,
        daysPresent: data.days.size,
        avgHours:
          data.sessions > 0
            ? Math.round((data.totalMinutes / data.sessions / 60) * 10) / 10
            : 0,
        onTimeRate:
          data.sessions > 0
            ? Math.round((data.onTime / data.sessions) * 100)
            : 0,
      };
    })
    .sort((a, b) => b.daysPresent - a.daysPresent || b.onTimeRate - a.onTimeRate)
    .slice(0, 10);

  // Summary stats
  const totalSessions = sessions.length;
  const totalOnTime = sessions.filter((s) => !s.is_late).length;
  const onTimeRate = totalSessions > 0
    ? Math.round((totalOnTime / totalSessions) * 100)
    : 0;

  const totalWorkedMinutes = sessions.reduce(
    (sum, s) => sum + (s.total_worked_minutes ?? 0),
    0
  );
  const totalHours = Math.round((totalWorkedMinutes / 60) * 10) / 10;

  const uniqueDays = new Set(sessions.map((s) => dayKey(s.clock_in_at))).size;
  const avgHoursPerDay =
    uniqueDays > 0
      ? Math.round((totalWorkedMinutes / uniqueDays / 60) * 10) / 10
      : 0;

  return {
    dailyAttendance,
    dailyOnTime,
    hoursDistribution,
    teamComparison,
    employeeStats,
    summary: {
      totalSessions,
      avgHoursPerDay,
      onTimeRate,
      totalHours,
    },
  };
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const { orgId, loading: sessionLoading } = useSession();
  const [range, setRange] = useState<DateRange>(7);
  const [loading, setLoading] = useState(true);

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);

  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    const rangeStart = getRangeStart(range).toISOString();

    const [sessionsRes, profilesRes, teamsRes, teamMembersRes, countRes] =
      await Promise.all([
        supabase
          .from('attendance_sessions')
          .select('*')
          .eq('org_id', orgId)
          .gte('clock_in_at', rangeStart)
          .order('clock_in_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, position')
          .eq('org_id', orgId)
          .eq('status', 'active'),
        supabase.from('teams').select('id, name, color').eq('org_id', orgId),
        supabase.from('team_members').select('id, team_id, profile_id'),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('status', 'active'),
      ]);

    setSessions((sessionsRes.data as AttendanceSession[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setTeams((teamsRes.data as Team[]) ?? []);
    setTeamMembers((teamMembersRes.data as TeamMember[]) ?? []);
    setTotalEmployees(countRes.count ?? 0);
    setLoading(false);
  }, [orgId, range, supabase]);

  useEffect(() => {
    if (!sessionLoading && orgId) {
      fetchData();
    }
  }, [sessionLoading, orgId, fetchData]);

  const data = useMemo(
    () => processData(sessions, profiles, teams, teamMembers, range, totalEmployees),
    [sessions, profiles, teams, teamMembers, range, totalEmployees]
  );

  const isLoading = sessionLoading || loading;
  const isEmpty = !isLoading && sessions.length === 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Attendance trends, team performance, and workforce insights.
          </p>
        </div>

        {/* Date Range Picker */}
        <div className="flex gap-1 rounded-lg border p-1 bg-muted/30">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={range === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRange(opt.value)}
              className={
                range === opt.value
                  ? ''
                  : 'border-transparent bg-transparent shadow-none hover:bg-muted'
              }
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Sessions"
            value={data.summary.totalSessions.toLocaleString()}
            icon={<CalendarDays className="size-5" />}
            iconColor="text-indigo-500"
            iconBg="bg-indigo-500/10"
          />
          <StatCard
            label="Avg Hours / Day"
            value={`${data.summary.avgHoursPerDay}h`}
            icon={<Clock className="size-5" />}
            iconColor="text-emerald-500"
            iconBg="bg-emerald-500/10"
          />
          <StatCard
            label="On-Time Rate"
            value={`${data.summary.onTimeRate}%`}
            icon={<TrendingUp className="size-5" />}
            iconColor="text-amber-500"
            iconBg="bg-amber-500/10"
          />
          <StatCard
            label="Total Hours Worked"
            value={data.summary.totalHours.toLocaleString()}
            icon={<BarChart3 className="size-5" />}
            iconColor="text-violet-500"
            iconBg="bg-violet-500/10"
          />
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted mb-4">
                <BarChart3 className="size-7 text-muted-foreground" />
              </div>
              <p className="text-base font-medium text-muted-foreground">
                No attendance data found
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
                There are no sessions in the selected date range. Try selecting a
                wider range or check back after employees have clocked in.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Grid */}
      {!isEmpty && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance Rate Over Time */}
            {isLoading ? (
              <ChartCardSkeleton title="Attendance Rate Over Time" />
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">
                      Attendance Rate Over Time
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs font-normal">
                      % of employees
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={data.dailyAttendance}
                        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="attendanceGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={CHART_COLORS.emerald}
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor={CHART_COLORS.emerald}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fontSize: 12,
                            fill: 'var(--color-muted-foreground)',
                          }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fontSize: 12,
                            fill: 'var(--color-muted-foreground)',
                          }}
                          domain={[0, 100]}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip
                          content={<ChartTooltip suffix="%" />}
                        />
                        <Area
                          type="monotone"
                          dataKey="rate"
                          name="Attendance"
                          stroke={CHART_COLORS.emerald}
                          strokeWidth={2}
                          fill="url(#attendanceGradient)"
                          dot={false}
                          activeDot={{
                            r: 5,
                            stroke: CHART_COLORS.emerald,
                            strokeWidth: 2,
                            fill: 'var(--color-background)',
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* On-Time vs Late Arrivals */}
            {isLoading ? (
              <ChartCardSkeleton title="On-Time vs Late Arrivals" />
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">
                      On-Time vs Late Arrivals
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: CHART_COLORS.emerald }}
                        />
                        On-Time
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: CHART_COLORS.amber }}
                        />
                        Late
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.dailyOnTime}
                        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fontSize: 12,
                            fill: 'var(--color-muted-foreground)',
                          }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fontSize: 12,
                            fill: 'var(--color-muted-foreground)',
                          }}
                          allowDecimals={false}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar
                          dataKey="onTime"
                          name="On-Time"
                          stackId="a"
                          fill={CHART_COLORS.emerald}
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="late"
                          name="Late"
                          stackId="a"
                          fill={CHART_COLORS.amber}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Hours Worked Distribution */}
            {isLoading ? (
              <ChartCardSkeleton title="Hours Worked Distribution" />
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Hours Worked Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.hoursDistribution}
                        layout="vertical"
                        margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fontSize: 12,
                            fill: 'var(--color-muted-foreground)',
                          }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="range"
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fontSize: 12,
                            fill: 'var(--color-muted-foreground)',
                          }}
                          width={44}
                        />
                        <Tooltip
                          content={<ChartTooltip suffix=" sessions" />}
                        />
                        <Bar
                          dataKey="count"
                          name="Sessions"
                          radius={[0, 4, 4, 0]}
                        >
                          {data.hoursDistribution.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Placeholder for grid balance -- Team Comparison goes full width below */}
            {isLoading ? (
              <ChartCardSkeleton title="Team Comparison" />
            ) : data.teamComparison.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Team Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.teamComparison}
                        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fontSize: 12,
                            fill: 'var(--color-muted-foreground)',
                          }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{
                            fontSize: 12,
                            fill: 'var(--color-muted-foreground)',
                          }}
                          tickFormatter={(v: number) => `${v}h`}
                        />
                        <Tooltip
                          content={<ChartTooltip suffix="h" />}
                        />
                        <Bar
                          dataKey="avgHours"
                          name="Avg Hours"
                          radius={[4, 4, 0, 0]}
                        >
                          {data.teamComparison.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Team Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                      <Users className="size-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No team data available
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Assign employees to teams to see comparisons.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Employee Leaderboard */}
          {isLoading ? (
            <LeaderboardSkeleton />
          ) : data.employeeStats.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    Top Employees by Attendance
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs font-normal">
                    Top 10
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Days Present</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">
                        Avg Hours
                      </TableHead>
                      <TableHead className="text-right">On-Time %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.employeeStats.map((emp, i) => (
                      <TableRow key={emp.profileId}>
                        <TableCell>
                          <span
                            className={
                              i < 3
                                ? 'inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ' +
                                  (i === 0
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                                    : i === 1
                                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400'
                                      : 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400')
                                : 'text-sm text-muted-foreground pl-1.5'
                            }
                          >
                            {i + 1}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar size="sm">
                              {emp.avatarUrl && (
                                <AvatarImage
                                  src={emp.avatarUrl}
                                  alt={emp.name}
                                />
                              )}
                              <AvatarFallback>
                                {getInitials(emp.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {emp.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {emp.daysPresent}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right tabular-nums text-sm">
                          {emp.avgHours}h
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              emp.onTimeRate >= 90
                                ? 'default'
                                : emp.onTimeRate >= 70
                                  ? 'secondary'
                                  : 'destructive'
                            }
                            className={
                              emp.onTimeRate >= 90
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0'
                                : emp.onTimeRate >= 70
                                  ? ''
                                  : ''
                            }
                          >
                            {emp.onTimeRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  iconColor,
  iconBg,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
          >
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
