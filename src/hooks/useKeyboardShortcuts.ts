import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsOptions {
  onCommandK?: () => void;
  onNewLead?: () => void;
  onNewTask?: () => void;
  onEscape?: () => void;
  onSearch?: () => void;
  onHelp?: () => void;
  onNavigateInbox?: () => void;
  onNavigateDashboard?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onCommandK,
  onNewLead,
  onNewTask,
  onEscape,
  onSearch,
  onHelp,
  onNavigateInbox,
  onNavigateDashboard,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Cmd+K / Ctrl+K - Command palette (works even in inputs)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        onCommandK?.();
        return;
      }

      // Escape - Close modals (works even in inputs)
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }

      // Don't process other shortcuts if in input
      if (isInput) return;

      // ? - Show help
      if (event.key === '?' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        onHelp?.();
        return;
      }

      // N - New task
      if (event.key === 'n' && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        onNewTask?.();
        return;
      }

      // L - New lead
      if (event.key === 'l' && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        onNewLead?.();
        return;
      }

      // / - Focus search
      if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        onSearch?.();
        return;
      }

      // G then I - Go to Inbox (two-key combo simulation with single key for now)
      if (event.key === 'i' && event.shiftKey) {
        event.preventDefault();
        onNavigateInbox?.();
        return;
      }

      // G then D - Go to Dashboard
      if (event.key === 'd' && event.shiftKey) {
        event.preventDefault();
        onNavigateDashboard?.();
        return;
      }
    },
    [enabled, onCommandK, onNewLead, onNewTask, onEscape, onSearch, onHelp, onNavigateInbox, onNavigateDashboard]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Keyboard shortcuts help data
export const KEYBOARD_SHORTCUTS = [
  { keys: ['⌘', 'K'], description: 'Abrir busca global' },
  { keys: ['N'], description: 'Nova tarefa' },
  { keys: ['L'], description: 'Novo lead' },
  { keys: ['/'], description: 'Focar na busca' },
  { keys: ['?'], description: 'Mostrar atalhos' },
  { keys: ['Shift', 'I'], description: 'Ir para Inbox' },
  { keys: ['Shift', 'D'], description: 'Ir para Dashboard' },
  { keys: ['Esc'], description: 'Fechar modal' },
];

