-- =============================================
-- Migração: Índices compostos para performance
-- Data: 2026-01-22
-- Descrição: Adiciona índices para queries frequentes
-- =============================================

-- Performance: Inbox - Listagem de conversas por status
-- Usado em: useConversationsInfinite, Inbox filters
CREATE INDEX IF NOT EXISTS idx_conversations_status_created
  ON public.conversations(status, created_at DESC);

-- Performance: Messages - Contagem de não lidas (badges)
-- Usado em: useInboxRealtime, unread count
CREATE INDEX IF NOT EXISTS idx_messages_status_conv
  ON public.messages(status, conversation_id);

-- Performance: Dashboard - Leads por status e tenant
-- Usado em: useLeads, Dashboard metrics
CREATE INDEX IF NOT EXISTS idx_leads_status_tenant
  ON public.leads(status, tenant_id);

-- Performance: Tasks - Lista por prioridade e responsável
-- Usado em: useTasks, Tasks page
CREATE INDEX IF NOT EXISTS idx_tasks_priority_assigned
  ON public.tasks(priority, assigned_to, status);

-- Performance: RLS - Evita N+1 em policies de profiles
-- Usado em: RLS policies com subquery em profiles
CREATE INDEX IF NOT EXISTS idx_profiles_id_team
  ON public.profiles(id, team_id);

-- Performance: API Keys - Validação rápida
-- Usado em: validate_api_key function
CREATE INDEX IF NOT EXISTS idx_api_keys_hash_active
  ON public.api_keys(key_hash, is_active);

-- Performance: WhatsApp Config - Lookup de configs ativas
-- Usado em: getWAHAConfigByTenant
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_active_tenant
  ON public.whatsapp_config(is_active, tenant_id);
