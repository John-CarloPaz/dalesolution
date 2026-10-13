'use client';

import { X, Clock, Coffee, Calendar, MapPin, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { formatTime, formatDuration, getInitials } from '@/lib/utils';
import { ATTENDANCE_STATE_LABELS } from '@/lib/constants/attendance-states';
import type { EmployeeWithState } from './office-scene';
import Link from 'next/link';

interface EmployeePanelProps {
  employee: EmployeeWithState;
  onClose: () => void;
}

export function EmployeePanel({ employee, onClose }: EmployeePanelProps) {
  const { profile, session, team } = employee;
  const state = session?.state;

  const statusColor = state === 'clocked_in'
    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    : state === 'on_break'
    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    : 'bg-muted text-muted-foreground';

  const elapsedMinutes = session
    ? Math.round((Date.now() - new Date(session.clock_in_at).getTime()) / 60000)
    : 0;

  return (
    <Card className="w-80 border-border/50 bg-card/95 backdrop-blur-sm shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{profile.full_name}</CardTitle>
              <p className="text-sm text-muted-foreground">{profile.position || profile.role}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge variant="outline" className={statusColor}>
            {state ? ATTENDANCE_STATE_LABELS[state] || state : 'Offline'}
          </Badge>
        </div>

        {team && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Team</span>
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="text-sm">{team.name}</span>
            </div>
          </div>
        )}

        {session && (
          <>
            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Clocked in:</span>
                <span>{formatTime(session.clock_in_at)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Duration:</span>
                <span>{formatDuration(elapsedMinutes)}</span>
              </div>

              {session.total_break_minutes > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Coffee className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Breaks:</span>
                  <span>{formatDuration(session.total_break_minutes)}</span>
                </div>
              )}

              {session.is_late && (
                <div className="flex items-center gap-2 text-sm text-amber-500">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Late arrival</span>
                </div>
              )}
            </div>
          </>
        )}

        <Separator />

        <Link href={`/employees/${profile.id}`}>
          <Button variant="outline" size="sm" className="w-full">
            View Full Profile
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
