'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from 'cn';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/hooks/use-session';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { Json, Database } from '@/types/database';
import {
  Settings,
  Globe,
  Clock,
  Bell,
  Webhook,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// -- Types

interface OrgSettings {
  attendance?: {
    gracePeriodMinutes?: number;
    breakDurationMinutes?: number;
    autoClockOut?: boolean;
    autoClockOutAfterHours?: number;
  };
  notifications?: {
    emailEnabled?: boolean;
    notifyLateArrival?: boolean;
    notifyCorrection?: boolean;
    notifyEmployeeJoined?: boolean;
  };
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  settings: OrgSettings;
}

interface WebhookEndpoint {
  id: string;
  org_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
];

const WEBHOOK_EVENTS = [
  { value: 'attendance.clock_in', label: 'Clock In' },
  { value: 'attendance.clock_out', label: 'Clock Out' },
  { value: 'attendance.break', label: 'Break' },
  { value: 'correction.created', label: 'Correction Created' },
  { value: 'correction.reviewed', label: 'Correction Reviewed' },
  { value: 'employee.invited', label: 'Virtual Assistant Invited' },
  { value: 'employee.joined', label: 'Virtual Assistant Joined' },
];

// -- Loading skeleton

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full max-w-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

// -- General Settings Tab

function GeneralTab({
  org,
  onSave,
}: {
  org: Organization;
  onSave: (updates: Partial<Organization>) => Promise<void>;
}) {
  const [name, setName] = useState(org.name);
  const [timezone, setTimezone] = useState(org.timezone);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ name, timezone });
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="size-4" />
          General Settings
        </CardTitle>
        <CardDescription>
          Basic organization information and preferences.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="org-name">Organization Name</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select value={timezone} onValueChange={(v) => setTimezone(v ?? 'UTC')}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
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

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

// -- Attendance Settings Tab

