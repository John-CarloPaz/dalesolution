'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSupabase } from '@/providers/supabase-provider';
import type { WorkSchedule } from '@/types/database';
import { toast } from 'sonner';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SchedulesPage() {
  const { supabase, profile } = useSupabase();
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [gracePeriod, setGracePeriod] = useState(15);
  const [breakDuration, setBreakDuration] = useState(60);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  async function fetchSchedules() {
    if (!profile?.org_id) return;
    const { data } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false });
    setSchedules(data || []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!profile?.org_id || !name.trim()) return;
    setSaving(true);

    const { error } = await supabase.from('work_schedules').insert({
      org_id: profile.org_id,
      name: name.trim(),
      start_time: startTime,
      end_time: endTime,
      grace_period_minutes: gracePeriod,
      break_duration_minutes: breakDuration,
      days_of_week: selectedDays,
      is_default: isDefault,
    });

    if (error) {
      toast.error('Failed to create schedule');
    } else {
      toast.success('Schedule created');
      setDialogOpen(false);
      resetForm();
      fetchSchedules();
    }
    setSaving(false);
  }

  function resetForm() {
    setName('');
    setStartTime('09:00');
    setEndTime('17:00');
    setGracePeriod(15);
    setBreakDuration(60);
    setSelectedDays([1, 2, 3, 4, 5]);
    setIsDefault(false);
  }

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  if (loading) {
    return <div className="p-6"><p className="text-muted-foreground">Loading schedules...</p></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedules</h1>
          <p className="text-muted-foreground text-sm">Manage work schedules and shift templates</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" />New Schedule</Button>} />
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Schedule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Schedule Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Standard Shift" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Grace Period (min)</Label>
                  <Input type="number" value={gracePeriod} onChange={(e) => setGracePeriod(Number(e.target.value))} min={0} max={60} />
                </div>
                <div>
                  <Label>Break Duration (min)</Label>
                  <Input type="number" value={breakDuration} onChange={(e) => setBreakDuration(Number(e.target.value))} min={0} max={120} />
                </div>
              </div>
              <div>
                <Label>Work Days</Label>
                <div className="flex gap-1 mt-2">
                  {DAYS.map((day, i) => (
                    <Button
                      key={day}
                      variant={selectedDays.includes(i) ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => toggleDay(i)}
                    >
                      {day[0]}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                <Label>Set as default schedule</Label>
              </div>
              <Button onClick={handleCreate} disabled={saving || !name.trim()} className="w-full">
                {saving ? 'Creating...' : 'Create Schedule'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No schedules yet</p>
            <p className="text-sm text-muted-foreground">Create your first work schedule to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{schedule.name}</CardTitle>
                  {schedule.is_default && <Badge variant="secondary">Default</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{schedule.start_time} — {schedule.end_time}</span>
                </div>
                <div className="flex gap-1">
                  {DAYS.map((day, i) => (
                    <span
                      key={day}
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                        schedule.days_of_week.includes(i)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {day[0]}
                    </span>
                  ))}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Grace: {schedule.grace_period_minutes}m</span>
                  <span>Break: {schedule.break_duration_minutes}m</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
