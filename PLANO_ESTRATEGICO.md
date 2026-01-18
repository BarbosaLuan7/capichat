# CapiChat - Plano Estratégico de Melhorias

> **Objetivo**: Transformar o CapiChat em um sistema Omni Channel funcional (similar ao Chatwoot)
> **Uso**: Exclusivo do escritório
> **Equipe**: 4-10 pessoas
> **Data**: Janeiro 2026

---

## Diagnóstico Atual

### O que já existe (backend implementado):
- [x] Banco de dados PostgreSQL com 64 migrações
- [x] 41 Edge Functions (APIs)
- [x] Autenticação e RLS (Row Level Security)
- [x] Integração WhatsApp multi-provedor (WAHA, Evolution, Z-API)
- [x] Sistema de automações
- [x] Gestão de leads com funil
- [x] Sistema de tarefas
- [x] Webhooks
- [x] IA (sugestões, classificação)

### Problema principal identificado:
- ⚠️ **Erros de sincronia do WhatsApp**

---

## Fase 1: Sincronia do WhatsApp 🔥

**Prioridade**: CRÍTICA
**Status**: Pendente

### Checklist de verificação:

#### 1.1 Recebimento de Mensagens
- [ ] Webhook `whatsapp-webhook` está recebendo requisições
- [ ] Mensagens estão sendo salvas na tabela `messages`
- [ ] Conversas são criadas automaticamente para novos contatos
- [ ] Lead é criado/vinculado à conversa
- [ ] Real-time está funcionando (mensagem aparece sem refresh)

#### 1.2 Envio de Mensagens
- [ ] Função `send-whatsapp-message` está funcionando
- [ ] Mensagem é salva no banco antes de enviar
- [ ] Confirmação de envio atualiza status
- [ ] Erro de envio é tratado corretamente

#### 1.3 Status das Mensagens
- [ ] Status "sent" quando enviada
- [ ] Status "delivered" quando entregue
- [ ] Status "read" quando lida
- [ ] Webhook de status está configurado no provedor

#### 1.4 Mídia (Arquivos)
- [ ] Imagens são recebidas e exibidas
- [ ] Áudios são recebidos e tocam
- [ ] Documentos são recebidos e baixam
- [ ] Envio de mídia funciona

#### 1.5 Configuração do Provedor
- [ ] URL da API configurada corretamente
- [ ] API Key/Token configurado
- [ ] Webhook URL configurado no provedor apontando para Supabase
- [ ] Instância do WhatsApp conectada (QR Code escaneado)

### Arquivos relevantes para correção:
```
supabase/functions/whatsapp-webhook/index.ts      # Recebe mensagens
supabase/functions/send-whatsapp-message/index.ts # Envia mensagens
supabase/functions/api-messages-receive/index.ts  # Processa mensagens
src/hooks/useMessages.ts                          # Hook de mensagens
src/hooks/useConversations.ts                     # Hook de conversas
```

---

## Fase 2: Fluxo de Atendimento 💬

**Prioridade**: Alta
**Status**: Pendente

### Checklist:

#### 2.1 Inbox (Caixa de Entrada)
- [ ] Lista de conversas carrega corretamente
- [ ] Conversas ordenadas por última mensagem
- [ ] Badge de mensagens não lidas
- [ ] Busca de conversas funciona
- [ ] Filtros funcionam (aberto, pendente, resolvido)

#### 2.2 Conversa Individual
- [ ] Histórico de mensagens carrega
- [ ] Scroll infinito para mensagens antigas
- [ ] Campo de texto envia mensagem
- [ ] Anexar arquivos funciona
- [ ] Emojis funcionam

#### 2.3 Gestão de Atendimento
- [ ] Atribuir conversa para atendente
- [ ] Transferir conversa entre atendentes
- [ ] Marcar como pendente
- [ ] Marcar como resolvido
- [ ] Reabrir conversa

#### 2.4 Colaboração
- [ ] Notas internas (visíveis só para equipe)
- [ ] Menções de colegas
- [ ] Histórico de quem atendeu

### Arquivos relevantes:
```
src/pages/Inbox.tsx                               # Página principal
src/components/inbox/ConversationList.tsx         # Lista de conversas
src/components/inbox/ChatArea.tsx                 # Área de chat
src/components/inbox/MessageComposer.tsx          # Compositor de mensagem
```

---

## Fase 3: Gestão de Leads 📋

**Prioridade**: Média
**Status**: Pendente

### Checklist:

#### 3.1 CRUD de Leads
- [ ] Criar lead manualmente
- [ ] Criar lead a partir de conversa
- [ ] Editar informações do lead
- [ ] Excluir lead
- [ ] Campos customizados funcionam

#### 3.2 Funil (Kanban)
- [ ] Visualização Kanban carrega
- [ ] Etapas do funil configuráveis
- [ ] Arrastar lead entre etapas
- [ ] Cores das etapas
- [ ] Contagem de leads por etapa

#### 3.3 Organização
- [ ] Labels/etiquetas funcionam
- [ ] Atribuir lead para responsável
- [ ] Temperatura do lead (frio/morno/quente)
- [ ] Filtros por etapa, label, responsável

#### 3.4 Histórico
- [ ] Timeline de atividades do lead
- [ ] Registro de mudanças de etapa
- [ ] Registro de mensagens enviadas
- [ ] Registro de tarefas

