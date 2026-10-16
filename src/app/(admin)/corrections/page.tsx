'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from 'cn';
import { useSupabase } from '@/providers/supabase-provider';
import { formatTime, formatDate, formatDateTime } from '@/lib/utils';
import {
  CORRECTION_STATUSES,
  type CorrectionStatus,
} from '@/lib/constants/attendance-states';
import { reviewCorrectionSchema } from '@/lib/validations/attendance';
import { toast } from 'sonner';
import {
  FileEdit,
  CheckCircle2,
  XCircle,
  Inbox,
  Clock,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { CorrectionRequest, AttendanceSession, Profile } from '@/types/database';

// -- Enriched correction type
interface CorrectionRecord {
  correction: CorrectionRequest;
  profile: Profile;
  session: AttendanceSession;
}

// -- Status badge
function CorrectionStatusBadge({ status }: { status: CorrectionStatus }) {
  const config: Record<CorrectionStatus, { label: string; variant: 'secondary' | 'default' | 'destructive' }> = {
    pending: { label: 'Pending', variant: 'secondary' },
    approved: { label: 'Approved', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
  };

  const { label, variant } = config[status];

  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  );
}

// -- Empty state
function EmptyState({ status }: { status: string }) {
  const messages: Record<string, { title: string; subtitle: string; icon: React.ReactNode }> = {
    pending: {
      title: 'No pending requests',
      subtitle: 'All correction requests have been reviewed.',
      icon: <Inbox className="size-6 text-muted-foreground" />,
    },
    approved: {
      title: 'No approved requests',
      subtitle: 'Approved corrections will appear here.',
      icon: <CheckCircle2 className="size-6 text-muted-foreground" />,
    },
    rejected: {
      title: 'No rejected requests',
      subtitle: 'Rejected corrections will appear here.',
      icon: <XCircle className="size-6 text-muted-foreground" />,
    },
    all: {
      title: 'No correction requests',
      subtitle: 'Correction requests from virtual assistants will appear here.',
      icon: <FileEdit className="size-6 text-muted-foreground" />,
    },
  };

  const { title, subtitle, icon } = messages[status] || messages.all;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>
    </div>
  );
}

