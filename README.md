# CapiChat

Sistema de atendimento via WhatsApp para a GaranteDireito - escritório especializado em Direito Previdenciário.

## Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Supabase (Auth, PostgreSQL, Realtime, Edge Functions)
- **UI**: shadcn-ui + Tailwind CSS + Radix UI
- **State**: TanStack React Query + Zustand
- **IA**: Google Gemini (transcrição, sugestões, classificação)

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build

# Lint
npm run lint

# Formatar código
npm run format

# Rodar testes
npm test
```

## Estrutura do Projeto

```
src/
├── components/     # Componentes React
│   ├── ui/         # Primitivos shadcn-ui
│   ├── inbox/      # Tela de conversas
│   ├── leads/      # Gestão de leads
│   └── dashboard/  # Métricas
├── contexts/       # AuthContext, TenantContext
├── hooks/          # Custom hooks
├── pages/          # Páginas lazy-loaded
└── lib/            # Utilities

supabase/
├── functions/      # Edge Functions
│   ├── _shared/    # Módulos compartilhados (gemini, waha, etc)
│   └── */          # Funções individuais
└── migrations/     # Migrações SQL
```

## Funcionalidades

- **Inbox**: Conversa em tempo real via WhatsApp (WAHA + Meta)
- **Leads**: CRM com funil, etiquetas e temperatura
- **IA**: Sugestões de resposta, transcrição de áudio, classificação automática
- **Multi-tenancy**: Suporte a múltiplos escritórios
- **RBAC**: Roles (admin, manager, agent, viewer)

## Acessibilidade

O sistema segue WCAG 2.1 nível AA:

| Atalho        | Ação                       |
| ------------- | -------------------------- |
| `Ctrl+K`      | Busca rápida (Command Bar) |
| `Esc`         | Fechar modais              |
| `Enter`       | Enviar mensagem            |
| `Shift+Enter` | Nova linha na mensagem     |
| `Tab`         | Navegar entre elementos    |
| `/`           | Abrir seletor de templates |

## Deploy

```bash
# Deploy das Edge Functions
supabase functions deploy

# Push das migrações
supabase db push
```
