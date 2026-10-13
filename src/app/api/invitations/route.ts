import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { inviteEmployeeSchema } from '@/lib/validations/employee';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify the caller is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the caller is an admin or owner
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !['owner', 'admin'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    // Validate input
    const body = await request.json();
    const parsed = inviteEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, fullName, role, teamId, position, scheduleId } = parsed.data;

    // Check for existing pending invitation
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('employee_invitations')
      .select('id, status')
      .eq('org_id', callerProfile.org_id)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email.' },
        { status: 409 }
      );
    }

    // Generate token and expiration
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Insert invitation
    const { data: invitation, error: insertError } = await admin
      .from('employee_invitations')
      .insert({
        org_id: callerProfile.org_id,
        email,
        full_name: fullName ?? null,
        role,
        team_id: teamId ?? null,
        position: position ?? null,
        schedule_id: scheduleId ?? null,
        token,
        status: 'pending',
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create invitation: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Audit log
    await admin.from('audit_logs').insert({
      org_id: callerProfile.org_id,
      actor_id: user.id,
      action: 'invitation.created',
      entity_type: 'employee_invitation',
      entity_id: invitation.id,
      new_data: { email, role, position, team_id: teamId },
    });

    // In production you would send the invitation email here.
    // For now, return the invitation with the accept URL.
    return NextResponse.json({
      invitation,
      acceptUrl: `/accept-invitation?token=${token}`,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Verify the caller is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the caller is an admin or owner
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !['owner', 'admin'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    // Fetch invitations for the org
    const admin = createAdminClient();
    const { data: invitations, error: fetchError } = await admin
      .from('employee_invitations')
      .select('*')
      .eq('org_id', callerProfile.org_id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch invitations: ${fetchError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ invitations });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
