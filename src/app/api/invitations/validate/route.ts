import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { error: 'Server misconfigured — missing Supabase credentials.' },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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
  } catch (err) {
    return NextResponse.json(
      { error: `Internal server error: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 500 }
    );
  }
}
