import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';

export const instant = false;
import { formatTime, formatDuration, getInitials } from '@/lib/utils';
import {
  ATTENDANCE_STATE_LABELS,
} from '@/lib/constants/attendance-states';
import {
  Users,
  Clock,
  Coffee,
  AlertTriangle,
  CheckCircle2,
  FileEdit,
  Activity,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AttendanceChart } from './attendance-chart';

export const metadata = {
  title: 'Dashboard',
};

// -- Helper: get start-of-today in UTC ISO string
function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function todayEnd() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

// -- KPI data fetcher
async function getKpiData() {
  const supabase = await createClient();
  const start = todayStart();
  const end = todayEnd();

  const [
    activeEmployees,
    clockedIn,
    onBreak,
    lateArrivals,
    completedShifts,
    pendingCorrections,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('attendance_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'clocked_in')
      .gte('clock_in_at', start)
      .lte('clock_in_at', end),
    supabase
      .from('attendance_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'on_break')
      .gte('clock_in_at', start)
      .lte('clock_in_at', end),
    supabase
      .from('attendance_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('is_late', true)
      .gte('clock_in_at', start)
      .lte('clock_in_at', end),
    supabase
      .from('attendance_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'clocked_out')
      .gte('clock_in_at', start)
      .lte('clock_in_at', end),
    supabase
      .from('correction_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  return {
    totalActive: activeEmployees.count ?? 0,
    currentlyWorking: clockedIn.count ?? 0,
    onBreak: onBreak.count ?? 0,
    lateArrivals: lateArrivals.count ?? 0,
    completedShifts: completedShifts.count ?? 0,
    pendingCorrections: pendingCorrections.count ?? 0,
  };
}

// -- Chart data fetcher: last 7 days
async function getChartData() {
  const supabase = await createClient();
  const days: { date: string; label: string; count: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    const { count } = await supabase
      .from('attendance_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('clock_in_at', dayStart.toISOString())
      .lte('clock_in_at', dayEnd.toISOString());

    days.push({
      date: dayStart.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      count: count ?? 0,
    });
  }

  return days;
}

// -- Live workforce fetcher
async function getWorkforceStatus() {
  const supabase = await createClient();
  const start = todayStart();

  const { data: sessions } = await supabase
    .from('attendance_sessions')
    .select('id, profile_id, state, clock_in_at, total_break_minutes, total_worked_minutes')
    .in('state', ['clocked_in', 'on_break'])
    .gte('clock_in_at', start)
    .order('clock_in_at', { ascending: false })
    .limit(20);

  if (!sessions || sessions.length === 0) return [];

  const profileIds = [...new Set(sessions.map((s) => s.profile_id))];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, position')
    .in('id', profileIds);

  // Get team assignments
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('profile_id, team_id')
    .in('profile_id', profileIds);

  const teamIds = [...new Set((teamMembers ?? []).map((tm) => tm.team_id))];
  const { data: teams } = teamIds.length > 0
    ? await supabase.from('teams').select('id, name, color').in('id', teamIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const memberTeamMap = new Map(
    (teamMembers ?? []).map((tm) => [tm.profile_id, tm.team_id])
  );
  const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));

  // Get active breaks
  const sessionIds = sessions.map((s) => s.id);
  const { data: activeBreaks } = await supabase
    .from('attendance_breaks')
    .select('session_id, start_at')
    .in('session_id', sessionIds)
    .is('end_at', null);
  const breakMap = new Map(
    (activeBreaks ?? []).map((b) => [b.session_id, b.start_at])
  );

  return sessions.map((session) => {
    const profile = profileMap.get(session.profile_id);
    const teamId = memberTeamMap.get(session.profile_id);
    const team = teamId ? teamMap.get(teamId) : null;

    const now = new Date();
    const clockIn = new Date(session.clock_in_at);
    const elapsedMinutes = Math.round(
      (now.getTime() - clockIn.getTime()) / 60000
    );

    return {
      id: session.id,
      name: profile?.full_name ?? 'Unknown',
      avatarUrl: profile?.avatar_url ?? null,
      position: profile?.position ?? null,
      team: team?.name ?? null,
      teamColor: team?.color ?? null,
      state: session.state as 'clocked_in' | 'on_break',
      clockInAt: session.clock_in_at,
      elapsedMinutes,
      totalBreakMinutes: session.total_break_minutes,
      breakStartedAt: breakMap.get(session.id) ?? null,
    };
  });
}

// -- Recent activity fetcher
async function getRecentActivity() {
  const supabase = await createClient();

  // Get the most recent sessions with state changes
  const { data: sessions } = await supabase
    .from('attendance_sessions')
    .select('id, profile_id, state, clock_in_at, clock_out_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (!sessions || sessions.length === 0) return [];

  const profileIds = [...new Set(sessions.map((s) => s.profile_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', profileIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return sessions.map((session) => {
    const profile = profileMap.get(session.profile_id);
    let action: string;
    let timestamp: string;

    if (session.state === 'clocked_out' && session.clock_out_at) {
      action = 'Clocked out';
      timestamp = session.clock_out_at;
    } else if (session.state === 'on_break') {
      action = 'Started break';
      timestamp = session.updated_at;
    } else {
      action = 'Clocked in';
      timestamp = session.clock_in_at;
    }

    return {
      id: session.id,
      name: profile?.full_name ?? 'Unknown',
      avatarUrl: profile?.avatar_url ?? null,
      action,
      timestamp,
    };
  });
}

// -- KPI Card Component
interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

function KpiCard({ label, value, icon, color, bgColor }: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${bgColor}`}>
            <div className={color}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Loading fallbacks
function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-12" />
              </div>
              <Skeleton className="size-10 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// -- Server-rendered KPI section
async function KpiSection() {
  const kpi = await getKpiData();

  const cards: KpiCardProps[] = [
    {
      label: 'Total Active',
      value: kpi.totalActive,
      icon: <Users className="size-5" />,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Currently Working',
      value: kpi.currentlyWorking,
      icon: <Clock className="size-5" />,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'On Break',
      value: kpi.onBreak,
      icon: <Coffee className="size-5" />,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Late Arrivals',
      value: kpi.lateArrivals,
      icon: <AlertTriangle className="size-5" />,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      label: 'Completed Shifts',
      value: kpi.completedShifts,
      icon: <CheckCircle2 className="size-5" />,
      color: 'text-chart-2',
      bgColor: 'bg-chart-2/10',
    },
    {
      label: 'Pending Corrections',
      value: kpi.pendingCorrections,
      icon: <FileEdit className="size-5" />,
      color: 'text-chart-5',
      bgColor: 'bg-chart-5/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}

// -- Server-rendered Chart section
async function ChartSection() {
  const chartData = await getChartData();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Attendance Overview
          </CardTitle>
          <Badge variant="secondary" className="text-xs font-normal">
            Last 7 Days
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <AttendanceChart data={chartData} />
      </CardContent>
    </Card>
  );
}

// -- State badge helper
function StateBadge({ state }: { state: 'clocked_in' | 'on_break' }) {
  if (state === 'clocked_in') {
    return (
      <Badge variant="default" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 text-xs">
        Working
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0 text-xs">
      On Break
    </Badge>
  );
}

// -- Server-rendered Workforce Table
async function WorkforceSection() {
  const workforce = await getWorkforceStatus();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Live Workforce Status
          </CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="size-3.5 text-emerald-500 animate-pulse" />
            Live
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {workforce.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
              <Clock className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No active sessions
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Employees will appear here once they clock in.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="hidden md:table-cell">Team</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Clock In</TableHead>
                <TableHead className="hidden lg:table-cell">Duration</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Break</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workforce.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        {w.avatarUrl && (
                          <AvatarImage src={w.avatarUrl} alt={w.name} />
                        )}
                        <AvatarFallback>
                          {getInitials(w.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{w.name}</span>
                        {w.position && (
                          <span className="text-xs text-muted-foreground">
                            {w.position}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {w.team ? (
                      <Badge variant="outline" className="text-xs">
                        {w.team}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StateBadge state={w.state} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatTime(w.clockInAt)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm font-medium">
                    {formatDuration(w.elapsedMinutes)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right text-sm text-muted-foreground">
                    {w.totalBreakMinutes > 0
                      ? formatDuration(w.totalBreakMinutes)
                      : '--'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// -- Server-rendered Activity Feed
async function ActivitySection() {
  const activity = await getRecentActivity();

  const actionColors: Record<string, string> = {
    'Clocked in': 'text-emerald-500',
    'Clocked out': 'text-slate-400',
    'Started break': 'text-amber-500',
    'Ended break': 'text-sky-500',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
              <Activity className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No recent activity
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Activity will show up as employees clock in and out.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {activity.map((item) => (
              <div
                key={item.id + item.timestamp}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <Avatar size="sm">
                  {item.avatarUrl && (
                    <AvatarImage src={item.avatarUrl} alt={item.name} />
                  )}
                  <AvatarFallback>{getInitials(item.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{item.name}</span>{' '}
                    <span className={actionColors[item.action] ?? 'text-muted-foreground'}>
                      {item.action.toLowerCase()}
                    </span>
                  </p>
                </div>
                <time className="text-xs text-muted-foreground shrink-0">
                  {formatTime(item.timestamp)}
                </time>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -- Main Dashboard Page
export default function DashboardPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your workforce command center. Track attendance, monitor teams, and stay in control.
        </p>
      </div>

      <Suspense fallback={<KpiSkeleton />}>
        <KpiSection />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <ChartSection />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Suspense fallback={<TableSkeleton />}>
            <WorkforceSection />
          </Suspense>
        </div>
        <div className="lg:col-span-2">
          <Suspense fallback={<TableSkeleton />}>
            <ActivitySection />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
