export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          timezone?: string;
          settings?: Json;
          updated_at?: string;
        };
        Relationships: [];};
      profiles: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role: 'owner' | 'admin' | 'team_lead' | 'employee';
          status: 'active' | 'inactive' | 'invited';
          timezone: string;
          position: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          org_id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          role?: 'owner' | 'admin' | 'team_lead' | 'employee';
          status?: 'active' | 'inactive' | 'invited';
          timezone?: string;
          position?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          org_id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          role?: 'owner' | 'admin' | 'team_lead' | 'employee';
          status?: 'active' | 'inactive' | 'invited';
          timezone?: string;
          position?: string | null;
          updated_at?: string;
        };
      Relationships: [];};
      teams: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          lead_id: string | null;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          lead_id?: string | null;
          color?: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          lead_id?: string | null;
          color?: string;
        };
      Relationships: [];};
      team_members: {
        Row: {
          id: string;
          team_id: string;
          profile_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          profile_id: string;
          joined_at?: string;
        };
        Update: {
          team_id?: string;
          profile_id?: string;
        };
      Relationships: [];};
      attendance_sessions: {
        Row: {
          id: string;
          org_id: string;
          profile_id: string;
          state: 'clocked_in' | 'on_break' | 'clocked_out';
          clock_in_at: string;
          clock_out_at: string | null;
          scheduled_shift_id: string | null;
          notes: string | null;
          total_break_minutes: number;
          total_worked_minutes: number | null;
          is_late: boolean;
          is_auto_clocked_out: boolean;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          profile_id: string;
          state?: 'clocked_in' | 'on_break' | 'clocked_out';
          clock_in_at?: string;
          clock_out_at?: string | null;
          scheduled_shift_id?: string | null;
          notes?: string | null;
          total_break_minutes?: number;
          total_worked_minutes?: number | null;
          is_late?: boolean;
          is_auto_clocked_out?: boolean;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          state?: 'clocked_in' | 'on_break' | 'clocked_out';
          clock_in_at?: string;
          clock_out_at?: string | null;
          notes?: string | null;
          total_break_minutes?: number;
          total_worked_minutes?: number | null;
          is_late?: boolean;
          is_auto_clocked_out?: boolean;
          updated_at?: string;
        };
      Relationships: [];};
      attendance_breaks: {
        Row: {
          id: string;
          session_id: string;
          start_at: string;
          end_at: string | null;
          duration_minutes: number | null;
          break_type: 'general' | 'lunch' | 'rest';
        };
        Insert: {
          id?: string;
          session_id: string;
          start_at?: string;
          end_at?: string | null;
          duration_minutes?: number | null;
          break_type?: 'general' | 'lunch' | 'rest';
        };
        Update: {
          end_at?: string | null;
          duration_minutes?: number | null;
        };
      Relationships: [];};
      work_schedules: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          days_of_week: number[];
          start_time: string;
          end_time: string;
          grace_period_minutes: number;
          break_duration_minutes: number;
          is_default: boolean;
          timezone: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          days_of_week: number[];
          start_time: string;
          end_time: string;
          grace_period_minutes?: number;
          break_duration_minutes?: number;
          is_default?: boolean;
          timezone?: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          days_of_week?: number[];
          start_time?: string;
          end_time?: string;
          grace_period_minutes?: number;
          break_duration_minutes?: number;
          is_default?: boolean;
          timezone?: string;
        };
      Relationships: [];};
      schedule_assignments: {
        Row: {
          id: string;
          profile_id: string;
          schedule_id: string;
          effective_from: string;
          effective_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          schedule_id: string;
          effective_from: string;
          effective_until?: string | null;
          created_at?: string;
        };
        Update: {
          effective_until?: string | null;
        };
      Relationships: [];};
      employee_invitations: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          full_name: string | null;
          role: 'admin' | 'team_lead' | 'employee';
          team_id: string | null;
          position: string | null;
          schedule_id: string | null;
          token: string;
          status: 'pending' | 'accepted' | 'expired' | 'revoked';
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          full_name?: string | null;
          role?: 'admin' | 'team_lead' | 'employee';
          team_id?: string | null;
          position?: string | null;
          schedule_id?: string | null;
          token: string;
          status?: 'pending' | 'accepted' | 'expired' | 'revoked';
          invited_by: string;
          expires_at: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'accepted' | 'expired' | 'revoked';
          accepted_at?: string | null;
        };
      Relationships: [];};
      correction_requests: {
        Row: {
          id: string;
          org_id: string;
          session_id: string;
          requested_by: string;
          reviewed_by: string | null;
          status: 'pending' | 'approved' | 'rejected';
          reason: string;
          requested_clock_in: string | null;
          requested_clock_out: string | null;
          admin_notes: string | null;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          session_id: string;
          requested_by: string;
          reviewed_by?: string | null;
          status?: 'pending' | 'approved' | 'rejected';
          reason: string;
          requested_clock_in?: string | null;
          requested_clock_out?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          reviewed_by?: string | null;
          status?: 'pending' | 'approved' | 'rejected';
          admin_notes?: string | null;
          reviewed_at?: string | null;
        };
      Relationships: [];};
      notifications: {
        Row: {
          id: string;
          org_id: string;
          profile_id: string;
          type: string;
          title: string;
          body: string | null;
          data: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          profile_id: string;
          type: string;
          title: string;
          body?: string | null;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
      Relationships: [];};
      audit_logs: {
        Row: {
          id: string;
          org_id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      webhook_endpoints: {
        Row: {
          id: string;
          org_id: string;
          url: string;
          secret: string;
          events: string[];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          url: string;
          secret: string;
          events: string[];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          url?: string;
          secret?: string;
          events?: string[];
          is_active?: boolean;
        };
      Relationships: [];};
      webhook_deliveries: {
        Row: {
          id: string;
          webhook_id: string;
          event: string;
          payload: Json;
          response_status: number | null;
          response_body: string | null;
          attempts: number;
          delivered_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          webhook_id: string;
          event: string;
          payload: Json;
          response_status?: number | null;
          response_body?: string | null;
          attempts?: number;
          delivered_at?: string | null;
          created_at?: string;
        };
        Update: {
          response_status?: number | null;
          response_body?: string | null;
          attempts?: number;
          delivered_at?: string | null;
        };
      Relationships: [];};
      office_config: {
        Row: {
          id: string;
          org_id: string;
          zones: Json;
          theme: string;
          show_avatars: boolean;
          is_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          zones?: Json;
          theme?: string;
          show_avatars?: boolean;
          is_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          zones?: Json;
          theme?: string;
          show_avatars?: boolean;
          is_enabled?: boolean;
          updated_at?: string;
        };
      Relationships: [];};
      clients: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          company: string | null;
          email: string | null;
          phone: string | null;
          notes: string | null;
          status: string;
          assigned_to: string | null;
          schedule_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          company?: string | null;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          status?: string;
          assigned_to?: string | null;
          schedule_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          company?: string | null;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          status?: string;
          assigned_to?: string | null;
          schedule_id?: string | null;
          updated_at?: string;
        };
      Relationships: [];};
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

export type Organization = Tables<'organizations'>;
export type Profile = Tables<'profiles'>;
export type Team = Tables<'teams'>;
export type TeamMember = Tables<'team_members'>;
export type AttendanceSession = Tables<'attendance_sessions'>;
export type AttendanceBreak = Tables<'attendance_breaks'>;
export type WorkSchedule = Tables<'work_schedules'>;
export type ScheduleAssignment = Tables<'schedule_assignments'>;
export type EmployeeInvitation = Tables<'employee_invitations'>;
export type CorrectionRequest = Tables<'correction_requests'>;
export type Notification = Tables<'notifications'>;
export type AuditLog = Tables<'audit_logs'>;
export type WebhookEndpoint = Tables<'webhook_endpoints'>;
export type WebhookDelivery = Tables<'webhook_deliveries'>;
export type OfficeConfig = Tables<'office_config'>;
export type Client = Tables<'clients'>;

