import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, org_id, status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status !== 'active') {
    return NextResponse.json({ error: 'Account not active' }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;

  switch (action) {
    case 'clock_in':
      return handleClockIn(supabase, profile, body);
    case 'clock_out':
      return handleClockOut(supabase, profile, body);
    case 'start_break':
      return handleStartBreak(supabase, profile, body);
    case 'end_break':
      return handleEndBreak(supabase, profile, body);
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}

async function handleClockIn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { id: string; org_id: string },
  body: { notes?: string }
) {
  const { data: existing } = await supabase
    .from('attendance_sessions')
    .select('id')
    .eq('profile_id', profile.id)
    .in('state', ['clocked_in', 'on_break'])
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'You already have an active session' }, { status: 409 });
  }

  const now = new Date().toISOString();

  const { data: assignment } = await supabase
    .from('schedule_assignments')
    .select('schedule_id')
    .eq('profile_id', profile.id)
    .lte('effective_from', now)
    .or(`effective_until.is.null,effective_until.gte.${now.split('T')[0]}`)
    .limit(1)
    .maybeSingle();

  let isLate = false;
  let scheduledShiftId: string | null = null;

  if (assignment) {
    scheduledShiftId = assignment.schedule_id;
    const { data: ws } = await supabase
      .from('work_schedules')
      .select('start_time, grace_period_minutes')
      .eq('id', assignment.schedule_id)
      .single();
    if (ws) {
      const today = new Date();
      const [h, m] = ws.start_time.split(':').map(Number);
      const shiftStart = new Date(today);
      shiftStart.setHours(h, m, 0, 0);
      shiftStart.setMinutes(shiftStart.getMinutes() + ws.grace_period_minutes);
      isLate = today > shiftStart;
    }
  }

  const { data: session, error } = await supabase
    .from('attendance_sessions')
    .insert({
      org_id: profile.org_id,
      profile_id: profile.id,
      state: 'clocked_in',
      clock_in_at: now,
      scheduled_shift_id: scheduledShiftId,
      is_late: isLate,
      notes: body.notes || null,
      source: 'web',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to clock in' }, { status: 500 });
  }

  return NextResponse.json({ session, isLate });
}

async function handleClockOut(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { id: string; org_id: string },
  body: { sessionId: string; notes?: string }
) {
  const { data: session } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('id', body.sessionId)
    .eq('profile_id', profile.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.state === 'clocked_out') {
    return NextResponse.json({ error: 'Session already completed' }, { status: 409 });
  }

  if (session.state === 'on_break') {
    return NextResponse.json({ error: 'Please end your break before clocking out' }, { status: 400 });
  }

  const now = new Date();
  const clockIn = new Date(session.clock_in_at);
  const totalElapsed = Math.round((now.getTime() - clockIn.getTime()) / 60000);
  const workedMinutes = totalElapsed - (session.total_break_minutes || 0);

  const { data: updated, error } = await supabase
    .from('attendance_sessions')
    .update({
      state: 'clocked_out',
      clock_out_at: now.toISOString(),
      total_worked_minutes: workedMinutes,
      notes: body.notes ? `${session.notes || ''}\n${body.notes}`.trim() : session.notes,
    })
    .eq('id', body.sessionId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to clock out' }, { status: 500 });
  }

  return NextResponse.json({ session: updated });
}

async function handleStartBreak(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { id: string; org_id: string },
  body: { sessionId: string; breakType?: string }
) {
  const { data: session } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('id', body.sessionId)
    .eq('profile_id', profile.id)
    .eq('state', 'clocked_in')
    .single();

  if (!session) {
    return NextResponse.json({ error: 'No active working session found' }, { status: 404 });
  }

  const { data: existingBreak } = await supabase
    .from('attendance_breaks')
    .select('id')
    .eq('session_id', body.sessionId)
    .is('end_at', null)
    .maybeSingle();

  if (existingBreak) {
    return NextResponse.json({ error: 'You already have an active break' }, { status: 409 });
  }

  const now = new Date().toISOString();

  const { error: breakError } = await supabase
    .from('attendance_breaks')
    .insert({
      session_id: body.sessionId,
      start_at: now,
      break_type: (body.breakType as 'general' | 'lunch' | 'rest') || 'general',
    });

  if (breakError) {
    return NextResponse.json({ error: 'Failed to start break' }, { status: 500 });
  }

  const { error: sessionError } = await supabase
    .from('attendance_sessions')
    .update({ state: 'on_break' })
    .eq('id', body.sessionId);

  if (sessionError) {
    return NextResponse.json({ error: 'Failed to update session state' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function handleEndBreak(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { id: string; org_id: string },
  body: { sessionId: string; breakId: string }
) {
  const { data: session } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('id', body.sessionId)
    .eq('profile_id', profile.id)
    .eq('state', 'on_break')
    .single();

  if (!session) {
    return NextResponse.json({ error: 'No active break session found' }, { status: 404 });
  }

  const { data: brk } = await supabase
    .from('attendance_breaks')
    .select('*')
    .eq('id', body.breakId)
    .eq('session_id', body.sessionId)
    .is('end_at', null)
    .single();

  if (!brk) {
    return NextResponse.json({ error: 'Break not found or already ended' }, { status: 404 });
  }

  const now = new Date();
  const breakStart = new Date(brk.start_at);
  const breakMinutes = Math.round((now.getTime() - breakStart.getTime()) / 60000);

  const { error: breakError } = await supabase
    .from('attendance_breaks')
    .update({
      end_at: now.toISOString(),
      duration_minutes: breakMinutes,
    })
    .eq('id', body.breakId);

  if (breakError) {
    return NextResponse.json({ error: 'Failed to end break' }, { status: 500 });
  }

  const { error: sessionError } = await supabase
    .from('attendance_sessions')
    .update({
      state: 'clocked_in',
      total_break_minutes: (session.total_break_minutes || 0) + breakMinutes,
    })
    .eq('id', body.sessionId);

  if (sessionError) {
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }

  return NextResponse.json({ success: true, breakMinutes });
}
