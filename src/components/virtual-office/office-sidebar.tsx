'use client';

import { useState, useMemo } from 'react';
import { Search, Users, ChevronDown, ChevronRight, Circle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn, getInitials } from '@/lib/utils';
import type { EmployeeWithState } from './office-scene';

interface OfficeSidebarProps {
  employees: EmployeeWithState[];
  onSelectEmployee: (employee: EmployeeWithState) => void;
  selectedEmployeeId: string | null;
  collapsed: boolean;
  onToggle: () => void;
}

export function OfficeSidebar({
  employees,
  onSelectEmployee,
  selectedEmployeeId,
  collapsed,
  onToggle,
}: OfficeSidebarProps) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const teams = useMemo(() => {
    const teamMap = new Map<string, { name: string; color: string; members: EmployeeWithState[] }>();
    const unassigned: EmployeeWithState[] = [];

    employees.forEach((emp) => {
      if (emp.team) {
        const existing = teamMap.get(emp.team.name) || { name: emp.team.name, color: emp.team.color, members: [] };
        existing.members.push(emp);
        teamMap.set(emp.team.name, existing);
      } else {
        unassigned.push(emp);
      }
    });

    return { teams: Array.from(teamMap.values()), unassigned };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (search && !emp.profile.full_name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (teamFilter && emp.team?.name !== teamFilter) return false;
      if (statusFilter) {
        const state = emp.session?.state || 'offline';
        if (statusFilter !== state) return false;
      }
      return true;
    });
  }, [employees, search, teamFilter, statusFilter]);

  const workingCount = employees.filter((e) => e.session?.state === 'clocked_in').length;
  const breakCount = employees.filter((e) => e.session?.state === 'on_break').length;
  const offlineCount = employees.filter((e) => !e.session || e.session.state === 'clocked_out').length;

  if (collapsed) return null;

  const toggleTeam = (name: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="w-72 border-r border-border/50 bg-card/50 backdrop-blur-sm flex flex-col h-full">
      <div className="p-3 border-b border-border/50">
        <h3 className="font-semibold text-sm mb-2">Organization</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-1 mt-2">
          <StatusFilter
            label="Working"
            count={workingCount}
            color="bg-emerald-500"
            active={statusFilter === 'clocked_in'}
            onClick={() => setStatusFilter(statusFilter === 'clocked_in' ? null : 'clocked_in')}
          />
          <StatusFilter
            label="Break"
            count={breakCount}
            color="bg-amber-500"
            active={statusFilter === 'on_break'}
            onClick={() => setStatusFilter(statusFilter === 'on_break' ? null : 'on_break')}
          />
          <StatusFilter
            label="Offline"
            count={offlineCount}
            color="bg-slate-500"
            active={statusFilter === 'offline'}
            onClick={() => setStatusFilter(statusFilter === 'offline' ? null : 'offline')}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {teams.teams.map((team) => (
            <div key={team.name} className="mb-1">
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent/50 transition-colors"
                onClick={() => toggleTeam(team.name)}
              >
                {expandedTeams.has(team.name) ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                <span className="font-medium">{team.name}</span>
                <Badge variant="secondary" className="ml-auto h-5 text-xs px-1.5">
                  {team.members.filter((m) => m.session?.state === 'clocked_in' || m.session?.state === 'on_break').length}/{team.members.length}
                </Badge>
              </button>

              {expandedTeams.has(team.name) && (
                <div className="ml-4 space-y-0.5">
                  {team.members
                    .filter((m) => {
                      if (search && !m.profile.full_name.toLowerCase().includes(search.toLowerCase())) return false;
                      if (statusFilter) {
                        const state = m.session?.state || 'offline';
                        if (statusFilter !== state) return false;
                      }
                      return true;
                    })
                    .map((emp) => (
                      <EmployeeRow
                        key={emp.profile.id}
                        employee={emp}
                        isSelected={emp.profile.id === selectedEmployeeId}
                        onClick={() => onSelectEmployee(emp)}
                      />
                    ))}
                </div>
              )}
            </div>
          ))}

          {teams.unassigned.length > 0 && (
            <div className="mt-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Unassigned
              </p>
              {teams.unassigned
                .filter((m) => {
                  if (search && !m.profile.full_name.toLowerCase().includes(search.toLowerCase())) return false;
                  return true;
                })
                .map((emp) => (
                  <EmployeeRow
                    key={emp.profile.id}
                    employee={emp}
                    isSelected={emp.profile.id === selectedEmployeeId}
                    onClick={() => onSelectEmployee(emp)}
                  />
                ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function StatusFilter({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-muted-foreground'
      )}
      onClick={onClick}
    >
      <div className={cn('h-1.5 w-1.5 rounded-full', color)} />
      <span>{count}</span>
    </button>
  );
}

function EmployeeRow({
  employee,
  isSelected,
  onClick,
}: {
  employee: EmployeeWithState;
  isSelected: boolean;
  onClick: () => void;
}) {
  const state = employee.session?.state;
  const statusColor = state === 'clocked_in'
    ? 'text-emerald-500'
    : state === 'on_break'
    ? 'text-amber-500'
    : 'text-slate-500';

  const statusLabel = state === 'clocked_in'
    ? 'Working'
    : state === 'on_break'
    ? 'On Break'
    : 'Offline';

  return (
    <button
      className={cn(
        'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors',
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-accent/50'
      )}
      onClick={onClick}
    >
      <Avatar className="h-6 w-6">
        <AvatarFallback className="text-[10px] bg-muted">
          {getInitials(employee.profile.full_name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate flex-1 text-left">{employee.profile.full_name}</span>
      <Circle className={cn('h-2 w-2 fill-current', statusColor)} />
    </button>
  );
}
