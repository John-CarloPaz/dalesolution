-- Row Level Security Policies

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_select" ON organizations FOR SELECT USING (id = public.requesting_org_id());
CREATE POLICY "org_update" ON organizations FOR UPDATE USING (
  id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (org_id = public.requesting_org_id());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE USING (
  id = auth.uid()
) WITH CHECK (
  id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()) -- cannot change own role
);
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin') AND id != auth.uid()
);

-- Teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_select" ON teams FOR SELECT USING (org_id = public.requesting_org_id());
CREATE POLICY "teams_insert" ON teams FOR INSERT WITH CHECK (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "teams_update" ON teams FOR UPDATE USING (
  org_id = public.requesting_org_id() AND (
    public.requesting_user_role() IN ('owner', 'admin')
    OR (public.requesting_user_role() = 'team_lead' AND lead_id = auth.uid())
  )
);
CREATE POLICY "teams_delete" ON teams FOR DELETE USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);

-- Team Members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_members_select" ON team_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND teams.org_id = public.requesting_org_id())
);
CREATE POLICY "team_members_insert" ON team_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND teams.org_id = public.requesting_org_id())
  AND public.requesting_user_role() IN ('owner', 'admin', 'team_lead')
);
CREATE POLICY "team_members_delete" ON team_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND teams.org_id = public.requesting_org_id())
  AND public.requesting_user_role() IN ('owner', 'admin', 'team_lead')
);

-- Work Schedules
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_select" ON work_schedules FOR SELECT USING (org_id = public.requesting_org_id());
CREATE POLICY "schedules_insert" ON work_schedules FOR INSERT WITH CHECK (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "schedules_update" ON work_schedules FOR UPDATE USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "schedules_delete" ON work_schedules FOR DELETE USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);

-- Schedule Assignments
ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sched_assign_select" ON schedule_assignments FOR SELECT USING (
  profile_id = auth.uid()
  OR public.requesting_user_role() IN ('owner', 'admin', 'team_lead')
);
CREATE POLICY "sched_assign_insert" ON schedule_assignments FOR INSERT WITH CHECK (
  public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "sched_assign_update" ON schedule_assignments FOR UPDATE USING (
  public.requesting_user_role() IN ('owner', 'admin')
);

-- Attendance Sessions
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_select_own" ON attendance_sessions FOR SELECT USING (
  profile_id = auth.uid()
);
CREATE POLICY "sessions_select_admin" ON attendance_sessions FOR SELECT USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin', 'team_lead')
);
CREATE POLICY "sessions_insert" ON attendance_sessions FOR INSERT WITH CHECK (
  profile_id = auth.uid() AND org_id = public.requesting_org_id()
);
CREATE POLICY "sessions_update_own" ON attendance_sessions FOR UPDATE USING (
  profile_id = auth.uid() AND org_id = public.requesting_org_id()
);
CREATE POLICY "sessions_update_admin" ON attendance_sessions FOR UPDATE USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);

-- Attendance Breaks
ALTER TABLE attendance_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "breaks_select" ON attendance_breaks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM attendance_sessions s
    WHERE s.id = attendance_breaks.session_id
    AND (s.profile_id = auth.uid() OR (s.org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin', 'team_lead')))
  )
);
CREATE POLICY "breaks_insert" ON attendance_breaks FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM attendance_sessions s
    WHERE s.id = attendance_breaks.session_id AND s.profile_id = auth.uid()
  )
);
CREATE POLICY "breaks_update" ON attendance_breaks FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM attendance_sessions s
    WHERE s.id = attendance_breaks.session_id AND s.profile_id = auth.uid()
  )
);

-- Employee Invitations
ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitations_select" ON employee_invitations FOR SELECT USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "invitations_insert" ON employee_invitations FOR INSERT WITH CHECK (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "invitations_update" ON employee_invitations FOR UPDATE USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);

-- Correction Requests
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corrections_select_own" ON correction_requests FOR SELECT USING (
  requested_by = auth.uid()
);
CREATE POLICY "corrections_select_admin" ON correction_requests FOR SELECT USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "corrections_insert" ON correction_requests FOR INSERT WITH CHECK (
  requested_by = auth.uid() AND org_id = public.requesting_org_id()
);
CREATE POLICY "corrections_update_admin" ON correction_requests FOR UPDATE USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
  AND reviewed_by IS DISTINCT FROM requested_by -- cannot review own request
);

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (profile_id = auth.uid());
CREATE POLICY "notifications_delete" ON notifications FOR DELETE USING (profile_id = auth.uid());

-- Audit Logs (read-only for admins)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select" ON audit_logs FOR SELECT USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);

-- Webhook Endpoints
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks_select" ON webhook_endpoints FOR SELECT USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "webhooks_insert" ON webhook_endpoints FOR INSERT WITH CHECK (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "webhooks_update" ON webhook_endpoints FOR UPDATE USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "webhooks_delete" ON webhook_endpoints FOR DELETE USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);

-- Webhook Deliveries
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliveries_select" ON webhook_deliveries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM webhook_endpoints w
    WHERE w.id = webhook_deliveries.webhook_id AND w.org_id = public.requesting_org_id()
    AND public.requesting_user_role() IN ('owner', 'admin')
  )
);

-- Office Config
ALTER TABLE office_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "office_select" ON office_config FOR SELECT USING (org_id = public.requesting_org_id());
CREATE POLICY "office_update" ON office_config FOR UPDATE USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "office_insert" ON office_config FOR INSERT WITH CHECK (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);

-- Enable Realtime on attendance tables
ALTER PUBLICATION supabase_realtime ADD TABLE attendance_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance_breaks;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
