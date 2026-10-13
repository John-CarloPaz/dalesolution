'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/providers/supabase-provider';
import { cn } from 'cn';
import { toast } from 'sonner';
import {
  Plus,
  Users,
  UserCircle,
  Palette,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { Profile, Team } from '@/types/database';

// -- Preset color palette
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

interface TeamWithMeta {
  team: Team;
  memberCount: number;
  leadName: string | null;
}

export default function TeamsPage() {
  const router = useRouter();
  const { supabase, profile } = useSupabase();
  const [teams, setTeams] = useState<TeamWithMeta[]>([]);
  const [orgProfiles, setOrgProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // -- Form state
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(PRESET_COLORS[5].value);
  const [newLeadId, setNewLeadId] = useState<string>('none');

  const fetchTeams = useCallback(async () => {
    if (!profile?.org_id) return;

    const teamsResult = await supabase
      .from('teams')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false });

    const membersResult = await supabase
      .from('team_members')
      .select('*');

    const profilesResult = await supabase
      .from('profiles')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('status', 'active');

    const allTeams = (teamsResult.data ?? []) as Team[];
    const allMembers = (membersResult.data ?? []) as { id: string; team_id: string; profile_id: string; joined_at: string }[];
    const allProfiles = (profilesResult.data ?? []) as Profile[];

    setOrgProfiles(allProfiles);

    // Count members per team
    const countMap = new Map<string, number>();
    allMembers.forEach((m) => {
      countMap.set(m.team_id, (countMap.get(m.team_id) ?? 0) + 1);
    });

    // Map lead names
    const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

    const enriched: TeamWithMeta[] = allTeams.map((t) => ({
      team: t,
      memberCount: countMap.get(t.id) ?? 0,
      leadName: t.lead_id ? profileMap.get(t.lead_id)?.full_name ?? null : null,
    }));

    setTeams(enriched);
    setLoading(false);
  }, [supabase, profile?.org_id]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleCreate = async () => {
    if (!profile?.org_id || !newName.trim()) return;

    setCreating(true);
    const { error } = await (supabase.from('teams') as any).insert({
      org_id: profile.org_id,
      name: newName.trim(),
      color: newColor,
      lead_id: newLeadId === 'none' ? null : newLeadId,
    });

    if (error) {
      toast.error('Failed to create team', { description: error.message });
      setCreating(false);
      return;
    }

    toast.success('Team created successfully');
    setCreateOpen(false);
    setNewName('');
    setNewColor(PRESET_COLORS[5].value);
    setNewLeadId('none');
    setCreating(false);
    fetchTeams();
  };

  const resetForm = () => {
    setNewName('');
    setNewColor(PRESET_COLORS[5].value);
    setNewLeadId('none');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize your workforce into teams and assign leads.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          size="sm"
        >
          <Plus className="size-4 mr-1.5" />
          Create Team
        </Button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-3 mt-1.5 rounded-full shrink-0" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-32" />
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && teams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold">No teams yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create your first team to organize employees, assign leads, and track attendance by group.
          </p>
          <Button
            className="mt-4"
            size="sm"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4 mr-1.5" />
            Create Team
          </Button>
        </div>
      )}

      {/* Teams grid */}
      {!loading && teams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(({ team, memberCount, leadName }) => (
            <Card
              key={team.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => router.push('/teams/' + team.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1.5 size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">
                      {team.name}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="size-3.5" />
                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                      </span>
                      {leadName && (
                        <span className="flex items-center gap-1 truncate">
                          <UserCircle className="size-3.5 shrink-0" />
                          <span className="truncate">{leadName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>
              Add a new team to your organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                placeholder="e.g. Engineering"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewColor(c.value)}
                    className={cn(
                      'size-7 rounded-full transition-all ring-offset-background',
                      newColor === c.value
                        ? 'ring-2 ring-ring ring-offset-2'
                        : 'hover:scale-110'
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Lead select */}
            <div className="space-y-2">
              <Label>Team Lead (optional)</Label>
              <Select value={newLeadId} onValueChange={(v) => setNewLeadId(v ?? 'none')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No lead</SelectItem>
                  {orgProfiles.map((p) => (
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
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
