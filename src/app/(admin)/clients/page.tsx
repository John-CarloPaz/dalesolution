'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Briefcase,
  Pencil,
  Trash2,
  Search,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Client, WorkSchedule } from '@/types/database';
import { toast } from 'sonner';

interface EmployeeOption {
  id: string;
  full_name: string;
}

type ScheduleOption = Pick<WorkSchedule, 'id' | 'name' | 'start_time' | 'end_time'>;

export default function ClientsPage() {
  const { profile, orgId } = useSession();
  const supabase = createClient();

  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('none');
  const [scheduleId, setScheduleId] = useState('none');
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const employeeNameMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e.full_name])),
    [employees]
  );
  const scheduleNameById = useMemo(
    () => new Map(schedules.map((s) => [s.id, s.name])),
    [schedules]
  );

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    const [clientsRes, profilesRes, schedulesRes] = await Promise.all([
      supabase
        .from('clients')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('full_name'),
      supabase
        .from('work_schedules')
        .select('id, name, start_time, end_time')
        .eq('org_id', orgId)
        .order('name'),
    ]);

    setClients(clientsRes.data ?? []);
    setEmployees((profilesRes.data as EmployeeOption[]) ?? []);
    setSchedules((schedulesRes.data as ScheduleOption[]) ?? []);

    setLoading(false);
  }, [orgId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false)
    );
  }, [clients, search]);

  function openCreate() {
    setEditing(null);
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setNotes('');
    setAssignedTo('none');
    setScheduleId('none');
    setDialogOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setName(client.name);
    setCompany(client.company ?? '');
    setEmail(client.email ?? '');
    setPhone(client.phone ?? '');
    setNotes(client.notes ?? '');
    setAssignedTo(client.assigned_to ?? 'none');
    setScheduleId(client.schedule_id ?? 'none');
    setDialogOpen(true);
  }

  // Assign a schedule to an employee: end any active assignment, then add the new one.
  // Returns an error message on failure, or null on success.
  async function assignScheduleToEmployee(
    profileId: string,
    newScheduleId: string
  ): Promise<string | null> {
    const today = new Date().toISOString().slice(0, 10); // date column

    // If this schedule is already the active one, nothing to do.
    const { data: current } = await supabase
      .from('schedule_assignments')
      .select('schedule_id')
      .eq('profile_id', profileId)
      .is('effective_until', null)
      .limit(1)
      .maybeSingle();

    if (current?.schedule_id === newScheduleId) return null;

    const { error: endError } = await supabase
      .from('schedule_assignments')
      .update({ effective_until: today })
      .eq('profile_id', profileId)
      .is('effective_until', null);

    if (endError) return endError.message;

    const { error: insertError } = await supabase
      .from('schedule_assignments')
      .insert({
        profile_id: profileId,
        schedule_id: newScheduleId,
        effective_from: today,
      });

    return insertError?.message ?? null;
  }

  async function handleSave() {
    if (!orgId || !name.trim()) return;
    setSaving(true);

    const resolvedAssignedTo = assignedTo !== 'none' ? assignedTo : null;
    const resolvedScheduleId = scheduleId !== 'none' ? scheduleId : null;

    const payload = {
      name: name.trim(),
      company: company.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      assigned_to: resolvedAssignedTo,
      schedule_id: resolvedScheduleId,
    };

    if (editing) {
      const { error } = await supabase
        .from('clients')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
      if (error) {
        toast.error('Failed to update client');
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from('clients').insert({
        org_id: orgId,
        ...payload,
      });
      if (error) {
        toast.error('Failed to create client');
        setSaving(false);
        return;
      }
    }

    // Propagate the client's schedule to the assigned employee
    if (resolvedAssignedTo && resolvedScheduleId) {
      const assignError = await assignScheduleToEmployee(resolvedAssignedTo, resolvedScheduleId);
      if (assignError) {
        toast.error(`Client saved, but schedule assignment failed: ${assignError}`);
      } else {
        toast.success(editing ? 'Client updated & schedule assigned' : 'Client added & schedule assigned');
      }
    } else {
      toast.success(editing ? 'Client updated' : 'Client added');
    }

    setSaving(false);
    setDialogOpen(false);
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) {
      toast.error('Failed to delete client');
      return;
    }
    toast.success('Client deleted');
    setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const isAdmin = profile?.role === 'owner' || profile?.role === 'admin';

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage clients and assign them to team members.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add Client
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24 ml-auto" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
              <Briefcase className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'No clients match your search' : 'No clients yet'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {search
                ? 'Try a different search term.'
                : 'Add your first client to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="hidden sm:table-cell">Schedule</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => {
                const assigneeName = client.assigned_to
                  ? employeeNameMap.get(client.assigned_to)
                  : null;
                const scheduleTag = client.schedule_id
                  ? scheduleNameById.get(client.schedule_id)
                  : null;

                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{client.name}</span>
                        {client.company && (
                          <span className="text-xs text-muted-foreground">
                            {client.company}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      <div className="flex flex-col">
                        {client.email && <span>{client.email}</span>}
                        {client.phone && <span>{client.phone}</span>}
                        {!client.email && !client.phone && <span>--</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {assigneeName ? (
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback className="text-[10px]">
                              {getInitials(assigneeName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{assigneeName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {scheduleTag ? (
                        <Badge variant="outline" className="text-xs gap-1">
                          <CalendarDays className="size-3" />
                          {scheduleTag}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge
                        variant="outline"
                        className={
                          client.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0'
                            : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-0'
                        }
                      >
                        {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => openEdit(client)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(client)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Client' : 'Add Client'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update client details and assignment.'
                : 'Create a new client and optionally assign them to an employee.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="client-name">Name</Label>
              <Input
                id="client-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Client name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-company">Company (optional)</Label>
              <Input
                id="client-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="client-email">Email (optional)</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-phone">Phone (optional)</Label>
                <Input
                  id="client-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Schedule</Label>
              <Select value={scheduleId} onValueChange={(v) => setScheduleId(v ?? 'none')}>
                <SelectTrigger className="w-full">
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
              {schedules.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No schedules exist yet — create one on the Schedules page.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v ?? 'none')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The selected schedule is also assigned to this employee.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-notes">Notes (optional)</Label>
              <Textarea
                id="client-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any relevant details..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? 'Save Changes' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteTarget?.name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} variant="destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
