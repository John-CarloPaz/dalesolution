'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from 'cn';
import { useSupabase } from '@/providers/supabase-provider';
import { formatTime, formatDuration, formatDate, getInitials } from '@/lib/utils';
import {
  ATTENDANCE_STATE_LABELS,
  type AttendanceState,
} from '@/lib/constants/attendance-states';
import {
  Users,
  Clock,
  Coffee,
  AlertTriangle,
  Timer,
  CalendarIcon,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { AttendanceSession, Profile, Team, TeamMember } from '@/types/database';

// -- Types for enriched attendance data
interface AttendanceRecord {
  session: AttendanceSession;
  profile: Profile;
  teamName: string | null;
}

interface SummaryStats {
  totalEmployees: number;
  presentToday: number;
  onBreak: number;
  lateArrivals: number;
  averageHours: number;
}

// -- Status badge component
function StatusBadge({ state }: { state: AttendanceState }) {
  const config: Record<AttendanceState, { label: string; className: string }> = {
    clocked_in: {
      label: 'Working',
      className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0',
    },
    on_break: {
      label: 'On Break',
      className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0',
    },
    clocked_out: {
      label: 'Completed',
      className: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-0',
    },
    not_started: {
      label: 'Not Started',
      className: 'bg-muted text-muted-foreground border-0',
    },
  };

  const { label, className } = config[state];

  return (
    <Badge variant="default" className={cn('text-xs', className)}>
      {label}
    </Badge>
  );
}

// -- Stat card
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

function StatCard({ label, value, icon, color, bgColor }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', bgColor)}>
            <div className={color}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Date helpers
function dayStart(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayEnd(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

// -- Main page
export default function AttendancePage() {
  const { supabase, profile } = useSupabase();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeEmployeeCount, setActiveEmployeeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);

    const start = dayStart(selectedDate);
    const end = dayEnd(selectedDate);

    const [sessionsResult, profilesResult, teamsResult, membersResult] = await Promise.all([
      supabase
        .from('attendance_sessions')
        .select('*')
        .eq('org_id', profile.org_id)
        .gte('clock_in_at', start)
        .lte('clock_in_at', end)
        .order('clock_in_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('status', 'active'),
      supabase
        .from('teams')
        .select('*')
        .eq('org_id', profile.org_id),
      supabase
        .from('team_members')
        .select('*'),
    ]);

    const sessions = sessionsResult.data || [];
    const profiles = profilesResult.data || [];
    const allTeams = teamsResult.data || [];
    const members = membersResult.data || [];

    setTeams(allTeams);
    setActiveEmployeeCount(profiles.length);

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const memberTeamMap = new Map<string, string>();
    members.forEach((m) => {
      const team = allTeams.find((t) => t.id === m.team_id);
      if (team) memberTeamMap.set(m.profile_id, team.name);
    });
    const memberTeamIdMap = new Map<string, string>();
    members.forEach((m) => memberTeamIdMap.set(m.profile_id, m.team_id));

    const enriched: AttendanceRecord[] = sessions.map((session) => ({
      session,
      profile: profileMap.get(session.profile_id) || {
        id: session.profile_id,
        org_id: session.org_id,
        email: '',
        full_name: 'Unknown',
        avatar_url: null,
        role: 'employee' as const,
        status: 'active' as const,
        timezone: 'UTC',
        position: null,
        created_at: '',
        updated_at: '',
      },
      teamName: memberTeamMap.get(session.profile_id) || null,
    }));

    setRecords(enriched);
    setLoading(false);
  }, [supabase, profile?.org_id, selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- Compute summary stats
  const summary = useMemo<SummaryStats>(() => {
    // Unique people present today (a person may have multiple sessions)
    const presentIds = new Set(records.map((r) => r.session.profile_id));
    const presentToday = presentIds.size;

    // Unique people currently on break
    const onBreak = new Set(
      records.filter((r) => r.session.state === 'on_break').map((r) => r.session.profile_id)
    ).size;

    // Unique people who were late today
    const lateArrivals = new Set(
      records.filter((r) => r.session.is_late).map((r) => r.session.profile_id)
    ).size;

    const workedMinutes = records
      .filter((r) => r.session.total_worked_minutes != null)
      .map((r) => r.session.total_worked_minutes!);
    const avgMinutes = workedMinutes.length > 0
      ? Math.round(workedMinutes.reduce((a, b) => a + b, 0) / workedMinutes.length)
      : 0;

    return {
      totalEmployees: activeEmployeeCount,
      presentToday,
      onBreak,
      lateArrivals,
      averageHours: avgMinutes,
    };
  }, [records, activeEmployeeCount]);

  // -- Apply filters
  const filteredRecords = useMemo(() => {
    let result = records;

    if (teamFilter !== 'all') {
      const teamName = teams.find((t) => t.id === teamFilter)?.name;
      result = result.filter((r) => r.teamName === teamName);
    }

    if (statusFilter !== 'all') {
      result = result.filter((r) => r.session.state === statusFilter);
    }

    return result;
  }, [records, teamFilter, statusFilter, teams]);

  // -- Compute working duration for active sessions
  function getWorkingDuration(session: AttendanceSession): string {
    if (session.total_worked_minutes != null) {
      return formatDuration(session.total_worked_minutes);
    }
    // Still active - compute elapsed
    const clockIn = new Date(session.clock_in_at);
    const now = new Date();
    const elapsed = Math.round((now.getTime() - clockIn.getTime()) / 60000);
    return formatDuration(Math.max(0, elapsed - session.total_break_minutes));
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organization-wide attendance tracking and daily overview.
          </p>
        </div>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" className="w-[220px] justify-start text-left font-normal" />
            }
          >
            <CalendarIcon className="size-4 text-muted-foreground" />
            {formatDate(selectedDate)}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  setCalendarOpen(false);
                }
              }}
              disabled={(date) => date > new Date()}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total VAs"
          value={summary.totalEmployees}
          icon={<Users className="size-5" />}
          color="text-primary"
          bgColor="bg-primary/10"
        />
        <StatCard
          label="Present Today"
          value={summary.presentToday}
          icon={<Clock className="size-5" />}
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
        />
        <StatCard
          label="On Break"
          value={summary.onBreak}
          icon={<Coffee className="size-5" />}
          color="text-amber-500"
          bgColor="bg-amber-500/10"
        />
        <StatCard
          label="Late Arrivals"
          value={summary.lateArrivals}
          icon={<AlertTriangle className="size-5" />}
          color="text-destructive"
          bgColor="bg-destructive/10"
        />
        <StatCard
          label="Average Hours"
          value={summary.averageHours > 0 ? formatDuration(summary.averageHours) : '--'}
          icon={<Timer className="size-5" />}
          color="text-chart-2"
          bgColor="bg-chart-2/10"
        />
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-semibold">
              Attendance Records
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={teamFilter} onValueChange={(v) => setTeamFilter(v ?? 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="clocked_in">Working</SelectItem>
                  <SelectItem value="on_break">On Break</SelectItem>
                  <SelectItem value="clocked_out">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                <Search className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No attendance records
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {teamFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters to see more results.'
                  : `No virtual assistants have clocked in for ${formatDate(selectedDate)}.`}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Virtual Assistant</TableHead>
                  <TableHead className="hidden md:table-cell">Clock In</TableHead>
                  <TableHead className="hidden md:table-cell">Clock Out</TableHead>
                  <TableHead className="hidden sm:table-cell">Duration</TableHead>
                  <TableHead className="hidden lg:table-cell">Breaks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Late</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.session.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          {record.profile.avatar_url && (
                            <AvatarImage
                              src={record.profile.avatar_url}
                              alt={record.profile.full_name}
                            />
                          )}
                          <AvatarFallback>
                            {getInitials(record.profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {record.profile.full_name}
                          </span>
                          {record.teamName && (
                            <span className="text-xs text-muted-foreground">
                              {record.teamName}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatTime(record.session.clock_in_at)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {record.session.clock_out_at
                        ? formatTime(record.session.clock_out_at)
                        : '--'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm font-medium">
                      {getWorkingDuration(record.session)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {record.session.total_break_minutes > 0
                        ? formatDuration(record.session.total_break_minutes)
                        : '--'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge state={record.session.state} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {record.session.is_late && (
                        <Badge
                          variant="destructive"
                          className="text-xs"
                        >
                          Late
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
