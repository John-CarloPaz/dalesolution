'use client';

import { type ReactNode, useState, useEffect } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const [year, setYear] = useState(2026);
  useEffect(() => { setYear(new Date().getFullYear()); }, []);
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[oklch(0.12_0.02_264)] via-[oklch(0.14_0.015_270)] to-[oklch(0.10_0.01_250)] px-4 py-12">
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            DaleSolution
          </h1>
          <p className="mt-1 text-sm text-white/50">Workforce OS</p>
        </div>

        {children}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-white/30">
          &copy; {year} DaleSolution. All rights reserved.
        </p>
      </div>
    </div>
  );
}
