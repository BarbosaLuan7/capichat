import { useState, useEffect, useCallback, useRef } from 'react';

const DRAFTS_KEY = 'inbox-message-drafts';
const MAX_DRAFTS = 20;
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const SAVE_DEBOUNCE_MS = 500; // Debounce de 500ms para evitar salvar a cada tecla

interface DraftEntry {
  text: string;
  timestamp: number;
}

type DraftsStore = Record<string, DraftEntry>;

/**
 * Hook para persistir rascunhos de mensagens por conversa.
 * Salva automaticamente no localStorage com debounce para performance.
 * Limita a 20 drafts mais recentes e remove drafts com mais de 7 dias.
 */
export function useDraftMessages(conversationId: string | undefined) {
  const [draft, setDraft] = useState('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

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

  // Persistir no localStorage (operação pesada - apenas quando necessário)
  const persistToLocalStorage = useCallback((text: string, convId: string) => {
    try {
      let drafts: DraftsStore = {};
      try {
        drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
      } catch {
        drafts = {};
      }
      
      if (text.trim()) {
        drafts[convId] = {
          text,
          timestamp: Date.now(),
        };
      } else {
        delete drafts[convId];
      }
      
      // Limpar drafts antigos antes de salvar
      const cleanedDrafts = cleanupDrafts(drafts);
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(cleanedDrafts));
      lastSavedRef.current = text;
    } catch {
      // Ignore localStorage errors
    }
  }, [cleanupDrafts]);

  // Carregar rascunho ao trocar de conversa
  useEffect(() => {
    // Limpar timeout pendente ao trocar de conversa
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    if (!conversationId) {
      setDraft('');
      lastSavedRef.current = '';
      return;
    }
    
    try {
      const rawDrafts = localStorage.getItem(DRAFTS_KEY);
      if (!rawDrafts) {
        setDraft('');
        lastSavedRef.current = '';
        return;
      }
      
      const drafts: DraftsStore = JSON.parse(rawDrafts);
      const entry = drafts[conversationId];
      
      // Se o draft existe e não expirou
      if (entry && Date.now() - entry.timestamp < DRAFT_MAX_AGE_MS) {
        setDraft(entry.text);
        lastSavedRef.current = entry.text;
      } else {
        setDraft('');
        lastSavedRef.current = '';
      }
      
      // Cleanup em background
      const cleanedDrafts = cleanupDrafts(drafts);
      if (Object.keys(cleanedDrafts).length !== Object.keys(drafts).length) {
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(cleanedDrafts));
      }
    } catch {
      setDraft('');
      lastSavedRef.current = '';
    }
  }, [conversationId, cleanupDrafts]);

  // Debounced save - persiste apenas após 500ms sem digitação
  useEffect(() => {
    if (!conversationId) return;
    
    // Se o valor já foi salvo, não precisa salvar novamente
    if (draft === lastSavedRef.current) return;
    
    // Limpar timeout anterior
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Agendar novo save
    saveTimeoutRef.current = setTimeout(() => {
      persistToLocalStorage(draft, conversationId);
    }, SAVE_DEBOUNCE_MS);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [draft, conversationId, persistToLocalStorage]);

  // Salvar rascunho - agora apenas atualiza o estado React (instantâneo)
  const saveDraft = useCallback((text: string) => {
    setDraft(text);
  }, []);

  // Limpar rascunho após envio - salva imediatamente
  const clearDraft = useCallback(() => {
    setDraft('');
    lastSavedRef.current = '';
    
    // Cancelar qualquer save pendente
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    if (!conversationId) return;
    
    // Remover imediatamente do localStorage
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
