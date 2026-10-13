'use client';

import { useState, useEffect, use } from 'react';
import {
  ArrowLeft,
  Clock,
  Calendar,
  BarChart2,
  Mail,
  Pencil,
  Shield,
  Loader2,
  MapPin,
  Globe,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSession } from '@/hooks/use-session';
import { createClient } from '@/lib/supabase/client';
import { ROLE_LABELS, isAdmin, type Role } from '@/lib/constants/roles';
import {
  ATTENDANCE_STATE_LABELS,
  type AttendanceState,
} from '@/lib/constants/attendance-states';
import {
  getInitials,
  formatDate,
  formatTime,
  formatDuration,
} from '@/lib/utils';
import type { Profile, AttendanceSession, WorkSchedule } from '@/types/database';
import { TIMEZONES } from '@/lib/constants/timezones';
import { toast } from 'sonner';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-start gap-6">
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${bgColor}`}
          >
            <div className={color}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = use(params);
  const { profile: currentProfile, role } = useSession();
  const supabase = createClient();

  // Data
  const [employee, setEmployee] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [monthlySessions, setMonthlySessions] = useState<AttendanceSession[]>(
    []
  );
  const [todaySession, setTodaySession] = useState<AttendanceSession | null>(
    null
  );
  const [teamName, setTeamName] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [currentScheduleId, setCurrentScheduleId] = useState<string | null>(null);
  const [assigningSchedule, setAssigningSchedule] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editTimezone, setEditTimezone] = useState('');
  const [saving, setSaving] = useState(false);

  // Role change
  const [changingRole, setChangingRole] = useState(false);

  const isCurrentUserAdmin = isAdmin(role);
  const isSelf = currentProfile?.id === employeeId;

  // ---------- Fetch data ----------

  useEffect(() => {
    async function fetchData() {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [profileRes, sessionsRes, monthlyRes, todayRes, teamRes, assignmentRes] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', employeeId)
            .single(),
          supabase
            .from('attendance_sessions')
            .select('*')
            .eq('profile_id', employeeId)
            .order('clock_in_at', { ascending: false })
            .limit(10),
          supabase
            .from('attendance_sessions')
            .select('*')
            .eq('profile_id', employeeId)
            .gte('clock_in_at', monthStart.toISOString())
            .lte('clock_in_at', todayEnd.toISOString()),
          supabase
            .from('attendance_sessions')
            .select('*')
            .eq('profile_id', employeeId)
            .gte('clock_in_at', todayStart.toISOString())
            .lte('clock_in_at', todayEnd.toISOString())
            .order('clock_in_at', { ascending: false })
            .limit(1),
          supabase
            .from('team_members')
            .select('team_id')
            .eq('profile_id', employeeId)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('schedule_assignments')
            .select('schedule_id')
            .eq('profile_id', employeeId)
            .is('effective_until', null)
            .limit(1)
            .maybeSingle(),
        ]);

      const emp = profileRes.data;
      setEmployee(emp);
      setSessions(sessionsRes.data ?? []);
      setMonthlySessions(monthlyRes.data ?? []);
      setTodaySession(todayRes.data?.[0] ?? null);
      setCurrentScheduleId(assignmentRes.data?.schedule_id ?? null);

      if (emp?.org_id) {
        const { data: scheds } = await supabase
          .from('work_schedules')
          .select('*')
          .eq('org_id', emp.org_id)
          .order('name');
        setSchedules(scheds ?? []);
      }

      if (teamRes.data?.team_id) {
        const { data: team } = await supabase
          .from('teams')
          .select('name')
          .eq('id', teamRes.data.team_id)
          .single();
        setTeamName(team?.name ?? null);
      } else {
        setTeamName(null);
      }

      if (emp) {
        setEditName(emp.full_name);
        setEditPosition(emp.position ?? '');
        setEditTimezone(emp.timezone);
      }

      setLoading(false);
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // ---------- Monthly stats ----------

  const monthlyCount = monthlySessions.length;
  const monthlyHours = monthlySessions.reduce(
    (acc, s) => acc + (s.total_worked_minutes ?? 0),
    0
  );
  const avgHoursPerDay =
    monthlyCount > 0 ? Math.round(monthlyHours / monthlyCount) : 0;
  const monthlyLate = monthlySessions.filter((s) => s.is_late).length;

  // ---------- Edit profile ----------

  async function handleSaveProfile() {
    if (!employee || !editName.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: editName.trim(),
        position: editPosition.trim() || null,
        timezone: editTimezone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', employee.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated');
      setEmployee({
        ...employee,
        full_name: editName.trim(),
        position: editPosition.trim() || null,
        timezone: editTimezone,
      });
      setEditOpen(false);
    }
    setSaving(false);
  }

  // ---------- Role change ----------

  async function handleRoleChange(newRole: string | null) {
    if (!newRole || !employee || isSelf) return;
    setChangingRole(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        role: newRole as Profile['role'],
        updated_at: new Date().toISOString(),
      })
      .eq('id', employee.id);

    if (error) {
      toast.error('Failed to change role');
    } else {
      toast.success(`Role changed to ${ROLE_LABELS[newRole as Role]}`);
      setEmployee({ ...employee, role: newRole as Profile['role'] });
    }
    setChangingRole(false);
  }

  // ---------- Schedule assignment ----------

  async function handleScheduleChange(value: string | null) {
    if (!employee) return;
    const newScheduleId = value === 'none' ? null : value;
    if (newScheduleId === currentScheduleId) return;

    setAssigningSchedule(true);
    const nowIso = new Date().toISOString();

    // End any currently active assignment
    const { error: endError } = await supabase
      .from('schedule_assignments')
      .update({ effective_until: nowIso })
      .eq('profile_id', employee.id)
      .is('effective_until', null);

    if (endError) {
      toast.error('Failed to update schedule');
      setAssigningSchedule(false);
      return;
    }

    // Assign the new schedule (unless clearing)
    if (newScheduleId) {
      const { error: insertError } = await supabase
        .from('schedule_assignments')
        .insert({
          profile_id: employee.id,
          schedule_id: newScheduleId,
          effective_from: nowIso,
        });

      if (insertError) {
        toast.error('Failed to assign schedule');
        setAssigningSchedule(false);
        return;
      }
      toast.success('Schedule assigned');
    } else {
      toast.success('Schedule cleared');
    }

    setCurrentScheduleId(newScheduleId);
    setAssigningSchedule(false);
  }

  // ---------- Loading / not found ----------

  if (loading) return <DetailSkeleton />;

  if (!employee) {
    return (
      <div className="p-4 md:p-6">
        <Link
          href="/employees"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Employees
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium">Employee not found</p>
          <p className="text-sm text-muted-foreground mt-1">
            This employee may have been removed or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  // ---------- Current status ----------

  function getCurrentStatus(): {
    label: string;
    variant: 'default' | 'secondary' | 'outline';
    className: string;
  } {
    if (!todaySession) {
      return {
        label: 'Not Started',
        variant: 'outline',
        className: 'text-muted-foreground',
      };
    }
    if (todaySession.state === 'clocked_in') {
      return {
        label: 'Working',
        variant: 'default',
        className:
          'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0',
      };
    }
    if (todaySession.state === 'on_break') {
      return {
        label: 'On Break',
        variant: 'default',
        className:
          'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0',
      };
    }
    return { label: 'Completed', variant: 'secondary', className: '' };
  }

  const status = getCurrentStatus();

  // ---------- Render ----------

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back link */}
      <Link
        href="/employees"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" /> Back to Employees
      </Link>

      {/* Profile header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-6">
        <Avatar size="lg" className="size-16">
          {employee.avatar_url && (
            <AvatarImage src={employee.avatar_url} alt={employee.full_name} />
          )}
          <AvatarFallback className="text-xl bg-primary/10 text-primary">
            {getInitials(employee.full_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {employee.full_name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge variant="outline">
                  {ROLE_LABELS[employee.role as Role]}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    employee.status === 'active'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0'
                      : employee.status === 'invited'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0'
                        : 'bg-slate-500/15 text-slate-500 border-0'
                  }
                >
                  {employee.status.charAt(0).toUpperCase() +
                    employee.status.slice(1)}
                </Badge>
                <Badge variant={status.variant} className={status.className}>
                  {status.label}
                </Badge>
              </div>
            </div>

            {isCurrentUserAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {employee.email}
            </span>
            {employee.position && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {employee.position}
              </span>
            )}
            {teamName && (
              <span className="inline-flex items-center gap-1.5">
                <Shield className="size-3.5" />
                {teamName}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Globe className="size-3.5" />
              {employee.timezone}
            </span>
          </div>
        </div>
      </div>

      {/* Role change (admin only, not for self) */}
      {isCurrentUserAdmin && !isSelf && (
        <Card size="sm">
          <CardContent className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium">Change Role</p>
              <p className="text-xs text-muted-foreground">
                Update this employee&apos;s role in the organization
              </p>
            </div>
            <Select
              value={employee.role}
              onValueChange={handleRoleChange}
              disabled={changingRole}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="team_lead">Team Lead</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Schedule assignment (admin only) */}
      {isCurrentUserAdmin && (
        <Card size="sm">
          <CardContent className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium">Work Schedule</p>
              <p className="text-xs text-muted-foreground">
                {schedules.length === 0
                  ? 'No schedules exist yet — create one on the Schedules page.'
                  : 'Assign a shift schedule to this employee'}
              </p>
            </div>
            <Select
              value={currentScheduleId ?? 'none'}
              onValueChange={handleScheduleChange}
              disabled={assigningSchedule || schedules.length === 0}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="No schedule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No schedule</SelectItem>
                {schedules.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Current attendance status */}
      {todaySession && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Today&apos;s Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Clock In</p>
                <p className="font-medium">
                  {formatTime(todaySession.clock_in_at)}
                </p>
              </div>
              {todaySession.clock_out_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Clock Out</p>
                  <p className="font-medium">
                    {formatTime(todaySession.clock_out_at)}
                  </p>
                </div>
              )}
              {todaySession.total_worked_minutes !== null && (
                <div>
                  <p className="text-xs text-muted-foreground">Worked</p>
                  <p className="font-medium">
                    {formatDuration(todaySession.total_worked_minutes)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Break</p>
                <p className="font-medium">
                  {todaySession.total_break_minutes > 0
                    ? formatDuration(todaySession.total_break_minutes)
                    : '--'}
                </p>
              </div>
              {todaySession.is_late && (
                <Badge variant="destructive" className="text-xs">
                  Late
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly stats */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          This Month
        </h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <StatCard
            icon={<Calendar className="size-5" />}
            label="Days Present"
            value={monthlyCount.toString()}
            color="text-primary"
            bgColor="bg-primary/10"
          />
          <StatCard
            icon={<Clock className="size-5" />}
            label="Total Hours"
            value={formatDuration(monthlyHours)}
            color="text-emerald-500"
            bgColor="bg-emerald-500/10"
          />
          <StatCard
            icon={<BarChart2 className="size-5" />}
            label="Avg Hours/Day"
            value={formatDuration(avgHoursPerDay)}
            color="text-blue-500"
            bgColor="bg-blue-500/10"
          />
          <StatCard
            icon={<Clock className="size-5" />}
            label="Late Arrivals"
            value={monthlyLate.toString()}
            color="text-destructive"
            bgColor="bg-destructive/10"
          />
        </div>
      </div>

      {/* Recent sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Recent Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                <Clock className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No attendance records yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Sessions will appear here once this employee clocks in.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="hidden sm:table-cell">Breaks</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">
                      {formatDate(s.clock_in_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTime(s.clock_in_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.clock_out_at ? formatTime(s.clock_out_at) : '--'}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {s.total_worked_minutes
                        ? formatDuration(s.total_worked_minutes)
                        : '--'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                      {s.total_break_minutes > 0
                        ? formatDuration(s.total_break_minutes)
                        : '--'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={
                            s.state === 'clocked_in'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 text-xs'
                              : s.state === 'on_break'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0 text-xs'
                                : 'text-xs'
                          }
                        >
                          {ATTENDANCE_STATE_LABELS[
                            s.state as AttendanceState
                          ] ?? s.state}
                        </Badge>
                        {s.is_late && (
                          <Badge variant="destructive" className="text-xs">
                            Late
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update employee profile information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-position">Position</Label>
              <Input
                id="edit-position"
                value={editPosition}
                onChange={(e) => setEditPosition(e.target.value)}
                placeholder="e.g. Senior Developer"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select value={editTimezone} onValueChange={(v) => setEditTimezone(v ?? 'UTC')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
