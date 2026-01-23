import { useState, lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { TenantProvider } from '@/contexts/TenantContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { CommandBar } from '@/components/command/CommandBar';
import ProtectedRoute from './components/ProtectedRoute';
import { AccountOwnerRoute } from './components/AccountOwnerRoute';
import MainLayout from './components/layout/MainLayout';
import { PageSkeleton } from './components/layout/PageSkeleton';
import { logger } from '@/lib/logger';
import React from 'react';

// Lazy load all pages for better initial bundle size
const Auth = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Funnel = lazy(() => import('./pages/Funnel'));
const Leads = lazy(() => import('./pages/Leads'));
const LeadDetail = lazy(() => import('./pages/LeadDetail'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Automations = lazy(() => import('./pages/Automations'));
const ChatbotBuilder = lazy(() => import('./pages/ChatbotBuilder'));

const Settings = lazy(() => import('./pages/Settings'));
const UsersSettings = lazy(() => import('./pages/settings/UsersSettings'));
const TeamsSettings = lazy(() => import('./pages/settings/TeamsSettings'));
const LabelsSettings = lazy(() => import('./pages/settings/LabelsSettings'));
const TemplatesSettings = lazy(() => import('./pages/settings/TemplatesSettings'));
const WebhooksSettings = lazy(() => import('./pages/settings/WebhooksSettings'));
const WhatsAppSettings = lazy(() => import('./pages/settings/WhatsAppSettings'));
const ApiSettings = lazy(() => import('./pages/settings/ApiSettings'));
const TenantsSettings = lazy(() => import('./pages/settings/TenantsSettings'));
const MyAccount = lazy(() => import('./pages/MyAccount'));

const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Preload critical routes during idle time for faster navigation
if (typeof window !== 'undefined') {
  const preloadCriticalRoutes = () => {
    // Preload apenas Inbox - tela principal do time
    // Dashboard carrega sob demanda (apenas admin usa)
    import('./pages/Inbox');
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(preloadCriticalRoutes);
  } else {
    // Fallback for Safari
    setTimeout(preloadCriticalRoutes, 1000);
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (cache garbage collection)
      retry: 1,
      refetchOnWindowFocus: false, // Evita refetch ao voltar pra aba (causa "Carregando...")
    },
  },
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-muted p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
            <h1 className="mb-4 text-xl font-bold text-destructive">Algo deu errado</h1>
            <p className="mb-4 text-foreground">Ocorreu um erro ao carregar a aplicação.</p>
            <pre className="max-h-40 overflow-auto rounded bg-muted p-3 text-sm text-destructive">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const [commandBarOpen, setCommandBarOpen] = useState(false);

  useKeyboardShortcuts({
    onCommandK: () => setCommandBarOpen(true),
    onEscape: () => setCommandBarOpen(false),
  });

  return (
    <BrowserRouter>
      <CommandBar open={commandBarOpen} onOpenChange={setCommandBarOpen} />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />

          {/* Rota pública - Documentação da API */}
          <Route path="/api-docs" element={<ApiDocs />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/inbox" replace />} />

            {/* Rotas protegidas apenas para account owners */}
            <Route
              path="dashboard"
              element={
                <AccountOwnerRoute>
                  <Dashboard />
                </AccountOwnerRoute>
              }
            />
            <Route
              path="settings/users"
              element={
                <AccountOwnerRoute>
                  <UsersSettings />
                </AccountOwnerRoute>
              }
            />
            <Route
              path="settings/teams"
              element={
                <AccountOwnerRoute>
                  <TeamsSettings />
                </AccountOwnerRoute>
              }
            />
            <Route
              path="settings/webhooks"
              element={
                <AccountOwnerRoute>
                  <WebhooksSettings />
                </AccountOwnerRoute>
              }
            />
            <Route
              path="settings/whatsapp"
              element={
                <AccountOwnerRoute>
                  <WhatsAppSettings />
                </AccountOwnerRoute>
              }
            />
            <Route
              path="settings/api"
              element={
                <AccountOwnerRoute>
                  <ApiSettings />
                </AccountOwnerRoute>
              }
            />
            <Route
              path="settings/tenants"
              element={
                <AccountOwnerRoute>
                  <TenantsSettings />
                </AccountOwnerRoute>
              }
            />

            {/* Rotas disponíveis para todos os usuários */}
            <Route path="inbox" element={<Inbox />} />
            <Route path="funnel" element={<Funnel />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="automations" element={<Automations />} />
            <Route path="chatbot" element={<ChatbotBuilder />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/labels" element={<LabelsSettings />} />
            <Route path="settings/templates" element={<TemplatesSettings />} />
            <Route path="account" element={<MyAccount />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <TooltipProvider>
            <Toaster />
            <AppContent />
          </TooltipProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
