import { useState, useEffect, useCallback } from 'react';

const DRAFTS_KEY = 'inbox-message-drafts';
const MAX_DRAFTS = 20;
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

interface DraftEntry {
  text: string;
  timestamp: number;
}

type DraftsStore = Record<string, DraftEntry>;

/**
 * Hook para persistir rascunhos de mensagens por conversa.
 * Salva automaticamente no localStorage ao trocar de conversa.
 * Limita a 20 drafts mais recentes e remove drafts com mais de 7 dias.
 */
export function useDraftMessages(conversationId: string | undefined) {
  const [draft, setDraft] = useState('');

  // Limpar drafts antigos e manter apenas os mais recentes
  const cleanupDrafts = useCallback((drafts: DraftsStore): DraftsStore => {
    const now = Date.now();
    
    // Filtrar drafts expirados (mais de 7 dias)
    const validDrafts = Object.entries(drafts)
      .filter(([_, entry]) => now - entry.timestamp < DRAFT_MAX_AGE_MS);
    
    // Se ainda temos mais que MAX_DRAFTS, manter apenas os mais recentes
    if (validDrafts.length > MAX_DRAFTS) {
      validDrafts.sort((a, b) => b[1].timestamp - a[1].timestamp);
      return Object.fromEntries(validDrafts.slice(0, MAX_DRAFTS));
    }
    
    return Object.fromEntries(validDrafts);
  }, []);

  // Carregar rascunho ao trocar de conversa
  useEffect(() => {
    if (!conversationId) {
      setDraft('');
      return;
    }
    
    try {
      const rawDrafts = localStorage.getItem(DRAFTS_KEY);
      if (!rawDrafts) {
        setDraft('');
        return;
      }
      
      const drafts: DraftsStore = JSON.parse(rawDrafts);
      const entry = drafts[conversationId];
      
      // Se o draft existe e não expirou
      if (entry && Date.now() - entry.timestamp < DRAFT_MAX_AGE_MS) {
        setDraft(entry.text);
      } else {
        setDraft('');
      }
      
      // Cleanup em background
      const cleanedDrafts = cleanupDrafts(drafts);
      if (Object.keys(cleanedDrafts).length !== Object.keys(drafts).length) {
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(cleanedDrafts));
      }
    } catch {
      setDraft('');
    }
  }, [conversationId, cleanupDrafts]);

  // Salvar rascunho
  const saveDraft = useCallback((text: string) => {
    setDraft(text);
    
    if (!conversationId) return;
    
    try {
      let drafts: DraftsStore = {};
      try {
        drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
      } catch {
        drafts = {};
      }
      
      if (text.trim()) {
        drafts[conversationId] = {
          text,
          timestamp: Date.now(),
        };
      } else {
        delete drafts[conversationId];
      }
      
      // Limpar drafts antigos antes de salvar
      const cleanedDrafts = cleanupDrafts(drafts);
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(cleanedDrafts));
    } catch {
      // Ignore localStorage errors
    }
  }, [conversationId, cleanupDrafts]);

  // Limpar rascunho após envio
  const clearDraft = useCallback(() => {
    setDraft('');
    
    if (!conversationId) return;
    
    try {
      const drafts: DraftsStore = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
      delete drafts[conversationId];
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    } catch {
      // Ignore localStorage errors
    }
  }, [conversationId]);

  return { draft, saveDraft, clearDraft };
}
