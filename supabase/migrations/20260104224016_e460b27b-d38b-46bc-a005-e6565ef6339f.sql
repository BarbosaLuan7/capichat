-- Corrigir FK teams.supervisor_id para apontar para profiles ao invés de auth.users
-- Isso permite que o PostgREST resolva a relação supervisor:supervisor_id(...)

ALTER TABLE public.teams 
  DROP CONSTRAINT IF EXISTS teams_supervisor_id_fkey;

ALTER TABLE public.teams 
  ADD CONSTRAINT teams_supervisor_id_fkey 
  FOREIGN KEY (supervisor_id) 
  REFERENCES public.profiles(id) 
  ON DELETE SET NULL;