import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsOptions {
  onCommandK?: () => void;
  onNewLead?: () => void;
  onNewTask?: () => void;
  onEscape?: () => void;
  onSearch?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onCommandK,
  onNewLead,
  onNewTask,
  onEscape,
  onSearch,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Cmd+K / Ctrl+K - Command palette
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        onCommandK?.();
        return;
      }

      // Escape - Close modals
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }

      // Don't process other shortcuts if in input
      if (isInput) return;

      // N - New task
      if (event.key === 'n' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        onNewTask?.();
        return;
      }

      // L - New lead
      if (event.key === 'l' && !event.metaKey && !event.ctrlKey) {
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
    },
    [enabled, onCommandK, onNewLead, onNewTask, onEscape, onSearch]
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
  { keys: ['Esc'], description: 'Fechar modal' },
];
