# Capichat vs Chatwoot - Análise Comparativa Completa

**Data:** Janeiro 2026
**Versão:** 1.0
**Autor:** Análise técnica do repositório Capichat

---

## Sumário Executivo

Este documento apresenta uma análise comparativa detalhada entre o **Capichat** (CRM jurídico desenvolvido internamente) e o **Chatwoot** (plataforma open-source de atendimento ao cliente).

### Resultado Geral

| Categoria         | Vencedor     | Margem       |
| ----------------- | ------------ | ------------ |
| UI/UX             | **Capichat** | Grande       |
| Inbox/Conversas   | Empate       | -            |
| CRM/Leads         | **Capichat** | Muito grande |
| Tags/Labels       | **Capichat** | Moderada     |
| Notas Internas    | Empate       | -            |
| IA Nativa         | **Capichat** | Grande       |
| Automações        | **Capichat** | Moderada     |
| Custom Attributes | Empate       | -            |
| Dashboard         | **Capichat** | Moderada     |
| Webhooks/N8N      | **Capichat** | Grande       |
| Multi-tenancy     | **Capichat** | Muito grande |
| WhatsApp          | **Capichat** | Moderada     |

**Conclusão:** O Capichat vence em 8 de 12 categorias, com vantagens significativas em CRM, Multi-tenancy e IA.

---

## 1. UI/UX - Interface e Experiência do Usuário

### 1.1 Stack Tecnológico

| Aspecto           | Capichat                                               | Chatwoot         |
| ----------------- | ------------------------------------------------------ | ---------------- |
| **Framework UI**  | shadcn-ui + Radix UI + Tailwind                        | Vue.js + próprio |
| **Design System** | Tokens W3C DTCG (colors, spacing, typography, effects) | Básico           |
| **Dark Mode**     | Nativo (next-themes)                                   | Nativo           |
| **Animações**     | Framer Motion + Tailwind keyframes                     | Básico           |
| **Componentes**   | 51 primitivos + 44 de domínio                          | ~30 componentes  |

### 1.2 Personalização

**Capichat:**

- CSS variables customizáveis
- Cores de domínio (temperatura de lead, estágios de funil)
- Personalização por tenant (logo, cores por empresa)
- Design tokens padronizados W3C DTCG

**Chatwoot:**

- Requer modificação de código fonte (Community Edition)
- Personalização via Enterprise Edition (paga)
- Sem suporte a multi-tenant customization

### 1.3 Acessibilidade

**Capichat:**

- ARIA labels completos
- Keyboard shortcuts (Cmd+K para command palette)
- Skip links para navegação
- Focus ring customizado
- 46 componentes com atributos aria-\*

**Chatwoot:**

- Suporte parcial a acessibilidade

### 1.4 Veredicto

**Vencedor: Capichat**

O Capichat possui design system mais sofisticado, tokens padronizados, animações fluidas e personalização por tenant. Chatwoot é mais genérico e requer modificação de código para personalização profunda.

---

## 2. Sistema de Conversas/Inbox

### 2.1 Funcionalidades

| Aspecto                  | Capichat                                   | Chatwoot                            |
| ------------------------ | ------------------------------------------ | ----------------------------------- |
| **Realtime**             | Supabase Realtime (postgres_changes)       | ActionCable (Rails)                 |
| **Virtualização**        | React Virtual (listas infinitas)           | Básico                              |
| **Filtros**              | Status, labels, assignee, data, favoritos  | Status, labels, assignee            |
| **Favoritos**            | Toggle por conversa                        | Não disponível                      |
| **Unread count**         | Badge dinâmico                             | Disponível                          |
| **Status de mensagem**   | sending → sent → delivered → read → failed | sent → delivered → read             |
| **Media support**        | text, image, audio, video, document        | text, image, audio, video, document |
| **Respostas (reply_to)** | reply_to_external_id                       | Disponível                          |
| **Mensagens internas**   | is_internal_note flag                      | Private notes                       |

