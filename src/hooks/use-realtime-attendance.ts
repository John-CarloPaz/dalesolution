'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSupabase } from '@/providers/supabase-provider';
import type { AttendanceSession } from '@/types/database';

interface RealtimeOptions {
  orgId?: string;
  onSessionChange?: (session: AttendanceSession) => void;
}

export function useRealtimeAttendance({ orgId, onSessionChange }: RealtimeOptions) {
  const { supabase } = useSupabase();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  const subscribe = useCallback(() => {
    if (!orgId) return;

    channelRef.current?.unsubscribe();

    const channel = supabase
      .channel(`attendance-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_sessions',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const session = (payload.new ?? payload.old) as AttendanceSession;
          onSessionChange?.(session);
          setLastSync(new Date());
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;
  }, [supabase, orgId, onSessionChange]);

  useEffect(() => {
    subscribe();
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [subscribe]);

  return { connected, lastSync };
}
