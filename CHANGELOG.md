# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-01-05

### Segurança

- **Validação de lead em `get-whatsapp-avatar`**: Retorna 404 se lead não existe, evitando vazamento de informações
- **Remoção de código de desenvolvimento**: Excluída página Seed e edge function seed-teams-users
- **Content-Security-Policy**: Configurada meta tag CSP no index.html para mitigar XSS

### UX/Performance

- **Tabs de status otimizados**: Labels curtos (Pend., Abertas, Resolv.) para melhor uso de espaço
- **Empty states contextuais**: Estados vazios específicos para cada filtro (pendentes, abertas, resolvidas)
- **Cache otimizado em `useMessagesInfinite`**: Funções de atualização só recriam páginas modificadas (padrão `hasMessage` check)
- **Cleanup automático de Sets**: Função `cleanupAutoRepairEntries` em `MessageBubble` evita memory leaks
- **Constantes extraídas**: `MEDIA_LABELS` e `MEDIA_ICONS_MAP` movidos para fora do componente
- **Botão "Agendar" removido**: Funcionalidade incompleta removida do modal de nova conversa

### Acessibilidade (WCAG 2.1)

- **aria-label em tabs**: Leitores de tela anunciam "Pendentes (não lidas): X conversas"
- **aria-hidden em ícones decorativos**: Ícones dos tabs não são lidos desnecessariamente
- **role="log" na lista de mensagens**: Container de mensagens identificado como log de chat
- **aria-live="polite"**: Novas mensagens são anunciadas automaticamente
- **role="listbox" na lista de conversas**: Semântica correta para lista selecionável
- **aria-activedescendant**: Conversa ativa é indicada para tecnologias assistivas
- **role="option" + aria-selected**: Itens de conversa indicam estado de seleção
- **aria-label no textarea**: Campo de mensagem identificado para leitores de tela

---

## Estrutura do Projeto

### Componentes de Inbox

- `ConversationStatusTabs.tsx` - Tabs de filtro por status com acessibilidade
- `ConversationList.tsx` - Lista virtualizada de conversas
- `ConversationItem.tsx` - Item individual de conversa
- `VirtualizedMessageList.tsx` - Lista virtualizada de mensagens
- `MessageBubble.tsx` - Bolha de mensagem com suporte a mídia
- `EmptyState.tsx` - Estados vazios reutilizáveis
- `ChatArea.tsx` - Área de input de mensagens

### Hooks

- `useMessagesInfinite.ts` - Paginação infinita com cache otimizado
- `useConversations.ts` - Gerenciamento de conversas
- `useLabels.ts` - Etiquetas de leads

### Edge Functions

- `get-whatsapp-avatar` - Busca avatar com validação de lead
- `repair-message-media` - Recuperação automática de mídia

---

## Diretrizes de Contribuição

1. **Acessibilidade**: Toda nova funcionalidade deve seguir WCAG 2.1 nível AA
2. **Performance**: Evitar recriação desnecessária de objetos em hooks
3. **Segurança**: Validar inputs e aplicar RLS policies
4. **Testes**: Testar com teclado e leitores de tela antes de merge
