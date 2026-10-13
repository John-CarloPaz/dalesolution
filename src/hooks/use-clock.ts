'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSupabase } from '@/providers/supabase-provider';
import type { AttendanceSession, AttendanceBreak } from '@/types/database';
import type { AttendanceState } from '@/lib/constants/attendance-states';

interface ClockState {
  activeSession: AttendanceSession | null;
  activeBreak: AttendanceBreak | null;
  attendanceState: AttendanceState;
  loading: boolean;
  error: string | null;
  elapsedMinutes: number;
}

export function useClock() {
  const { supabase, user, profile } = useSupabase();
  const [state, setState] = useState<ClockState>({
    activeSession: null,
    activeBreak: null,
    attendanceState: 'not_started',
    loading: true,
    error: null,
    elapsedMinutes: 0,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchActiveSession = useCallback(async () => {
    if (!user) return;

    const { data: session } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('profile_id', user.id)
      .in('state', ['clocked_in', 'on_break'])
      .order('clock_in_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let activeBreak: AttendanceBreak | null = null;
    let attendanceState: AttendanceState = 'not_started';

    if (session) {
      if (session.state === 'on_break') {
        const { data: brk } = await supabase
          .from('attendance_breaks')
          .select('*')
          .eq('session_id', session.id)
          .is('end_at', null)
          .limit(1)
          .maybeSingle();
        activeBreak = brk;
        attendanceState = 'on_break';
      } else {
        attendanceState = 'clocked_in';
      }
    }

    const elapsed = session
      ? Math.round((Date.now() - new Date(session.clock_in_at).getTime()) / 60000)
      : 0;

    setState({
      activeSession: session,
      activeBreak: activeBreak,
      attendanceState,
      loading: false,
      error: null,
      elapsedMinutes: elapsed,
    });
  }, [supabase, user]);

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  // Keep clock state in sync across browsers/tabs via realtime + refetch on focus
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`my-attendance-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_sessions',
          filter: `profile_id=eq.${user.id}`,
        },
        () => {
          fetchActiveSession();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_breaks',
        },
        () => {
          fetchActiveSession();
        }
      )
      .subscribe();

    const onFocus = () => fetchActiveSession();
    window.addEventListener('focus', onFocus);

    return () => {
      channel.unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, [supabase, user, fetchActiveSession]);

  useEffect(() => {
    if (!state.activeSession || state.attendanceState === 'not_started') return;

    const interval = setInterval(() => {
      const elapsed = Math.round(
        (Date.now() - new Date(state.activeSession!.clock_in_at).getTime()) / 60000
      );
      setState((s) => ({ ...s, elapsedMinutes: elapsed }));
    }, 60000);

    return () => clearInterval(interval);
  }, [state.activeSession, state.attendanceState]);

  const clockIn = useCallback(async (notes?: string) => {
    if (!user || !profile) return;
    setActionLoading(true);
    setState((s) => ({ ...s, error: null }));

    try {
      const res = await fetch('/api/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clock_in', notes }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to clock in');
      }

      await fetchActiveSession();
    } catch (e) {
      setState((s) => ({ ...s, error: (e as Error).message }));
    } finally {
      setActionLoading(false);
    }
  }, [user, profile, fetchActiveSession]);

  const clockOut = useCallback(async (notes?: string) => {
    if (!user || !state.activeSession) return;
    setActionLoading(true);
    setState((s) => ({ ...s, error: null }));

    try {
      const res = await fetch('/api/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clock_out', sessionId: state.activeSession.id, notes }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to clock out');
      }

      setState((s) => ({
        ...s,
        activeSession: null,
        activeBreak: null,
        attendanceState: 'not_started',
        elapsedMinutes: 0,
      }));
    } catch (e) {
      setState((s) => ({ ...s, error: (e as Error).message }));
    } finally {
      setActionLoading(false);
    }
  }, [user, state.activeSession]);

  const startBreak = useCallback(async (breakType: 'general' | 'lunch' | 'rest' = 'general') => {
    if (!user || !state.activeSession) return;
    setActionLoading(true);
    setState((s) => ({ ...s, error: null }));

    try {
      const res = await fetch('/api/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_break', sessionId: state.activeSession.id, breakType }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start break');
      }

      await fetchActiveSession();
    } catch (e) {
      setState((s) => ({ ...s, error: (e as Error).message }));
    } finally {
      setActionLoading(false);
    }
  }, [user, state.activeSession, fetchActiveSession]);

  const endBreak = useCallback(async () => {
    if (!user || !state.activeSession || !state.activeBreak) return;
    setActionLoading(true);
    setState((s) => ({ ...s, error: null }));

    try {
      const res = await fetch('/api/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end_break', sessionId: state.activeSession.id, breakId: state.activeBreak.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to end break');
      }

      await fetchActiveSession();
    } catch (e) {
      setState((s) => ({ ...s, error: (e as Error).message }));
    } finally {
      setActionLoading(false);
    }
  }, [user, state.activeSession, state.activeBreak, fetchActiveSession]);

  return {
    ...state,
    actionLoading,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    refresh: fetchActiveSession,
  };
}
