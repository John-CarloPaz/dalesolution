'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/providers/supabase-provider';
import { useSession } from '@/hooks/use-session';
import { ROLE_LABELS } from '@/lib/constants/roles';
import { getInitials } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TIMEZONES } from '@/lib/constants/timezones';
import { Loader2, Save, User } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { supabase, profile, loading: authLoading } = useSupabase();
  const { role } = useSession();

  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [timezone, setTimezone] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setPosition(profile.position ?? '');
      setTimezone(profile.timezone ?? '');
    }
  }, [profile]);

  function handleChange(field: 'fullName' | 'position' | 'timezone', value: string) {
    setDirty(true);
    if (field === 'fullName') setFullName(value);
    if (field === 'position') setPosition(value);
    if (field === 'timezone') setTimezone(value);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        position: position.trim() || null,
        timezone: timezone.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    setSaving(false);

    if (error) {
      toast.error('Failed to save profile', {
        description: error.message,
      });
    } else {
      setDirty(false);
      toast.success('Profile updated successfully');
    }
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          View and update your information
        </p>
      </div>

      {/* Avatar + role card */}
      <Card>
        <CardContent className="flex items-center gap-4 py-5">
          <Avatar size="lg">
            {profile.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
            )}
            <AvatarFallback className="text-base">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium truncate">{profile.full_name}</p>
            <p className="text-sm text-muted-foreground truncate">
              {profile.email}
            </p>
          </div>
          <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>
        </CardContent>
      </Card>

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed here
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => handleChange('position', e.target.value)}
                placeholder="e.g. Virtual Assistant"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={timezone || undefined}
                onValueChange={(v) => handleChange('timezone', v ?? 'UTC')}
              >
                <SelectTrigger id="timezone" className="w-full">
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

            <Button
              type="submit"
              disabled={saving || !dirty}
              className="w-full h-10"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
