'use client';

import { useState, useEffect } from 'react';
import { Users, Coffee, AlertTriangle, Wifi, WifiOff, RotateCcw, Sidebar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface OfficeHeaderProps {
  workingCount: number;
  breakCount: number;
  exceptionCount: number;
  connected: boolean;
  lastSync: Date;
  onToggleSidebar: () => void;
  onResetCamera: () => void;
}

export function OfficeHeader({
  workingCount,
  breakCount,
  exceptionCount,
  connected,
  lastSync,
  onToggleSidebar,
  onResetCamera,
}: OfficeHeaderProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-12 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center px-4 gap-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onToggleSidebar}
      >
        <Sidebar className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">DS</span>
        </div>
        <span className="font-semibold text-sm hidden sm:inline">Virtual Office</span>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <span className="text-xs text-muted-foreground hidden md:inline">
        {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        {' '}
        {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
      </span>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <StatBadge
          icon={<Users className="h-3 w-3" />}
          value={workingCount}
          label="Working"
          color="text-emerald-500"
        />
        <StatBadge
          icon={<Coffee className="h-3 w-3" />}
          value={breakCount}
          label="On Break"
          color="text-amber-500"
        />
        {exceptionCount > 0 && (
          <StatBadge
            icon={<AlertTriangle className="h-3 w-3" />}
            value={exceptionCount}
            label="Exceptions"
            color="text-destructive"
          />
        )}
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className={cn(
        'flex items-center gap-1.5 text-xs',
        connected ? 'text-emerald-500' : 'text-destructive'
      )}>
        {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        <span className="hidden sm:inline">{connected ? 'Live' : 'Disconnected'}</span>
      </div>

      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onResetCamera}>
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function StatBadge({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className={cn('flex items-center gap-1.5 text-xs', color)}>
      {icon}
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground hidden lg:inline">{label}</span>
    </div>
  );
}
