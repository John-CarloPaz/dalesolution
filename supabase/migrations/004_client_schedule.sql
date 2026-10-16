-- A client now carries its own schedule. Assigning the client to an employee
-- propagates this schedule to that employee (see app logic).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES public.work_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_schedule_id_idx ON public.clients(schedule_id);
