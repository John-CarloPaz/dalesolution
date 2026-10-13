import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const instant = false;

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile && ['owner', 'admin', 'team_lead'].includes(profile.role)) {
      redirect('/dashboard');
    }
    redirect('/portal');
  }

  redirect('/login');
}
