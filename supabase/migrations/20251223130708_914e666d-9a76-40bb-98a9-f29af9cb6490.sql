-- Adicionar política RLS para permitir que agentes vejam conversas onde o lead está atribuído a eles
CREATE POLICY "Agents can view conversations for their assigned leads"
ON public.conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = conversations.lead_id 
    AND leads.assigned_to = auth.uid()
  )
);