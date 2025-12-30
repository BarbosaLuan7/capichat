-- Corrigir recursão infinita na policy de profiles
-- O problema: a policy SELECT faz subconsulta em profiles para verificar team_id

-- Primeiro, remover a policy problemática
DROP POLICY IF EXISTS "Users can view profiles from same tenant or team" ON public.profiles;

-- Criar uma função SECURITY DEFINER que busca o team_id do usuário atual
-- Isso evita a recursão porque a função executa com privilégios elevados
CREATE OR REPLACE FUNCTION public.get_current_user_team_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Recriar a policy usando a função em vez de subconsulta direta
CREATE POLICY "Users can view profiles from same tenant or team"
ON public.profiles
FOR SELECT
USING (
  -- Admins podem ver todos
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Usuário pode ver seu próprio perfil
  id = auth.uid()
  OR
  -- Usuários do mesmo time
  (team_id IS NOT NULL AND team_id = get_current_user_team_id())
  OR
  -- Usuários do mesmo tenant
  EXISTS (
    SELECT 1 FROM public.user_tenants ut1
    JOIN public.user_tenants ut2 ON ut1.tenant_id = ut2.tenant_id
    WHERE ut1.user_id = auth.uid() 
    AND ut2.user_id = profiles.id 
    AND ut1.is_active = true 
    AND ut2.is_active = true
  )
);