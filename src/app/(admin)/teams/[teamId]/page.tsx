'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/supabase-provider';
import { cn } from 'cn';
import { toast } from 'sonner';
import { formatDate, getInitials } from '@/lib/utils';
import {
  ATTENDANCE_STATE_LABELS,
  ATTENDANCE_STATE_COLORS,
  type AttendanceState,
} from '@/lib/constants/attendance-states';
import { ROLE_LABELS, type Role } from '@/lib/constants/roles';
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  Users,
  UserCircle,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Profile, Team } from '@/types/database';

// -- Preset color palette (same as teams list page)
const PRESET_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Slate', value: '#64748b' },
] as const;

interface MemberRow {
  memberId: string;
  profile: Profile;
  joinedAt: string;
  attendanceState: AttendanceState | null;
}

export default function TeamDetailPage() {
  const params = useParams<{ teamId: string }>();
  const router = useRouter();
  const { supabase, profile: currentProfile } = useSupabase();

  const [team, setTeam] = useState<Team | null>(null);
  const [leadName, setLeadName] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [allOrgProfiles, setAllOrgProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // -- Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editLeadId, setEditLeadId] = useState<string>('none');
  const [saving, setSaving] = useState(false);

  // -- Add member dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addProfileId, setAddProfileId] = useState<string>('');
  const [adding, setAdding] = useState(false);

  // -- Remove member confirmation
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const teamId = params.teamId;

  // -- Helper: get start/end of today
  function todayRange() {
    const d = new Date();
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  const fetchData = useCallback(async () => {
    if (!currentProfile?.org_id || !teamId) return;

    const { start, end } = todayRange();

    const teamResult: { data: Team | null; error: any } = await (supabase
      .from('teams') as any)
      .select('*')
      .eq('id', teamId)
      .single();

    const membersResult = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId);

    const orgProfilesResult = await supabase
      .from('profiles')
      .select('*')
      .eq('org_id', currentProfile.org_id)
      .eq('status', 'active');

    if (!teamResult.data) {
      setLoading(false);
      return;
    }

    const teamData = teamResult.data;
    setTeam(teamData);

    const allProfiles = (orgProfilesResult.data ?? []) as Profile[];
    setAllOrgProfiles(allProfiles);
    const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

    // Lead name
    setLeadName(
      teamData.lead_id ? profileMap.get(teamData.lead_id)?.full_name ?? null : null
    );

    const teamMembers = (membersResult.data ?? []) as { id: string; team_id: string; profile_id: string; joined_at: string }[];
    const memberProfileIds = teamMembers.map((m) => m.profile_id);

    // Today's attendance for members
    const sessionMap = new Map<string, AttendanceState>();
    if (memberProfileIds.length > 0) {
      const sessionsResult = await supabase
        .from('attendance_sessions')
        .select('profile_id, state')
        .in('profile_id', memberProfileIds)
        .gte('clock_in_at', start)
        .lte('clock_in_at', end)
        .order('clock_in_at', { ascending: false });

      // Take latest session per profile
      const sessions = (sessionsResult.data ?? []) as { profile_id: string; state: string }[];
      sessions.forEach((s) => {
        if (!sessionMap.has(s.profile_id)) {
          sessionMap.set(s.profile_id, s.state as AttendanceState);
        }
      });
    }

    const memberRows: MemberRow[] = teamMembers
      .map((m) => {
        const p = profileMap.get(m.profile_id);
        if (!p) return null;
        return {
          memberId: m.id,
          profile: p,
          joinedAt: m.joined_at,
          attendanceState: sessionMap.get(m.profile_id) ?? null,
        };
      })
      .filter(Boolean) as MemberRow[];

    setMembers(memberRows);

    // Available = org profiles not already in this team
    const memberIdSet = new Set(memberProfileIds);
    setAvailableProfiles(allProfiles.filter((p) => !memberIdSet.has(p.id)));

    setLoading(false);
  }, [supabase, currentProfile?.org_id, teamId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- Edit team handler
  const handleEdit = async () => {
    if (!team || !editName.trim()) return;
    setSaving(true);

    const { error } = await (supabase.from('teams') as any)
      .update({
        name: editName.trim(),
        color: editColor,
        lead_id: editLeadId === 'none' ? null : editLeadId,
      })
      .eq('id', team.id);

    if (error) {
      toast.error('Failed to update team', { description: error.message });
      setSaving(false);
      return;
    }

    toast.success('Team updated');
    setEditOpen(false);
    setSaving(false);
    fetchData();
  };

  const openEditDialog = () => {
    if (!team) return;
    setEditName(team.name);
    setEditColor(team.color);
    setEditLeadId(team.lead_id ?? 'none');
    setEditOpen(true);
  };

  // -- Add member handler
  const handleAddMember = async () => {
    if (!addProfileId || !teamId) return;
    setAdding(true);

    const { error } = await (supabase.from('team_members') as any).insert({
      team_id: teamId,
      profile_id: addProfileId,
    });

    if (error) {
      toast.error('Failed to add member', { description: error.message });
      setAdding(false);
      return;
    }

    toast.success('Member added to team');
    setAddOpen(false);
    setAddProfileId('');
    setAdding(false);
    fetchData();
  };

  // -- Remove member handler
  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setRemoving(true);

    const { error } = await (supabase.from('team_members') as any)
      .delete()
      .eq('id', removeTarget.memberId);

    if (error) {
      toast.error('Failed to remove member', { description: error.message });
      setRemoving(false);
      return;
    }

    toast.success(`${removeTarget.profile.full_name} removed from team`);
    setRemoveTarget(null);
    setRemoving(false);
    fetchData();
  };

  // -- Attendance badge
  function AttendanceBadge({ state }: { state: AttendanceState | null }) {
    if (!state) {
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Not Started
        </Badge>
      );
    }

    const badgeColors: Record<AttendanceState, string> = {
      not_started: '',
      clocked_in:
        'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0',
      on_break:
        'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0',
      clocked_out:
        'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-0',
    };

    return (
      <Badge variant="default" className={cn('text-xs', badgeColors[state])}>
        {ATTENDANCE_STATE_LABELS[state]}
      </Badge>
    );
  }

  // -- Loading state
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -- Not found
  if (!team) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold">Team not found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This team may have been deleted or you don't have access.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push('/teams')}
          >
            <ArrowLeft className="size-4 mr-1.5" />
            Back to Teams
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Back button + header */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/teams')}
          className="text-muted-foreground"
        >
          <ArrowLeft className="size-4 mr-1.5" />
          Back to Teams
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="mt-1.5 size-4 shrink-0 rounded-full"
              style={{ backgroundColor: team.color }}
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                {leadName && (
                  <span className="flex items-center gap-1.5">
                    <UserCircle className="size-4" />
                    Lead: {leadName}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="size-4" />
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  Created {formatDate(team.created_at)}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Pencil className="size-4 mr-1.5" />
            Edit
          </Button>
        </div>
      </div>

      {/* Members section */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Members</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAddProfileId('');
                setAddOpen(true);
              }}
              disabled={availableProfiles.length === 0}
            >
              <Plus className="size-4 mr-1.5" />
              Add Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                <Users className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No members yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Add members from your organization to this team.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Attendance
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.memberId}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          {m.profile.avatar_url && (
                            <AvatarImage
                              src={m.profile.avatar_url}
                              alt={m.profile.full_name}
                            />
                          )}
                          <AvatarFallback>
                            {getInitials(m.profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {m.profile.full_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {m.profile.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {ROLE_LABELS[m.profile.role as Role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <AttendanceBadge state={m.attendanceState} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {formatDate(m.joinedAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setRemoveTarget(m)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Team Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update the team name, color, or lead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Team Name</Label>
              <Input
                id="edit-team-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setEditColor(c.value)}
                    className={cn(
                      'size-7 rounded-full transition-all ring-offset-background',
                      editColor === c.value
                        ? 'ring-2 ring-ring ring-offset-2'
                        : 'hover:scale-110'
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Team Lead</Label>
              <Select value={editLeadId} onValueChange={(v) => setEditLeadId(v ?? 'none')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No lead</SelectItem>
                  {allOrgProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
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
            <Button
              onClick={handleEdit}
              disabled={saving || !editName.trim()}
            >
              {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Select an employee to add to {team.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={addProfileId} onValueChange={(v) => setAddProfileId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an employee" />
              </SelectTrigger>
              <SelectContent>
                {availableProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={adding || !addProfileId}
            >
              {adding && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-medium text-foreground">
                {removeTarget?.profile.full_name}
              </span>{' '}
              from {team.name}? They can be re-added later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={removing}
            >
              {removing && (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