### 2.2 Arquitetura Técnica Capichat

**Hooks principais:**

- `useConversations.ts` - Gerenciamento com cache otimizado
- `useConversationsInfinite.ts` - Paginação infinita
- `useInboxRealtime.ts` - Subscriptions unificadas

**Componentes:**

- `ConversationList.tsx` - Lista virtualizada (666 linhas)
- `ChatArea.tsx` - Área principal de chat (934 linhas)
- `MessageBubble.tsx` - Bolhas de mensagem (896 linhas)
- `VirtualizedMessageList.tsx` - Lista virtualizada (543 linhas)

### 2.3 Veredicto

**Empate técnico**

Ambos são robustos. Capichat tem virtualização superior para grandes volumes; Chatwoot oferece mais canais nativos (email, widget, etc).

---

## 3. Sistema de Leads/CRM

### 3.1 Modelo de Dados

| Aspecto                    | Capichat                            | Chatwoot       |
| -------------------------- | ----------------------------------- | -------------- |
| **Modelo**                 | Lead = Contato + Oportunidade       | Contact apenas |
| **Temperatura**            | cold/warm/hot com cores             | Não existe     |
| **Funil/Pipeline**         | 7 estágios customizáveis (Kanban)   | Não nativo     |
| **Benefit type**           | Tipo de benefício (jurídico)        | Não existe     |
| **Timeline de atividades** | lead_activities completo            | Básico         |
| **Import em lote**         | CSV/Excel com mapeamento            | CSV básico     |
| **Avatar dinâmico**        | WhatsApp avatar + DiceBear fallback | Básico         |
| **Documentos**             | Document checklist por lead         | Não existe     |

### 3.2 Funcionalidades CRM Capichat

**Temperatura de Leads:**

