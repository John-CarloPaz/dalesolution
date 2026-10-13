'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  ShieldX,
  UserPlus,
} from 'lucide-react';
import { useSupabase } from '@/providers/supabase-provider';
import { registerSchema, type RegisterInput } from '@/lib/validations/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InvitationDetails {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  position: string | null;
  status: string;
  expires_at: string;
  org_name: string;
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>}>
      <AcceptInvitationContent />
    </Suspense>
  );
}

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase } = useSupabase();

  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loadingInvitation, setLoadingInvitation] = useState(true);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    if (!token) {
      setInvitationError('No invitation token provided.');
      setLoadingInvitation(false);
      return;
    }

    const fetchInvitation = async () => {
      try {
        const res = await fetch(`/api/invitations/validate?token=${encodeURIComponent(token!)}`);
        const contentType = res.headers.get('content-type') ?? '';

        if (!contentType.includes('application/json')) {
          setInvitationError(`Server error (${res.status}). Please try again later.`);
          setLoadingInvitation(false);
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          setInvitationError(data.error || 'Invalid invitation.');
          setLoadingInvitation(false);
          return;
        }

        setInvitation(data as InvitationDetails);

        setValue('email', data.email);
        if (data.full_name) {
          setValue('fullName', data.full_name);
        }
      } catch (err) {
        setInvitationError(`Failed to validate invitation: ${err instanceof Error ? err.message : 'Please try again.'}`);
      }
      setLoadingInvitation(false);
    };

    fetchInvitation();
  }, [token, setValue]);

  const onSubmit = async (data: RegisterInput) => {
    if (!token || !invitation) return;
    setSubmitError(null);

    // 1. Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
        },
      },
    });

    if (signUpError) {
      setSubmitError(signUpError.message);
      return;
    }

    if (!authData.user) {
      setSubmitError('Failed to create account. Please try again.');
      return;
    }

    // 2. Finalize via API route
    const response = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        userId: authData.user.id,
        fullName: data.fullName,
        email: data.email,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setSubmitError(body?.error ?? 'Failed to finalize invitation. Please contact support.');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  // Loading state
  if (loadingInvitation) {
    return (
      <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-white/50">Validating invitation...</p>
        </CardContent>
      </Card>
    );
  }

  // Error states
  if (invitationError) {
    const isExpired = invitationError.includes('expired');
    const isRevoked = invitationError.includes('revoked');
    const isAccepted = invitationError.includes('already been accepted');

    const Icon = isExpired ? Clock : isRevoked ? ShieldX : isAccepted ? CheckCircle : AlertCircle;
    const iconColor = isAccepted ? 'text-success' : 'text-destructive';
    const bgColor = isAccepted ? 'bg-success/10' : 'bg-destructive/10';

    return (
      <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className={`mx-auto mb-2 flex size-12 items-center justify-center rounded-full ${bgColor}`}>
            <Icon className={`size-6 ${iconColor}`} />
          </div>
          <CardTitle className="text-lg text-white">
            {isAccepted ? 'Already accepted' : 'Invalid invitation'}
          </CardTitle>
          <CardDescription className="text-white/50">
            {invitationError}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button variant="outline" size="lg" className="w-full border-white/10 text-white hover:bg-white/5">
              Go to sign in
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!invitation) return null;

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    team_lead: 'Team Lead',
    employee: 'Employee',
  };

  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-lg text-white">Accept invitation</CardTitle>
        <CardDescription className="text-white/50">
          You&apos;ve been invited to join{' '}
          <span className="font-medium text-white/70">{invitation.org_name}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Invitation details */}
        <div className="mb-6 space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Role</span>
            <span className="font-medium text-white/80">
              {roleLabels[invitation.role] ?? invitation.role}
            </span>
          </div>
          {invitation.position && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Position</span>
              <span className="font-medium text-white/80">
                {invitation.position}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Email</span>
            <span className="font-medium text-white/80">
              {invitation.email}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {submitError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </div>
          )}

          {/* Email is read-only -- pre-filled from invitation */}
          <input type="hidden" {...register('email')} />
          <input type="hidden" value={token ?? ''} {...register('invitationToken')} />

          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-white/70">
              Full name
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Your full name"
              autoComplete="name"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30"
              {...register('fullName')}
            />
            {errors.fullName && (
              <p className="text-xs text-destructive">{errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/70">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            {isSubmitting ? 'Creating account...' : 'Create account & join'}
          </Button>

          <p className="text-center text-xs text-white/40">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
