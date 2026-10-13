'use client';

import { useSupabase } from '@/providers/supabase-provider';
import type { Role } from '@/lib/constants/roles';

export function useSession() {
  const { user, profile, loading, supabase } = useSupabase();

  return {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    role: (profile?.role ?? 'employee') as Role,
    orgId: profile?.org_id,

    async signOut() {
      await supabase.auth.signOut();
      window.location.href = '/login';
    },
  };
}