- **Frio (cold):** Cor azul (#3b82f6) - Lead inicial
- **Morno (warm):** Cor amarela (#f59e0b) - Interesse demonstrado
- **Quente (hot):** Cor vermelha (#ef4444) - Pronto para fechar

**Funil de Vendas:**

- 7 estágios customizáveis com cores
- Visualização Kanban drag-and-drop
- Automação por mudança de estágio

**Timeline de Atividades:**

- Registro automático de todas interações
- Histórico de mudanças de status
- Auditoria completa

### 3.3 Veredicto

**Vencedor: Capichat (margem muito grande)**

O Capichat foi construído como CRM jurídico. Chatwoot é help desk, não CRM. Temperatura, funil, documentos e timeline de atividades não existem no Chatwoot nativamente.

---

## 4. Sistema de Tags/Labels

### 4.1 Comparação

| Aspecto           | Capichat                  | Chatwoot            |
| ----------------- | ------------------------- | ------------------- |
| **Categorização** | 7 categorias inteligentes | Lista flat          |
| **Cores**         | 10 cores predefinidas     | Cores customizáveis |
| **Ícones**        | Por categoria             | Não disponível      |
| **API**           | REST completa             | REST                |
| **Automação**     | Trigger em label_added    | Trigger em label    |
| **Multi-tenant**  | Labels por tenant         | Global apenas       |

### 4.2 Categorias de Labels no Capichat

| Categoria         | Ícone | Uso                  |
| ----------------- | ----- | -------------------- |
| Origem/Campanha   | 🏷️    | Fonte do lead        |
| Tipo de Benefício | 🎯    | Benefício pretendido |
| Condição de Saúde | 🏥    | Doenças/deficiências |
| Interesse         | ⭐    | Nível de interesse   |
| Status            | 📊    | Status atual         |
| Situação          | 📋    | Situação processual  |
| Desqualificação   | ❌    | Motivo de descarte   |

### 4.3 Veredicto

**Vencedor: Capichat**

Categorização inteligente é um diferencial significativo para organização e filtros avançados.

---

## 5. Notas Internas

### 5.1 Comparação

| Aspecto                | Capichat                    | Chatwoot       |
| ---------------------- | --------------------------- | -------------- |
| **Por conversa**       | Realtime                    | Private notes  |
| **Histórico de autor** | Avatar + nome + timestamp   | Disponível     |
| **Edição/Deleção**     | Com confirmação             | Disponível     |
| **Activity log**       | Registra em lead_activities | Não disponível |

### 5.2 Funcionalidades Capichat

- Notas isoladas por conversa para colaboração interna
- Subscrição Supabase em tempo real
- Cada nota mostra autor (avatar + nome) e timestamp formatado
- Interface com dropdown menu para edit/delete
- Alert dialog antes de deletar
- Feedback visual "Salvo ✓" por 2 segundos
- Registro automático em lead_activities

### 5.3 Veredicto

**Empate**

Funcionalidade similar em ambos, com pequena vantagem do Capichat pelo registro em activity log.

---

## 6. Inteligência Artificial Nativa

### 6.1 Comparação

| Aspecto                   | Capichat                           | Chatwoot                |
| ------------------------- | ---------------------------------- | ----------------------- |
| **Resumo de conversa**    | 8 campos estruturados (Gemini 2.5) | Summary básico (OpenAI) |
| **Classificação**         | Temperatura + benefício + labels   | Não disponível          |
| **Sugestão de resposta**  | useAISuggestions                   | Reply suggestion        |
| **Detecção de reminders** | useAIReminders                     | Não disponível          |
| **Reescrita**             | Não disponível                     | Improve with AI (tom)   |
| **Provider**              | Google Gemini via Lovable          | OpenAI apenas           |
| **Cache**                 | aiCache client-side                | Não disponível          |

### 6.2 Resumo Estruturado Capichat (8 campos)

O resumo de IA do Capichat extrai automaticamente:

1. **Situação:** Descrição breve do caso
2. **Benefício:** Tipo de benefício (BPC, Aposentadoria, etc)
3. **Condições:** Doenças/deficiências mencionadas
4. **Documentos recebidos:** Lista com checkmark ✓
5. **Documentos pendentes:** Lista com relógio ⏳
6. **Datas importantes:** Perícias, prazos com descrição
7. **Próximos passos:** Ações necessárias (bullet list)
8. **Observações:** Notas relevantes para advogado

### 6.3 Classificação Automática Capichat

- **Temperatura:** Análise automática (frio/morno/quente)
- **Tipo de benefício:** Detecção do benefício pretendido
- **Labels sugeridas:** Sugestão automática de etiquetas
- **Confidence score:** Nível de confiança da classificação

### 6.4 Veredicto

**Vencedor: Capichat (margem grande)**

Resumo estruturado com 8 campos específicos para jurídico é muito superior ao resumo genérico do Chatwoot. Classificação automática não existe no Chatwoot.

---

## 7. Automações

### 7.1 Comparação

| Aspecto           | Capichat                | Chatwoot       |
| ----------------- | ----------------------- | -------------- |
| **Triggers**      | 7 tipos                 | ~6 tipos       |
| **Condições**     | 6 operadores            | Similar        |
| **Ações**         | 8 tipos                 | ~6 tipos       |
| **Macros**        | Não explícito           | 1-click macros |
| **UI Builder**    | Visual com drag-drop    | Visual         |
| **Processamento** | Queue-based (100 batch) | Síncrono       |

### 7.2 Triggers Disponíveis (Capichat)

| Trigger                    | Descrição                |
| -------------------------- | ------------------------ |
| `lead_created`             | Novo lead cadastrado     |
| `lead_stage_changed`       | Lead mudou de etapa      |
| `lead_temperature_changed` | Temperatura alterada     |
| `lead_no_response`         | Sem resposta por X horas |
| `lead_label_added`         | Etiqueta adicionada      |
| `task_overdue`             | Tarefa vencida           |
| `conversation_no_response` | Conversa sem resposta    |

### 7.3 Ações Disponíveis (Capichat)

| Ação                      | Descrição                   |
| ------------------------- | --------------------------- |
| `move_lead_to_stage`      | Mover para etapa específica |
| `change_lead_temperature` | Alterar temperatura         |
| `add_label`               | Adicionar etiqueta          |
| `remove_label`            | Remover etiqueta            |
| `create_task`             | Criar tarefa com prioridade |
| `notify_user`             | Enviar notificação          |
| `assign_to_user`          | Atribuir lead a usuário     |
| `send_message`            | Enviar mensagem automática  |

### 7.4 Operadores de Condição

- `equals` - Igual a
- `not_equals` - Diferente de
- `contains` - Contém
- `greater_than` - Maior que
- `less_than` - Menor que
- `in` / `not_in` - Está em lista

### 7.5 Veredicto

**Vencedor: Capichat**

Mais ações específicas para CRM (move_stage, change_temp). Chatwoot tem Macros (1-click) que Capichat não possui.

---

## 8. Custom Attributes (Campos Personalizados)

### 8.1 Comparação

| Aspecto               | Capichat         | Chatwoot               |
| --------------------- | ---------------- | ---------------------- |
| **Tipos**             | 6 tipos          | 5 tipos                |
| **Por entity**        | Lead             | Contact + Conversation |
| **Multi-tenant**      | Por tenant       | Global                 |
| **Ordem de exibição** | display_order    | Não disponível         |
| **Obrigatório**       | is_required flag | Não disponível         |

### 8.2 Tipos de Campo (Capichat)

| Tipo               | Descrição            |
| ------------------ | -------------------- |
| `texto`            | Campo de texto livre |
| `numero`           | Campo numérico       |
| `data`             | Seletor de data      |
| `selecao`          | Dropdown de opções   |
| `selecao_multipla` | Multiselect          |
| `booleano`         | Checkbox true/false  |

### 8.3 Veredicto

**Empate**

Similar em capacidade. Capichat tem vantagem em multi-tenant.

---

## 9. Dashboard e Métricas

### 9.1 Comparação

| Aspecto          | Capichat                     | Chatwoot       |
| ---------------- | ---------------------------- | -------------- |
| **KPIs**         | 4 cards principais           | ~6 cards       |
| **Gráficos**     | 6+ tipos                     | ~4 básicos     |
| **Drill-down**   | Clica → lista filtrada       | Não disponível |
| **Exportação**   | CSV (5 opções)               | Básico         |
| **Multi-tenant** | Por empresa                  | Não disponível |
| **Período**      | Hoje, Semana, Mês, Trimestre | Similar        |

### 9.2 KPIs Principais (Capichat)

1. **Total de Leads** - Com % de mudança vs período anterior
2. **Conversas Abertas** - Total e abertas
3. **Taxa de Resolução** - % de conversas resolvidas
4. **Leads Quentes** - Prontos para fechar

### 9.3 Gráficos Disponíveis (Capichat)

| Gráfico                     | Tipo           | Descrição                 |
| --------------------------- | -------------- | ------------------------- |
| Funil de Conversão          | Bar horizontal | Taxa entre etapas         |
| Origem dos Leads            | Pie chart      | Distribuição por fonte    |
| Evolução Diária             | Area chart     | Novos leads por dia       |
| Distribuição de Temperatura | Progress bars  | Frio/Morno/Quente         |
| Performance da Equipe       | Ranking        | Por atendente             |
| Status das Conversas        | Progress bars  | Aberta/Pendente/Resolvida |

### 9.4 Funcionalidades Avançadas

- **Drill-down interativo:** Clica no gráfico → modal com lista de leads filtrada
- **Exportação CSV:** 5 opções (Leads, Funil, Conversas, Agentes, Tudo)
- **Multi-tenant:** Indicadores por empresa quando multi-tenant
- **Filtro temporal:** Dropdown com períodos predefinidos

### 9.5 Veredicto

**Vencedor: Capichat**

Drill-down interativo e exportação CSV são diferenciais importantes para análise de dados.

---

## 10. Webhooks e Integrações

### 10.1 Comparação

| Aspecto        | Capichat                                               | Chatwoot                                 |
| -------------- | ------------------------------------------------------ | ---------------------------------------- |
| **Eventos**    | message.received, conversation.opened, lead.updated... | message_created, conversation_created... |
| **Payload**    | IDs legíveis (lead*, msg*, conv\_)                     | IDs numéricos                            |
| **Retry**      | Backoff exponencial                                    | Disponível                               |
| **Logs**       | webhook_logs com status, response                      | Disponível                               |
| **N8N**        | Funções dedicadas                                      | Genérico                                 |
| **Dispatcher** | Formatação rica                                        | Básico                                   |

### 10.2 Edge Functions N8N (Capichat)

| Função               | Descrição                       |
| -------------------- | ------------------------------- |
| `create-n8n-webhook` | Setup automático de webhook N8N |
| `n8n-ai-response`    | Recebe respostas do N8N         |

**Payload n8n-ai-response:**

```json
{
  "phone": "+5545999999999",
  "message": "Resposta da IA",
  "type": "text",
  "media_url": "opcional",
  "lead_data": {
    "temperature": "hot",
    "labels": ["interessado"]
  }
}
```

### 10.3 Dispatcher de Webhooks (Capichat)

- Formata payloads com IDs legíveis (lead*, msg*, conv*, usr*)
- Formata telefones e CPF automaticamente
- Retry logic com backoff exponencial
- Logging detalhado em `webhook_logs`

### 10.4 Veredicto

**Vencedor: Capichat (margem grande)**

Integração N8N dedicada com funções específicas é um grande diferencial para automação avançada.

---

## 11. Multi-tenancy

### 11.1 Comparação

| Aspecto                    | Capichat                         | Chatwoot                      |
| -------------------------- | -------------------------------- | ----------------------------- |
| **Modelo**                 | RLS por tenant_id                | Instância única ou Enterprise |
| **Usuários multi-empresa** | user_tenants com role por tenant | Não disponível                |
| **Seletor de empresa**     | Dropdown no header               | Não disponível                |
| **Dados isolados**         | Todas queries filtram tenant_id  | Depende da versão             |

### 11.2 Arquitetura Multi-tenant (Capichat)

**Contexto React:**

- `tenants: Tenant[]` - Empresas do usuário
- `currentTenant: Tenant | null` - Empresa selecionada
- `userTenants: UserTenant[]` - Associações user-tenant
- `getUserTenantRole(tenantId)` - Role do usuário naquele tenant

**Schema Database:**

```sql
tenants {
  id, name, slug, logo_url,
  is_active, settings (jsonb)
}

user_tenants {
  user_id, tenant_id,
  role (admin|manager|agent|viewer)
}
```

**Row Level Security:**

```typescript
// Todas queries filtram por tenant_id
query = query.eq('tenant_id', tenantId);
```

### 11.3 RBAC (Role-Based Access Control)

| Role        | Permissões                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Admin**   | manage_users, manage_teams, manage_settings, view_all_leads, manage_labels, manage_automations, view_reports, manage_templates |
| **Manager** | view_team_leads, view_reports, manage_labels, manage_templates                                                                 |
| **Agent**   | view_own_leads                                                                                                                 |
| **Viewer**  | Read-only                                                                                                                      |

### 11.4 Veredicto

**Vencedor: Capichat (margem muito grande)**

Chatwoot Community não tem multi-tenancy real. Capichat foi construído desde o início para suportar múltiplas empresas com isolamento completo de dados.

---

## 12. Integração WhatsApp

### 12.1 Comparação

| Aspecto                  | Capichat                            | Chatwoot        |
| ------------------------ | ----------------------------------- | --------------- |
| **Providers**            | WAHA, Evolution API, Z-API, Custom  | WAHA, Cloud API |
| **Múltiplas instâncias** | Por tenant                          | Limitado        |
| **Teste de conexão**     | whatsapp-test-connection            | Não disponível  |
| **Avatar sync**          | get-whatsapp-avatar + refresh batch | Não disponível  |
| **Grupos**               | Detecta e ignora                    | Detecta         |
| **LID Facebook**         | resolve-facebook-lids               | Não disponível  |

### 12.2 Edge Functions WhatsApp (Capichat)

| Função                     | Descrição                   |
| -------------------------- | --------------------------- |
| `whatsapp-webhook`         | Webhook receptor (LISTENER) |
| `send-whatsapp-message`    | Envio de mensagens          |
| `whatsapp-test-connection` | Testar conectividade        |
| `whatsapp-test-message`    | Enviar mensagem teste       |
| `delete-whatsapp-message`  | Deletar mensagens           |
| `get-whatsapp-avatar`      | Fetch avatares de contacts  |
| `refresh-lead-avatars`     | Batch refresh de avatares   |
| `resolve-facebook-lids`    | Resolve Facebook LID format |

### 12.3 Veredicto

**Vencedor: Capichat**

Mais providers suportados, avatar sync automático, e múltiplas instâncias por tenant.

---

## 13. Infraestrutura e Stack Técnico

### 13.1 Capichat

**Frontend:**

- React 18 + TypeScript + Vite
- TanStack React Query v5 (data fetching + caching)
- Zustand (state management minimal)
- React Hook Form + Zod (forms + validation)
- shadcn-ui + Tailwind CSS + Radix UI
- Framer Motion (animations)
- Lucide React (icons)
- Sonner (toasts)

**Backend:**

- Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- Deno (edge functions runtime)
- RLS (Row Level Security)

**Edge Functions:** 49 funções serverless

### 13.2 Chatwoot

**Frontend:**

- Vue.js 3
- Vuex (state management)
- SCSS

**Backend:**

- Ruby on Rails
- PostgreSQL
- Redis
- Sidekiq (background jobs)

### 13.3 Comparação de Manutenção

| Aspecto               | Capichat                      | Chatwoot             |
| --------------------- | ----------------------------- | -------------------- |
| **Complexidade**      | Média (serverless)            | Alta (Rails)         |
| **Deploy**            | Supabase (gerenciado)         | Self-hosted ou cloud |
| **Escalabilidade**    | Auto-scaling (Edge Functions) | Manual               |
| **Custo operacional** | ~R$150-200/mês                | Similar ou maior     |

---

## 14. Análise de Custos

### 14.1 Cenário Atual (flwchat)

| Item               | Custo Mensal         |
| ------------------ | -------------------- |
| Plataforma flwchat | R$ 500-1.000         |
| **TOTAL**          | **R$ 500-1.000/mês** |

### 14.2 Cenário Chatwoot

| Item                       | Custo Mensal        |
| -------------------------- | ------------------- |
| Servidor (4GB RAM, 2 vCPU) | R$ 150-200          |
| WAHA (self-hosted)         | R$ 0                |
| Manutenção                 | 2-4h/mês            |
| **TOTAL**                  | **~R$ 150-200/mês** |

### 14.3 Cenário Capichat

| Item                 | Custo Mensal    |
| -------------------- | --------------- |
| Supabase (Pro)       | ~R$ 125         |
| Lovable Gateway (IA) | Incluído        |
| Domínio/SSL          | ~R$ 10          |
| **TOTAL**            | **~R$ 135/mês** |

### 14.4 Economia Comparativa

| Comparação         | Economia Mensal | Economia Anual  |
| ------------------ | --------------- | --------------- |
| flwchat → Chatwoot | R$ 350-800      | R$ 4.200-9.600  |
| flwchat → Capichat | R$ 365-865      | R$ 4.380-10.380 |

---

## 15. Recomendação Final

### 15.1 Motivos para NÃO migrar para Chatwoot

1. **CRM jurídico completo já construído** - Chatwoot é help desk, não CRM
2. **Funcionalidades únicas** - Temperatura, funil, documentos não existem no Chatwoot
3. **IA estruturada** - Resumo com 8 campos específicos para casos jurídicos
4. **Multi-tenancy real** - Chatwoot Community não oferece
5. **Integração N8N** - Já funciona com funções dedicadas

### 15.2 Motivos para CONSIDERAR Chatwoot

1. **Mais canais nativos** - Email, widget, Instagram, Telegram
2. **Comunidade maior** - Mais plugins e suporte
3. **Macros** - Ações 1-click para workflows rápidos
4. **Menos desenvolvimento** - Plataforma pronta

### 15.3 Conclusão

**Recomendação: Continuar com Capichat**

O Capichat já está em produção com funcionalidades que o Chatwoot não possui nativamente. O investimento em desenvolvimento já foi realizado, e a integração N8N/Marina SDR está quase pronta.

### 15.4 Funcionalidades que podem ser adicionadas ao Capichat

| Funcionalidade           | Esforço | Prioridade |
| ------------------------ | ------- | ---------- |
| Macros (ações 1-click)   | Baixo   | Alta       |
| Canal Instagram          | Médio   | Média      |
| Canal Telegram           | Médio   | Média      |
| Widget de chat para site | Médio   | Baixa      |

---

## Anexo A: Estatísticas do Repositório Capichat

| Métrica                       | Valor             |
| ----------------------------- | ----------------- |
| **Componentes React**         | 166 arquivos .tsx |
| **Hooks customizados**        | 46+ hooks         |
| **Edge Functions**            | 49 funções        |
| **Migrations**                | 68+ migrações     |
| **Linhas de código (UI)**     | ~25.177 linhas    |
| **Componentes base (shadcn)** | 51 componentes    |

### Top 10 Componentes por Tamanho

| Componente                 | Linhas | Função                 |
| -------------------------- | ------ | ---------------------- |
| ChatArea.tsx               | 934    | Área principal de chat |
| LeadDetailsPanel.tsx       | 897    | Painel de detalhes     |
| MessageBubble.tsx          | 896    | Bolhas de mensagem     |
| Sidebar.tsx                | 734    | Componente sidebar     |
| ConversationList.tsx       | 666    | Lista de conversas     |
| ChatbotBuilder.tsx         | 659    | Builder visual         |
| TopNavigation.tsx          | 554    | Navegação principal    |
| VirtualizedMessageList.tsx | 543    | Lista virtualizada     |
| Inbox.tsx                  | 508    | Página principal       |
| LeadImportModal.tsx        | 507    | Import de leads        |

---

## Anexo B: Fontes e Referências

### Chatwoot

- [Documentação oficial](https://www.chatwoot.com/docs)
- [AI in Chatwoot](https://www.chatwoot.com/blog/ai-in-chatwoot/)
- [Dashboard Apps](https://www.chatwoot.com/hc/user-guide/articles/1677691702-how-to-use-dashboard-apps)
- [Automation Rules](https://www.chatwoot.com/features/automations/)
- [KanbanWoot](https://github.com/pucabala/kanbanwoot)
- [N8N Integration](https://n8n.io/workflows/8260-build-a-multichannel-customer-support-ai-assistant-with-chatwoot-and-openrouter/)

### Capichat

- Análise do repositório `/Users/luanbarbosa/capichat`
- CLAUDE.md (documentação interna)
- 49 Edge Functions analisadas
- 166 componentes React analisados

---

_Documento gerado em Janeiro 2026_
_Análise técnica baseada no código fonte do Capichat e documentação pública do Chatwoot_
