import { useState, useEffect, useCallback } from 'react';

const DRAFTS_KEY = 'inbox-message-drafts';

/**
 * Hook para persistir rascunhos de mensagens por conversa.
 * Salva automaticamente no localStorage ao trocar de conversa.
 */
export function useDraftMessages(conversationId: string | undefined) {
  const [draft, setDraft] = useState('');

  // Carregar rascunho ao trocar de conversa
  useEffect(() => {
    if (!conversationId) {
      setDraft('');
      return;
    }
    
    try {
      const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
      setDraft(drafts[conversationId] || '');
    } catch {
      setDraft('');
    }
  }, [conversationId]);

  // Salvar rascunho
  const saveDraft = useCallback((text: string) => {
    setDraft(text);
    
    if (!conversationId) return;
    
    try {
      const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
      if (text.trim()) {
        drafts[conversationId] = text;
      } else {
        delete drafts[conversationId];
      }
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    } catch {
      // Ignore localStorage errors
    }
  }, [conversationId]);

  // Limpar rascunho após envio
  const clearDraft = useCallback(() => {
    setDraft('');
    
    if (!conversationId) return;
    
    try {
      const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
      delete drafts[conversationId];
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    } catch {
      // Ignore localStorage errors
    }
  }, [conversationId]);

  return { draft, saveDraft, clearDraft };
}
