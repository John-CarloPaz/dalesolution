-- Clients: external customers that can be assigned to an employee.
-- A client's "schedule tag" is derived from the schedule of its assigned employee.

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  email text,
  phone text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_org_id_idx ON public.clients(org_id);
CREATE INDEX IF NOT EXISTS clients_assigned_to_idx ON public.clients(assigned_to);

-- RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Everyone in the org can read clients
CREATE POLICY "clients_select" ON public.clients FOR SELECT USING (
  org_id = public.requesting_org_id()
);

-- Only owners/admins can create, update, or delete clients
CREATE POLICY "clients_insert" ON public.clients FOR INSERT WITH CHECK (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "clients_update" ON public.clients FOR UPDATE USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
CREATE POLICY "clients_delete" ON public.clients FOR DELETE USING (
  org_id = public.requesting_org_id() AND public.requesting_user_role() IN ('owner', 'admin')
);