### Arquivos relevantes:
```
src/pages/Leads.tsx                               # Página de leads
src/components/leads/LeadKanban.tsx               # Kanban
src/hooks/useLeads.ts                             # Hook de leads
supabase/functions/api-leads/index.ts             # API de leads
```

---

## Fase 4: Automações ⚡

**Prioridade**: Média-Baixa
**Status**: Pendente

### Checklist:

#### 4.1 Triggers (Gatilhos)
- [ ] Nova conversa iniciada
- [ ] Lead criado
- [ ] Lead mudou de etapa
- [ ] Conversa sem resposta há X minutos
- [ ] Label adicionada

#### 4.2 Ações
- [ ] Enviar mensagem automática
- [ ] Atribuir para atendente
- [ ] Mover lead para etapa
- [ ] Adicionar label
- [ ] Criar tarefa
- [ ] Enviar notificação

#### 4.3 Interface
- [ ] Criar automação
- [ ] Ativar/desativar automação
- [ ] Testar automação
- [ ] Logs de execução

### Arquivos relevantes:
```
src/pages/Automations.tsx                         # Página de automações
supabase/functions/process-automations/index.ts   # Processador
```

---

## Fase 5: Extras 🎁

**Prioridade**: Baixa
**Status**: Futuro

- [ ] Dashboard com métricas reais
- [ ] Relatórios de atendimento
- [ ] Chatbot com fluxos
- [ ] Agendamento de mensagens
- [ ] Campanhas em massa
- [ ] Integração com calendário
- [ ] App mobile (PWA)

---

## Como usar este documento

1. **Diagnóstico**: Vamos testar cada item e marcar [x] ou identificar bugs
2. **Correção**: Para cada bug, criar issue ou corrigir diretamente
3. **Validação**: Testar novamente após correção
4. **Próxima fase**: Só avançar quando fase anterior estiver estável

---

## 🔍 ANÁLISE TÉCNICA DA INTEGRAÇÃO WAHA

> Análise realizada em Janeiro 2026

### Estado do Código

O código da integração WhatsApp é **bem estruturado e completo** (2300+ linhas), mas a complexidade pode causar problemas.

### Pontos Positivos ✅
1. **Deduplicação implementada** - Usa `waha_message_id` como chave única
2. **Multi-provedor** - Suporta WAHA, Evolution, Z-API
3. **Tratamento de LID** - Resolve números do Facebook Ads
4. **Upload de mídia** - Baixa e salva no Storage
5. **Status de mensagens** - Tracked (sent → delivered → read)

### Possíveis Causas dos Problemas ⚠️

#### 1. Mensagens Não Chegam
| Causa Provável | Verificação |
|----------------|-------------|
| Webhook URL incorreta | Conferir URL no painel do WAHA |
| Session/Instance name errado | `instance_name` no banco ≠ session no WAHA |
| Webhook não configurado no WAHA | Verificar se events estão habilitados |
| Firewall/CORS bloqueando | Verificar logs do Supabase |

#### 2. Mensagens Não Enviam
| Causa Provável | Verificação |
|----------------|-------------|
| API Key incorreta | Testar conexão nas configurações |
| Formato de telefone | Código 55 + DDD + número |
| Sessão desconectada | QR Code precisa ser re-escaneado |
| Erro silencioso no código | Verificar logs da Edge Function |

#### 3. Duplicação de Mensagens
| Causa Provável | Verificação |
|----------------|-------------|
| WAHA envia `message` e `message.any` | Configurar apenas UM evento |
| `message.ack` cria mensagem se não existe | Pode criar duplicata |
| Race condition | Webhook chamado 2x rápido |
| `waha_message_id` não sendo extraído | Log mostra ID null |

#### 4. Atraso/Demora
| Causa Provável | Verificação |
|----------------|-------------|
| Cold start do Supabase | Primeira requisição demora |
| Download de mídia lento | URL do WAHA pode estar lenta |
| Muitos fallbacks no código | Várias tentativas de busca de lead |

### Configuração Crítica do WAHA

No painel do WAHA, configurar webhook assim:
```
URL: https://[projeto].supabase.co/functions/v1/whatsapp-webhook
Events: message, message.ack (NÃO usar message.any junto com message)
```

### Logs para Verificar

No Supabase Dashboard > Edge Functions > Logs:
- `[whatsapp-webhook] Recebido:` - Confirma que chegou
- `[whatsapp-webhook] ⏭️ Mensagem já processada` - Duplicata detectada
- `[whatsapp-webhook] Lead encontrado:` - Lead vinculado
- `[send-whatsapp-message] Enviando mensagem:` - Enviando

---

## Anotações e Bugs Encontrados

### Fase 1 - WhatsApp
| Data | Problema | Status | Solução |
|------|----------|--------|---------|
| 18/01 | Sincronia geral | Investigando | Ver análise acima |

### Fase 2 - Atendimento
| Data | Problema | Status | Solução |
|------|----------|--------|---------|
| | | | |

### Fase 3 - Leads
| Data | Problema | Status | Solução |
|------|----------|--------|---------|
| | | | |

### Fase 4 - Automações
| Data | Problema | Status | Solução |
|------|----------|--------|---------|
| | | | |

---

## Próximos Passos

1. **Imediato**: Diagnosticar os erros de sincronia do WhatsApp
2. **Curto prazo**: Corrigir problemas da Fase 1
3. **Médio prazo**: Validar e corrigir Fases 2 e 3
4. **Longo prazo**: Implementar automações e extras

---

*Documento criado em: Janeiro 2026*
*Última atualização: Janeiro 2026*
