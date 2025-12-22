-- Adicionar novos campos ao leads para suportar funcionalidades do Conversapp
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS whatsapp_name text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS qualification jsonb DEFAULT '{}'::jsonb;

-- Inserir etapas reais do funil baseadas no CSV do usuário
DELETE FROM public.funnel_stages;

INSERT INTO public.funnel_stages (name, color, "order", grupo) VALUES
  ('📞 Atendimento Inicial', '#3B82F6', 1, 'Prospecção'),
  ('📅 Reunião Agendada', '#8B5CF6', 2, 'Prospecção'),
  ('📎 Aguardando Docs', '#F59E0B', 3, 'Qualificação'),
  ('📃 Contrato Enviado', '#10B981', 4, 'Comercial'),
  ('🚨 Elaborar Pasta', '#EF4444', 5, 'Comercial'),
  ('✍️ Assinado', '#22C55E', 6, 'Comercial'),
  ('⏳ Aguardando Processual', '#6366F1', 7, 'Operacional'),
  ('🏛️ Andamento Processual', '#0EA5E9', 8, 'Operacional'),
  ('🗂️ Aguardando INSS', '#F97316', 9, 'Operacional'),
  ('❌ Em Recurso', '#DC2626', 10, 'Conclusão'),
  ('🎉 Benefício Concedido', '#16A34A', 11, 'Conclusão'),
  ('🔴 Encerrado', '#64748B', 12, 'Conclusão');