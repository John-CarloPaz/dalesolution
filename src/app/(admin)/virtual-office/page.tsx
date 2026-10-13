'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSupabase } from '@/providers/supabase-provider';
import { useRealtimeAttendance } from '@/hooks/use-realtime-attendance';
import { OfficeHeader } from '@/components/virtual-office/office-header';
import { OfficeSidebar } from '@/components/virtual-office/office-sidebar';
import { EmployeePanel } from '@/components/virtual-office/employee-panel';
import { OfficeFallback } from '@/components/virtual-office/office-fallback';
import { Skeleton } from '@/components/ui/skeleton';
import type { EmployeeWithState, OfficeZone } from '@/components/virtual-office/office-scene';
import { DEFAULT_ZONES } from '@/components/virtual-office/office-scene';
import type { AttendanceSession, Profile, Team } from '@/types/database';

const OfficeScene = dynamic(
  () => import('@/components/virtual-office/office-scene').then((m) => ({ default: m.OfficeScene })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Skeleton className="h-8 w-48 mx-auto" />
          <p className="text-sm text-muted-foreground">Loading 3D environment...</p>
        </div>
      </div>
    ),
  }
);

export default function VirtualOfficePage() {
  const { supabase, profile } = useSupabase();
  const [employees, setEmployees] = useState<EmployeeWithState[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [webglSupported, setWebglSupported] = useState(true);
  const [zones] = useState<OfficeZone[]>(DEFAULT_ZONES);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      setWebglSupported(!!gl);
    } catch {
      setWebglSupported(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    if (!profile?.org_id) return;

    const [profilesResult, sessionsResult, teamsResult, membersResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('org_id', profile.org_id)
        .eq('status', 'active'),
      supabase
        .from('attendance_sessions')
        .select('*')
        .eq('org_id', profile.org_id)
        .in('state', ['clocked_in', 'on_break']),
      supabase
        .from('teams')
        .select('*')
        .eq('org_id', profile.org_id),
      supabase
        .from('team_members')
        .select('*'),
    ]);

    const profiles = profilesResult.data || [];
    const sessions = sessionsResult.data || [];
    const teams = teamsResult.data || [];
    const members = membersResult.data || [];

    const sessionByProfile = new Map<string, AttendanceSession>();
    sessions.forEach((s) => sessionByProfile.set(s.profile_id, s));

    const teamByProfile = new Map<string, { name: string; color: string }>();
    members.forEach((m) => {
      const team = teams.find((t) => t.id === m.team_id);
      if (team) teamByProfile.set(m.profile_id, { name: team.name, color: team.color });
    });

    const zoneAssignments = assignDesks(profiles, teamByProfile, zones);

    const result: EmployeeWithState[] = profiles.map((p) => ({
      profile: p,
      session: sessionByProfile.get(p.id) || null,
      team: teamByProfile.get(p.id),
      deskPosition: zoneAssignments.get(p.id) || [0, 0, 0],
    }));

    setEmployees(result);
    setLoading(false);
  }, [supabase, profile?.org_id, zones]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleSessionChange = useCallback((session: AttendanceSession) => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.profile.id === session.profile_id
          ? { ...emp, session: session.state === 'clocked_out' ? null : session }
          : emp
      )
    );
  }, []);

  const { connected, lastSync } = useRealtimeAttendance({
    orgId: profile?.org_id,
    onSessionChange: handleSessionChange,
  });

  const workingCount = employees.filter((e) => e.session?.state === 'clocked_in').length;
  const breakCount = employees.filter((e) => e.session?.state === 'on_break').length;
  const exceptionCount = employees.filter((e) => e.session?.is_late).length;

  const handleSelectEmployee = useCallback((emp: EmployeeWithState) => {
    setSelectedEmployee((prev) => (prev?.profile.id === emp.profile.id ? null : emp));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
          <p className="text-sm text-muted-foreground">Loading virtual office...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <OfficeHeader
        workingCount={workingCount}
        breakCount={breakCount}
        exceptionCount={exceptionCount}
        connected={connected}
        lastSync={lastSync}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onResetCamera={() => {}}
      />

      <div className="flex flex-1 overflow-hidden">
        <OfficeSidebar
          employees={employees}
          onSelectEmployee={handleSelectEmployee}
          selectedEmployeeId={selectedEmployee?.profile.id || null}
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className="flex-1 relative">
          {webglSupported ? (
            <OfficeScene
              employees={employees}
              onSelectEmployee={handleSelectEmployee}
              selectedEmployeeId={selectedEmployee?.profile.id || null}
              zones={zones}
            />
          ) : (
            <OfficeFallback employees={employees} reason="webgl" />
          )}

          {selectedEmployee && (
            <div className="absolute top-4 right-4 z-10">
              <EmployeePanel
                employee={selectedEmployee}
                onClose={() => setSelectedEmployee(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function assignDesks(
  profiles: Profile[],
  teamMap: Map<string, { name: string; color: string }>,
  zones: OfficeZone[]
): Map<string, [number, number, number]> {
  const assignments = new Map<string, [number, number, number]>();
  const zoneCounters = new Map<string, number>();

  const teamToZone: Record<string, string> = {};
  const zoneByName: Record<string, OfficeZone> = {};
  zones.forEach((z) => (zoneByName[z.id] = z));

  profiles.forEach((p, idx) => {
    const team = teamMap.get(p.id);
    let zone = zoneByName['workspace'];

    if (team) {
      const teamName = team.name.toLowerCase();
      if (teamName.includes('market') || teamName.includes('sales')) {
        zone = zoneByName['operations'] || zone;
      } else if (teamName.includes('dev') || teamName.includes('auto') || teamName.includes('tech')) {
        zone = zoneByName['dev'] || zone;
      } else if (teamName.includes('client') || teamName.includes('support') || teamName.includes('service')) {
        zone = zoneByName['client'] || zone;
      } else if (teamName.includes('ops') || teamName.includes('admin')) {
        zone = zoneByName['operations'] || zone;
      }
    }

    const count = zoneCounters.get(zone.id) || 0;
    zoneCounters.set(zone.id, count + 1);

    const cols = Math.floor(zone.size[0] / 2.5);
    const row = Math.floor(count / Math.max(cols, 1));
    const col = count % Math.max(cols, 1);

    const x = zone.position[0] - zone.size[0] / 2 + 1.5 + col * 2.5;
    const z2 = zone.position[2] - zone.size[1] / 2 + 1.5 + row * 2.5;

    assignments.set(p.id, [x, 0, z2]);
  });

  return assignments;
}
