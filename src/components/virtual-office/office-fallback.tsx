'use client';

import { AlertTriangle, Users, Clock, Coffee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { ATTENDANCE_STATE_LABELS } from '@/lib/constants/attendance-states';
import type { EmployeeWithState } from './office-scene';

interface OfficeFallbackProps {
  employees: EmployeeWithState[];
  reason: 'webgl' | 'error' | 'loading';
}

export function OfficeFallback({ employees, reason }: OfficeFallbackProps) {
  const working = employees.filter((e) => e.session?.state === 'clocked_in');
  const onBreak = employees.filter((e) => e.session?.state === 'on_break');
  const offline = employees.filter((e) => !e.session || e.session.state === 'clocked_out');

  return (
    <div className="flex-1 p-6 overflow-auto">
      {reason === 'webgl' && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>3D view is unavailable on this device. Showing list view instead.</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard icon={<Users />} label="Working" count={working.length} color="text-emerald-500" />
        <StatCard icon={<Coffee />} label="On Break" count={onBreak.length} color="text-amber-500" />
        <StatCard icon={<Clock />} label="Offline" count={offline.length} color="text-muted-foreground" />
      </div>

      {working.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-emerald-500">Currently Working</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {working.map((emp) => (
              <EmployeeCard key={emp.profile.id} employee={emp} />
            ))}
          </div>
        </div>
      )}

      {onBreak.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-amber-500">On Break</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {onBreak.map((emp) => (
              <EmployeeCard key={emp.profile.id} employee={emp} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, count, color }: { icon: React.ReactNode; label: string; count: number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={color}>{icon}</div>
        <div>
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeCard({ employee }: { employee: EmployeeWithState }) {
  const { profile, session, team } = employee;
  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {getInitials(profile.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{profile.full_name}</p>
          <p className="text-xs text-muted-foreground">{team?.name || 'Unassigned'}</p>
        </div>
        {session && (
          <Badge variant="outline" className="text-xs shrink-0">
            {ATTENDANCE_STATE_LABELS[session.state]}
          </Badge>
        )}
      </div>
    </Card>
  );
}