function AttendanceTab({
  settings,
  onSave,
}: {
  settings: OrgSettings;
  onSave: (settings: OrgSettings) => Promise<void>;
}) {
  const att = settings.attendance ?? {};
  const [gracePeriod, setGracePeriod] = useState(att.gracePeriodMinutes ?? 5);
  const [breakDuration, setBreakDuration] = useState(att.breakDurationMinutes ?? 30);
  const [autoClockOut, setAutoClockOut] = useState(att.autoClockOut ?? false);
  const [autoClockOutHours, setAutoClockOutHours] = useState(att.autoClockOutAfterHours ?? 12);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      ...settings,
      attendance: {
        gracePeriodMinutes: gracePeriod,
        breakDurationMinutes: breakDuration,
        autoClockOut,
        autoClockOutAfterHours: autoClockOutHours,
      },
    });
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="size-4" />
          Attendance Settings
        </CardTitle>
        <CardDescription>
          Configure how attendance tracking works for your team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="grace-period">Grace Period (minutes)</Label>
          <Input
            id="grace-period"
            type="number"
            min={0}
            max={60}
            value={gracePeriod}
            onChange={(e) => setGracePeriod(Number(e.target.value))}
            className="w-24"
          />
          <p className="text-xs text-muted-foreground">
            Minutes after shift start before an arrival is marked late.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="break-duration">Default Break Duration (minutes)</Label>
          <Input
            id="break-duration"
            type="number"
            min={0}
            max={120}
            value={breakDuration}
            onChange={(e) => setBreakDuration(Number(e.target.value))}
            className="w-24"
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between max-w-sm">
          <div className="space-y-0.5">
            <Label>Auto Clock-Out</Label>
            <p className="text-xs text-muted-foreground">
              Automatically clock out virtual assistants after a set time.
            </p>
          </div>
          <Switch checked={autoClockOut} onCheckedChange={setAutoClockOut} />
        </div>

        {autoClockOut && (
          <div className="space-y-2 pl-0">
            <Label htmlFor="auto-clockout-hours">Auto Clock-Out After (hours)</Label>
            <Input
              id="auto-clockout-hours"
              type="number"
              min={1}
              max={24}
              value={autoClockOutHours}
              onChange={(e) => setAutoClockOutHours(Number(e.target.value))}
              className="w-24"
            />
          </div>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

// -- Notifications Settings Tab

function NotificationsTab({
  settings,
  onSave,
}: {
  settings: OrgSettings;
  onSave: (settings: OrgSettings) => Promise<void>;
}) {
  const notif = settings.notifications ?? {};
  const [emailEnabled, setEmailEnabled] = useState(notif.emailEnabled ?? true);
  const [notifyLate, setNotifyLate] = useState(notif.notifyLateArrival ?? true);
  const [notifyCorrection, setNotifyCorrection] = useState(notif.notifyCorrection ?? true);
  const [notifyJoined, setNotifyJoined] = useState(notif.notifyEmployeeJoined ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      ...settings,
      notifications: {
        emailEnabled,
        notifyLateArrival: notifyLate,
        notifyCorrection,
        notifyEmployeeJoined: notifyJoined,
      },
    });
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="size-4" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose which events trigger notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between max-w-sm">
          <div className="space-y-0.5">
            <Label>Email Notifications</Label>
            <p className="text-xs text-muted-foreground">
              Send notifications via email.
            </p>
          </div>
          <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
        </div>

        <Separator />

        <div className="flex items-center justify-between max-w-sm">
          <div className="space-y-0.5">
            <Label>Late Arrival</Label>
            <p className="text-xs text-muted-foreground">
              Notify when a virtual assistant arrives late.
            </p>
          </div>
          <Switch checked={notifyLate} onCheckedChange={setNotifyLate} />
        </div>

        <div className="flex items-center justify-between max-w-sm">
          <div className="space-y-0.5">
            <Label>Correction Request</Label>
            <p className="text-xs text-muted-foreground">
              Notify when a correction request is submitted.
            </p>
          </div>
          <Switch checked={notifyCorrection} onCheckedChange={setNotifyCorrection} />
        </div>

        <div className="flex items-center justify-between max-w-sm">
          <div className="space-y-0.5">
            <Label>Virtual Assistant Joined</Label>
            <p className="text-xs text-muted-foreground">
              Notify when a new virtual assistant joins the organization.
            </p>
          </div>
          <Switch checked={notifyJoined} onCheckedChange={setNotifyJoined} />
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

// -- Webhooks Tab

function WebhooksTab({ orgId }: { orgId: string }) {
  const supabase = createClient();

  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    setWebhooks((data as WebhookEndpoint[]) ?? []);
    setLoading(false);
  }, [orgId, supabase]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const toggleEventSelection = (event: string) => {
    setNewEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  };

  const createWebhook = async () => {
    if (!newUrl.trim()) {
      toast.error('Please enter a webhook URL');
      return;
    }
    if (newEvents.length === 0) {
      toast.error('Please select at least one event');
      return;
    }

    setCreating(true);

    // Generate a simple secret
    const secret = crypto.randomUUID();

    const { error } = await supabase.from('webhook_endpoints').insert({
      org_id: orgId,
      url: newUrl.trim(),
      secret,
      events: newEvents,
      is_active: true,
    });

    if (error) {
      toast.error('Failed to create webhook');
      setCreating(false);
      return;
    }

    toast.success('Webhook created');
    setDialogOpen(false);
    setNewUrl('');
    setNewEvents([]);
    setCreating(false);
    fetchWebhooks();
  };

  const deleteWebhook = async (id: string) => {
    const { error } = await supabase
      .from('webhook_endpoints')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete webhook');
      return;
    }

    toast.success('Webhook deleted');
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('webhook_endpoints')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update webhook');
      return;
    }

    setWebhooks((prev) =>
      prev.map((w) => (w.id === id ? { ...w, is_active: isActive } : w))
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="size-4" />
              Webhook Endpoints
            </CardTitle>
            <CardDescription className="mt-1">
              Send real-time event data to external services.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            Add Webhook
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-24 ml-auto" />
              </div>
            ))}
          </div>
        ) : webhooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
              <Webhook className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No webhooks configured
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add a webhook to receive real-time event notifications.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate">
                    {webhook.url}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map((event) => (
                        <Badge
                          key={event}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {event.split('.').pop()}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={webhook.is_active}
                      onCheckedChange={(checked) =>
                        toggleActive(webhook.id, checked as boolean)
                      }
                      size="sm"
                    />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {formatDateTime(webhook.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => deleteWebhook(webhook.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add Webhook Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Enter the URL and select which events to subscribe to.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://example.com/webhook"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid grid-cols-1 gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <label
                    key={event.value}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                      newEvents.includes(event.value)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={newEvents.includes(event.value)}
                      onChange={() => toggleEventSelection(event.value)}
                      className="size-4 rounded border-border"
                    />
                    <span className="text-sm">{event.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto font-mono">
                      {event.value}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={createWebhook} disabled={creating}>
              {creating && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// -- Main Settings Page

export default function SettingsPage() {
  const { orgId } = useSession();
  const supabase = createClient();

  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrg = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (data) {
      setOrg({
        ...data,
        settings: (data.settings as OrgSettings) ?? {},
      } as Organization);
    }
    setLoading(false);
  }, [orgId, supabase]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const saveOrgFields = async (updates: Partial<Organization>) => {
    if (!orgId) return;

    const { error } = await supabase
      .from('organizations')
      .update(updates as Database['public']['Tables']['organizations']['Update'])
      .eq('id', orgId);

    if (error) {
      toast.error('Failed to save settings');
      return;
    }

    setOrg((prev) => (prev ? { ...prev, ...updates } : prev));
    toast.success('Settings saved');
  };

  const saveOrgSettings = async (settings: OrgSettings) => {
    if (!orgId) return;

    const { error } = await supabase
      .from('organizations')
      .update({ settings: settings as unknown as Json })
      .eq('id', orgId);

    if (error) {
      toast.error('Failed to save settings');
      return;
    }

    setOrg((prev) => (prev ? { ...prev, settings } : prev));
    toast.success('Settings saved');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your organization preferences and integrations.
        </p>
      </div>

      {loading || !org ? (
        <SettingsSkeleton />
      ) : (
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralTab org={org} onSave={saveOrgFields} />
          </TabsContent>

          <TabsContent value="attendance">
            <AttendanceTab settings={org.settings} onSave={saveOrgSettings} />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsTab settings={org.settings} onSave={saveOrgSettings} />
          </TabsContent>

          <TabsContent value="webhooks">
            <WebhooksTab orgId={org.id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