// -- Corrections table component
function CorrectionTable({
  records,
  onSelect,
}: {
  records: CorrectionRecord[];
  onSelect: (record: CorrectionRecord) => void;
}) {
  if (records.length === 0) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Virtual Assistant</TableHead>
          <TableHead className="hidden md:table-cell">Date</TableHead>
          <TableHead className="hidden lg:table-cell">Reason</TableHead>
          <TableHead className="hidden sm:table-cell">Requested Changes</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Submitted</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow
            key={record.correction.id}
            className="cursor-pointer"
            onClick={() => onSelect(record)}
          >
            <TableCell>
              <span className="text-sm font-medium">{record.profile.full_name}</span>
            </TableCell>
            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
              {formatDate(record.session.clock_in_at)}
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <span className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
                {record.correction.reason}
              </span>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {record.correction.requested_clock_in && (
                  <span>In: {formatTime(record.correction.requested_clock_in)}</span>
                )}
                {record.correction.requested_clock_out && (
                  <span>Out: {formatTime(record.correction.requested_clock_out)}</span>
                )}
                {!record.correction.requested_clock_in && !record.correction.requested_clock_out && (
                  <span>--</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <CorrectionStatusBadge status={record.correction.status} />
            </TableCell>
            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
              {formatDate(record.correction.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// -- Main page
export default function CorrectionsPage() {
  const { supabase, profile } = useSupabase();
  const [records, setRecords] = useState<CorrectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<CorrectionRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCorrections = useCallback(async () => {
    if (!profile?.org_id) return;
    setLoading(true);

    const { data: corrections } = await supabase
      .from('correction_requests')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false });

    if (!corrections || corrections.length === 0) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const profileIds = [...new Set(corrections.map((c) => c.requested_by))];
    const sessionIds = [...new Set(corrections.map((c) => c.session_id))];

    const [profilesResult, sessionsResult] = await Promise.all([
      supabase.from('profiles').select('*').in('id', profileIds),
      supabase.from('attendance_sessions').select('*').in('id', sessionIds),
    ]);

    const profileMap = new Map((profilesResult.data || []).map((p) => [p.id, p]));
    const sessionMap = new Map((sessionsResult.data || []).map((s) => [s.id, s]));

    const enriched: CorrectionRecord[] = corrections
      .filter((c) => profileMap.has(c.requested_by) && sessionMap.has(c.session_id))
      .map((c) => ({
        correction: c,
        profile: profileMap.get(c.requested_by)!,
        session: sessionMap.get(c.session_id)!,
      }));

    setRecords(enriched);
    setLoading(false);
  }, [supabase, profile?.org_id]);

  useEffect(() => {
    fetchCorrections();
  }, [fetchCorrections]);

  // -- Filtered records by status
  const pendingRecords = useMemo(
    () => records.filter((r) => r.correction.status === 'pending'),
    [records]
  );
  const approvedRecords = useMemo(
    () => records.filter((r) => r.correction.status === 'approved'),
    [records]
  );
  const rejectedRecords = useMemo(
    () => records.filter((r) => r.correction.status === 'rejected'),
    [records]
  );

  // -- Handle opening review dialog
  function handleSelect(record: CorrectionRecord) {
    setSelectedRecord(record);
    setAdminNotes(record.correction.admin_notes || '');
    setDialogOpen(true);
  }

  // -- Handle review action
  async function handleReview(status: 'approved' | 'rejected') {
    if (!selectedRecord || !profile) return;

    const parsed = reviewCorrectionSchema.safeParse({
      status,
      adminNotes: adminNotes.trim() || undefined,
    });

    if (!parsed.success) {
      toast.error('Invalid input. Please check your notes.');
      return;
    }

    setSubmitting(true);

    try {
      // Update the correction request
      const { error: correctionError } = await supabase
        .from('correction_requests')
        .update({
          status: parsed.data.status,
          admin_notes: parsed.data.adminNotes || null,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedRecord.correction.id);

      if (correctionError) throw correctionError;

      // If approved, also update the attendance session with requested times
      if (status === 'approved') {
        const sessionUpdate: { clock_in_at?: string; clock_out_at?: string } = {};

        if (selectedRecord.correction.requested_clock_in) {
          sessionUpdate.clock_in_at = selectedRecord.correction.requested_clock_in;
        }
        if (selectedRecord.correction.requested_clock_out) {
          sessionUpdate.clock_out_at = selectedRecord.correction.requested_clock_out;
        }

        if (Object.keys(sessionUpdate).length > 0) {
          const { error: sessionError } = await supabase
            .from('attendance_sessions')
            .update(sessionUpdate)
            .eq('id', selectedRecord.correction.session_id);

          if (sessionError) throw sessionError;
        }
      }

      toast.success(
        status === 'approved'
          ? 'Correction approved and session updated.'
          : 'Correction request rejected.'
      );

      setDialogOpen(false);
      setSelectedRecord(null);
      setAdminNotes('');
      await fetchCorrections();
    } catch (error) {
      toast.error('Failed to process the correction request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Corrections</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and manage virtual assistant attendance correction requests.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {pendingRecords.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 min-w-[20px]">
                {pendingRecords.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved
            {approvedRecords.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 min-w-[20px]">
                {approvedRecords.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected
            {rejectedRecords.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 min-w-[20px]">
                {rejectedRecords.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">
            All
            {records.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 min-w-[20px]">
                {records.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <Card className="mt-4">
            <CardContent className="p-6">
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-40 ml-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="pending">
              <Card>
                <CardContent className="p-0 sm:p-2">
                  {pendingRecords.length === 0 ? (
                    <EmptyState status="pending" />
                  ) : (
                    <CorrectionTable records={pendingRecords} onSelect={handleSelect} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="approved">
              <Card>
                <CardContent className="p-0 sm:p-2">
                  {approvedRecords.length === 0 ? (
                    <EmptyState status="approved" />
                  ) : (
                    <CorrectionTable records={approvedRecords} onSelect={handleSelect} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rejected">
              <Card>
                <CardContent className="p-0 sm:p-2">
                  {rejectedRecords.length === 0 ? (
                    <EmptyState status="rejected" />
                  ) : (
                    <CorrectionTable records={rejectedRecords} onSelect={handleSelect} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all">
              <Card>
                <CardContent className="p-0 sm:p-2">
                  {records.length === 0 ? (
                    <EmptyState status="all" />
                  ) : (
                    <CorrectionTable records={records} onSelect={handleSelect} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Correction Request</DialogTitle>
            <DialogDescription>
              Review the requested changes and approve or reject this correction.
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4">
              {/* Employee info */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">{selectedRecord.profile.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  Session date: {formatDate(selectedRecord.session.clock_in_at)}
                </p>
              </div>

              {/* Original times */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Original Times
                </p>
                <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clock In</span>
                    <span className="font-medium">{formatTime(selectedRecord.session.clock_in_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clock Out</span>
                    <span className="font-medium">
                      {selectedRecord.session.clock_out_at
                        ? formatTime(selectedRecord.session.clock_out_at)
                        : '--'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Requested changes */}
              {(selectedRecord.correction.requested_clock_in ||
                selectedRecord.correction.requested_clock_out) && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Requested Changes
                  </p>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm space-y-1">
                    {selectedRecord.correction.requested_clock_in && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">New Clock In</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground line-through text-xs">
                            {formatTime(selectedRecord.session.clock_in_at)}
                          </span>
                          <ArrowRight className="size-3 text-muted-foreground" />
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {formatTime(selectedRecord.correction.requested_clock_in)}
                          </span>
                        </div>
                      </div>
                    )}
                    {selectedRecord.correction.requested_clock_out && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">New Clock Out</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground line-through text-xs">
                            {selectedRecord.session.clock_out_at
                              ? formatTime(selectedRecord.session.clock_out_at)
                              : '--'}
                          </span>
                          <ArrowRight className="size-3 text-muted-foreground" />
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {formatTime(selectedRecord.correction.requested_clock_out)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Virtual Assistant&apos;s Reason
                </p>
                <p className="text-sm rounded-lg bg-muted/50 p-3">
                  {selectedRecord.correction.reason}
                </p>
              </div>

              {/* Admin notes */}
              <div className="space-y-1.5">
                <Label htmlFor="admin-notes" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Admin Notes
                </Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add notes about your decision (optional)..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  disabled={selectedRecord.correction.status !== 'pending' || submitting}
                />
              </div>

              {/* Current status for non-pending */}
              {selectedRecord.correction.status !== 'pending' && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <CorrectionStatusBadge status={selectedRecord.correction.status} />
                  {selectedRecord.correction.reviewed_at && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDateTime(selectedRecord.correction.reviewed_at)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedRecord?.correction.status === 'pending' && (
            <DialogFooter>
              <Button
                variant="destructive"
                size="sm"
                disabled={submitting}
                onClick={() => handleReview('rejected')}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                Reject
              </Button>
              <Button
                size="sm"
                disabled={submitting}
                onClick={() => handleReview('approved')}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Approve
              </Button>
            </DialogFooter>
          )}

          {selectedRecord?.correction.status !== 'pending' && (
            <DialogFooter showCloseButton />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
