'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { isManagement } from '@/lib/constants/roles';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminTopbar } from '@/components/layout/admin-topbar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

function AdminLoadingSkeleton() {
  return (
    <div className="flex min-h-svh w-full">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-64 flex-col border-r bg-sidebar p-4 gap-4">
        <div className="flex items-center gap-2 px-2">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
      {/* Main area skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b flex items-center px-4 gap-3">
          <Skeleton className="size-7 rounded" />
          <Skeleton className="h-4 w-32" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-56 rounded-lg hidden sm:block" />
            <Skeleton className="size-7 rounded" />
            <Skeleton className="size-7 rounded" />
            <Skeleton className="size-6 rounded-full" />
          </div>
        </div>
        <div className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, isAuthenticated, role } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!loading && isAuthenticated && !isManagement(role)) {
      router.replace('/');
    }
  }, [loading, isAuthenticated, role, router]);

  if (loading) {
    return <AdminLoadingSkeleton />;
  }

  if (!isAuthenticated || !isManagement(role)) {
    return <AdminLoadingSkeleton />;
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <AdminTopbar />
        <div className="flex-1 overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
