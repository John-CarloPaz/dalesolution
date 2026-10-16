'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserPlus, Users, Mail, Clock, Copy, Check, XCircle, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { useSession } from '@/hooks/use-session';
import { createClient } from '@/lib/supabase/client';
import { ROLE_LABELS, type Role } from '@/lib/constants/roles';
import { getInitials, formatDate } from '@/lib/utils';
import type { Profile, EmployeeInvitation } from '@/types/database';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roleBadgeVariant(role: Role): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'owner':
      return 'default';
    case 'admin':
      return 'secondary';
    default:
      return 'outline';
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0';
    case 'inactive':
      return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-0';
    case 'invited':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0';
    default:
      return '';
  }
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Virtual Assistant</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="hidden md:table-cell">Team</TableHead>
            <TableHead className="hidden lg:table-cell">Status</TableHead>
            <TableHead className="hidden lg:table-cell">Position</TableHead>
            <TableHead className="hidden xl:table-cell">Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-5 w-20 rounded-full" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Skeleton className="h-5 w-14 rounded-full" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Skeleton className="h-3.5 w-24" />
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                <Skeleton className="h-3.5 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EmployeesPage() {
  const router = useRouter();
  const { profile, orgId } = useSession();
  const supabase = createClient();

  // Data
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamNameMap, setTeamNameMap] = useState<Record<string, string>>({}); // profile_id -> team name
  const [teamIdMap, setTeamIdMap] = useState<Record<string, string>>({});     // profile_id -> team id
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Invitations
  const [invitations, setInvitations] = useState<EmployeeInvitation[]>([]);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviteTeamId, setInviteTeamId] = useState('none');
  const [invitePosition, setInvitePosition] = useState('');
  const [inviting, setInviting] = useState(false);

  // ---------- Fetch data ----------

  useEffect(() => {
    if (!orgId) return;

    async function fetchData() {
      setLoading(true);

      const [profilesRes, teamsRes, invitationsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('org_id', orgId!)
          .order('full_name'),
        supabase
          .from('teams')
          .select('id, name')
          .eq('org_id', orgId!)
          .order('name'),
        supabase
          .from('employee_invitations')
          .select('*')
          .eq('org_id', orgId!)
          .order('created_at', { ascending: false }),
      ]);

      const fetchedProfiles = profilesRes.data ?? [];
      const fetchedTeams = teamsRes.data ?? [];
      setEmployees(fetchedProfiles);
      setTeams(fetchedTeams);
      setInvitations(invitationsRes.data ?? []);

      // Build profile -> team mappings
      const nameMapping: Record<string, string> = {};
      const idMapping: Record<string, string> = {};

      if (fetchedTeams.length > 0) {
        const teamIds = fetchedTeams.map((t) => t.id);
        const { data: members } = await supabase
          .from('team_members')
          .select('profile_id, team_id')
          .in('team_id', teamIds);

        const teamNameLookup = new Map(fetchedTeams.map((t) => [t.id, t.name]));

        for (const tm of members ?? []) {
          const name = teamNameLookup.get(tm.team_id);
          if (name) {
            nameMapping[tm.profile_id] = name;
            idMapping[tm.profile_id] = tm.team_id;
          }
        }
      }

      setTeamNameMap(nameMapping);
      setTeamIdMap(idMapping);
      setLoading(false);
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // ---------- Filtered list ----------

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !emp.full_name.toLowerCase().includes(q) &&
          !emp.email.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (roleFilter !== 'all' && emp.role !== roleFilter) return false;
      if (teamFilter !== 'all' && teamIdMap[emp.id] !== teamFilter) return false;
      if (statusFilter !== 'all' && emp.status !== statusFilter) return false;
      return true;
    });
  }, [employees, search, roleFilter, teamFilter, statusFilter, teamIdMap]);

  // ---------- Invite handlers ----------

  function resetInviteForm() {
    setInviteEmail('');
    setInviteName('');
    setInviteRole('employee');
    setInviteTeamId('none');
    setInvitePosition('');
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !orgId || !profile) return;
    setInviting(true);

    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase.from('employee_invitations').insert({
        org_id: orgId,
        email: inviteEmail.trim(),
        full_name: inviteName.trim() || null,
        role: inviteRole as 'admin' | 'team_lead' | 'employee',
        team_id: inviteTeamId !== 'none' ? inviteTeamId : null,
        position: invitePosition.trim() || null,
        token,
        invited_by: profile.id,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      const acceptUrl = `${window.location.origin}/accept-invitation?token=${token}`;
      setLastInviteUrl(acceptUrl);
      setCopied(false);

      setInvitations((prev) => [{
        id: crypto.randomUUID(),
        org_id: orgId!,
        email: inviteEmail.trim(),
        full_name: inviteName.trim() || null,
        role: inviteRole as 'admin' | 'team_lead' | 'employee',
        team_id: inviteTeamId !== 'none' ? inviteTeamId : null,
        position: invitePosition.trim() || null,
        schedule_id: null,
        token,
        status: 'pending',
        invited_by: profile!.id,
        expires_at: expiresAt.toISOString(),
        accepted_at: null,
        created_at: new Date().toISOString(),
      }, ...prev]);

      toast.success(`Invitation created for ${inviteEmail}`);
      resetInviteForm();
    } catch {
      toast.error('Failed to create invitation. Please try again.');
    } finally {
      setInviting(false);
    }
  }

  function handleCopyLink() {
    if (!lastInviteUrl) return;
    navigator.clipboard.writeText(lastInviteUrl);
    setCopied(true);
    toast.success('Invite link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevokeInvite(inviteId: string) {
    const { error } = await supabase
      .from('employee_invitations')
      .update({ status: 'revoked' as const })
      .eq('id', inviteId);
    if (error) {
      toast.error('Failed to revoke invitation');
      return;
    }
    setInvitations((prev) =>
      prev.map((inv) => inv.id === inviteId ? { ...inv, status: 'revoked' as const } : inv)
    );
    toast.success('Invitation revoked');
  }

  // ---------- Render ----------

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Virtual Assistants</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your team members, roles, and invitations.
          </p>
        </div>
        <Button onClick={() => { setLastInviteUrl(null); setInviteOpen(true); }}>
          <UserPlus className="size-4" />
          Invite Virtual Assistant
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? 'all')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="team_lead">Team Lead</SelectItem>
              <SelectItem value="employee">Virtual Assistant</SelectItem>
            </SelectContent>
          </Select>

          <Select value={teamFilter} onValueChange={(v) => setTeamFilter(v ?? 'all')}>
            <SelectTrigger className="w-[140px]">
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
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Employee count */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {employees.length} virtual assistants
        </p>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Virtual Assistant</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Team</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Position</TableHead>
                <TableHead className="hidden xl:table-cell text-right">
                  Joined
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        {search ||
                        roleFilter !== 'all' ||
                        teamFilter !== 'all' ||
                        statusFilter !== 'all' ? (
                          <Search className="size-6 text-muted-foreground" />
                        ) : (
                          <Users className="size-6 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        No virtual assistants found
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {search ||
                        roleFilter !== 'all' ||
                        teamFilter !== 'all' ||
                        statusFilter !== 'all'
                          ? 'Try adjusting your search or filters.'
                          : 'Invite your first virtual assistant to get started.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/employees/${emp.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          {emp.avatar_url && (
                            <AvatarImage
                              src={emp.avatar_url}
                              alt={emp.full_name}
                            />
                          )}
                          <AvatarFallback>
                            {getInitials(emp.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {emp.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {emp.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={roleBadgeVariant(emp.role as Role)}
                        className="text-xs"
                      >
                        {ROLE_LABELS[emp.role as Role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {teamNameMap[emp.id] ? (
                        <Badge variant="outline" className="text-xs">
                          {teamNameMap[emp.id]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          --
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge
                        variant="outline"
                        className={statusBadgeClass(emp.status)}
                      >
                        {statusLabel(emp.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {emp.position ?? '--'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-right text-sm text-muted-foreground">
                      {formatDate(emp.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pending Invitations */}
      {invitations.filter((i) => i.status === 'pending').length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="size-4 text-amber-500" />
            Pending Invitations ({invitations.filter((i) => i.status === 'pending').length})
          </h2>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations
                  .filter((i) => i.status === 'pending')
                  .map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm">{inv.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.full_name || '--'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ROLE_LABELS[(inv.role) as Role] || inv.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {formatDate(inv.expires_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const url = `${window.location.origin}/accept-invitation?token=${inv.token}`;
                              navigator.clipboard.writeText(url);
                              toast.success('Invite link copied');
                            }}
                          >
                            <Link2 className="size-3.5" />
                            Copy Link
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRevokeInvite(inv.id)}
                          >
                            <XCircle className="size-3.5" />
                            Revoke
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* Invite Employee Dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) resetInviteForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Virtual Assistant</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="employee@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Full Name (optional)</Label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v ?? 'employee')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Virtual Assistant</SelectItem>
                  <SelectItem value="team_lead">Team Lead</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Team (optional)</Label>
              <Select value={inviteTeamId} onValueChange={(v) => setInviteTeamId(v ?? 'none')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-position">Position (optional)</Label>
              <Input
                id="invite-position"
                value={invitePosition}
                onChange={(e) => setInvitePosition(e.target.value)}
                placeholder="e.g. Frontend Developer"
              />
            </div>
          </div>

          {lastInviteUrl && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Check className="size-3.5" /> Invitation created! Share this link:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={lastInviteUrl}
                  className="text-xs font-mono flex-1"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button size="sm" variant="outline" onClick={handleCopyLink}>
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            {lastInviteUrl ? (
              <Button
                onClick={() => {
                  setInviteOpen(false);
                  setLastInviteUrl(null);
                  resetInviteForm();
                }}
              >
                Done
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setInviteOpen(false);
                    resetInviteForm();
                  }}
                  disabled={inviting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                >
                  <Mail className="size-4" />
                  {inviting ? 'Creating...' : 'Create Invitation'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
