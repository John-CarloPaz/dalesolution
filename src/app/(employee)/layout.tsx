'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { EmployeeNav } from '@/components/layout/employee-nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitials } from '@/lib/utils';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, profile, loading, signOut } = useSession();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <EmployeeNav />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-card/95 backdrop-blur-sm px-4 py-3 md:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar size="default">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
              )}
              <AvatarFallback>
                {profile ? getInitials(profile.full_name) : '??'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {profile?.full_name ?? 'Virtual Assistant'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.position ?? profile?.role ?? ''}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={signOut}>
            <LogOut className="size-4" />
            <span className="sr-only">Sign out</span>
          </Button>
        </header>

        {/* Main content */}
        <main className="flex-1 px-4 py-5 pb-24 md:px-6 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
