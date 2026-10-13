import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing SUPABASE env vars for invitation validation');
      return NextResponse.json({ error: 'Server configuration error. Please contact support.' }, { status: 500 });
    }

    const supabase = createAdminClient();

    const { data: invitation, error } = await supabase
      .from('employee_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found. It may have been revoked or the link is invalid.' },
        { status: 404 }
      );
    }

    if (invitation.status === 'accepted') {
      return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 400 });
    }
    if (invitation.status === 'revoked') {
      return NextResponse.json({ error: 'This invitation has been revoked.' }, { status: 400 });
    }
    if (invitation.status === 'expired' || new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired.' }, { status: 400 });
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', invitation.org_id)
      .single();

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      full_name: invitation.full_name,
      role: invitation.role,
      position: invitation.position,
      status: invitation.status,
      expires_at: invitation.expires_at,
      org_name: org?.name ?? 'Unknown Organization',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, userId, fullName, email } = body;

    if (!token || !userId || !fullName || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: token, userId, fullName, email' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Validate the invitation token
    const { data: invitation, error: invError } = await supabase
      .from('employee_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (invError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found.' },
        { status: 404 }
      );
    }

    // Check status
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status}. It cannot be accepted.` },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from('employee_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return NextResponse.json(
        { error: 'Invitation has expired.' },
        { status: 400 }
      );
    }

    // 2. Create the profile record
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        org_id: invitation.org_id,
        email,
        full_name: fullName,
        role: invitation.role,
        position: invitation.position,
        status: 'active',
      });

    if (profileError) {
      return NextResponse.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    // 3. Assign team if specified
    if (invitation.team_id) {
      await supabase
        .from('team_members')
        .insert({
          team_id: invitation.team_id,
          profile_id: userId,
        });
    }

    // 4. Assign schedule if specified
    if (invitation.schedule_id) {
      await supabase
        .from('schedule_assignments')
        .insert({
          profile_id: userId,
          schedule_id: invitation.schedule_id,
          effective_from: new Date().toISOString(),
        });
    }

    // 5. Mark invitation as accepted
    await supabase
      .from('employee_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    // 6. Create audit log entry
    await supabase.from('audit_logs').insert({
      org_id: invitation.org_id,
      actor_id: userId,
      action: 'invitation.accepted',
      entity_type: 'employee_invitation',
      entity_id: invitation.id,
      new_data: {
        email,
        role: invitation.role,
        team_id: invitation.team_id,
        position: invitation.position,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
