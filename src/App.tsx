import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { CommandBar } from "@/components/command/CommandBar";
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Funnel from "./pages/Funnel";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Tasks from "./pages/Tasks";
import Calendar from "./pages/Calendar";
import Automations from "./pages/Automations";
import ChatbotBuilder from "./pages/ChatbotBuilder";
import Metrics from "./pages/Metrics";
import Settings from "./pages/Settings";
import UsersSettings from "./pages/settings/UsersSettings";
import TeamsSettings from "./pages/settings/TeamsSettings";
import LabelsSettings from "./pages/settings/LabelsSettings";
import TemplatesSettings from "./pages/settings/TemplatesSettings";
import WebhooksSettings from "./pages/settings/WebhooksSettings";
import WhatsAppSettings from "./pages/settings/WhatsAppSettings";
import ApiSettings from "./pages/settings/ApiSettings";
import NotFound from "./pages/NotFound";
import React from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
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
    console.error("React Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full">
            <h1 className="text-xl font-bold text-red-600 mb-4">Algo deu errado</h1>
            <p className="text-gray-700 mb-4">
              Ocorreu um erro ao carregar a aplicação.
            </p>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-40 text-red-500">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
      <CommandBar
        open={commandBarOpen}
        onOpenChange={setCommandBarOpen}
      />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="funnel" element={<Funnel />} />
          <Route path="leads" element={<Leads />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="automations" element={<Automations />} />
          <Route path="chatbot" element={<ChatbotBuilder />} />
          <Route path="metrics" element={<Metrics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/users" element={<UsersSettings />} />
          <Route path="settings/teams" element={<TeamsSettings />} />
          <Route path="settings/labels" element={<LabelsSettings />} />
          <Route path="settings/templates" element={<TemplatesSettings />} />
          <Route path="settings/webhooks" element={<WebhooksSettings />} />
          <Route path="settings/whatsapp" element={<WhatsAppSettings />} />
          <Route path="settings/api" element={<ApiSettings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppContent />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
