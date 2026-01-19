# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos de Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build

# Lint
npm run lint

# Lint com correção automática
npm run lint:fix

# Formatar código com Prettier
npm run format

# Verificar formatação
npm run format:check

# Preview do build
npm run preview
```

## Tooling & CI/CD

### Code Quality
- **ESLint**: Linting com regras para React e TypeScript
- **Prettier**: Formatação automática com plugin Tailwind CSS (ordena classes)
- **Husky**: Pre-commit hooks para lint-staged
- **lint-staged**: Roda ESLint e Prettier em arquivos staged

### GitHub Actions
- CI workflow em `.github/workflows/ci.yml`
- Roda em push/PR para main, master, develop
- Jobs: lint, format check, type check, build

## Arquitetura

### Stack Principal
- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Supabase (Auth, PostgreSQL, Realtime, Edge Functions)
- **State**: TanStack React Query v5 + Zustand (minimal)
- **UI**: shadcn-ui + Tailwind CSS + Radix UI
- **Forms**: React Hook Form + Zod

### Estrutura do `/src`

```
/components
  /ui          → Primitivos shadcn-ui (49 componentes)
  /inbox       → Tela principal de conversas
  /leads       → Componentes de leads
  /dashboard   → Métricas e charts
  /layout      → MainLayout, Sidebar, etc.
/contexts      → AuthContext, TenantContext
/hooks         → 46+ custom hooks (useAuth, useConversations, useLeads, etc.)
/pages         → Páginas lazy-loaded
/tokens        → Design tokens em formato W3C DTCG
/integrations/supabase → Cliente e tipos gerados
/lib           → Utilities (logger, permissions, aiCache)
```

### Design Tokens

Tokens em `/src/tokens/` seguem o formato W3C Design Token Community Group:
- `colors.json` - Cores primitivas, semânticas e de domínio
- `spacing.json` - Escala de espaçamento e border radius
- `typography.json` - Tipografia (fontes, tamanhos, pesos)
- `effects.json` - Sombras, gradientes e animações

CSS custom properties em `index.css` são derivados destes tokens.

### Padrões Importantes

**Multi-tenancy**: Todas as queries filtram por `tenant_id`. O tenant atual vem do `TenantContext`.

**RBAC**: Roles definidas em `/lib/permissions.ts`:
- `admin` - Acesso total
- `manager` - Gerencia equipe
- `agent` - Apenas seus leads
- `viewer` - Apenas leitura

**Autenticação**: `useAuth()` hook gerencia sessão Supabase + profile + role. Rotas protegidas com `<ProtectedRoute>`.

**Data Fetching**: TanStack Query com:
- `staleTime`: 5-60s
- `gcTime`: 5-30min
- Paginação infinita para Inbox/Leads

**Realtime**: Supabase subscriptions em `useInboxRealtime.ts` para atualizações ao vivo.

### Supabase

- Tipos gerados em `/src/integrations/supabase/types.ts`
- Enums importantes: `app_role`, `lead_status`, `conversation_status`, `message_status`
- RLS habilitado - queries sempre passam pelo tenant_id

### Otimizações

- Code splitting automático em `vite.config.ts` (chunks separados para react, charts, dnd, etc.)
- Lazy loading de todas as páginas
- Logger condicional: só loga erros em produção (`/lib/logger.ts`)

## Convenções

- Componentes UI usam shadcn-ui (`/components/ui`)
- Hooks customizados para toda lógica de dados
- Validação com Zod schemas
- Toast notifications via Sonner
- Ícones via Lucide React
