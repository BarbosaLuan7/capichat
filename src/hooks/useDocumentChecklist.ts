import { useState, useEffect, useCallback, useRef } from 'react';
import { useUpdateLead } from '@/hooks/useLeads';
import type { BenefitType } from '@/lib/documentChecklist';
import { getDocumentsByBenefitType } from '@/lib/documentChecklist';
import type { Json } from '@/integrations/supabase/types';

export interface ChecklistState {
  benefitType: BenefitType | null;
  checkedDocuments: string[];
}

interface UseDocumentChecklistOptions {
  leadId: string;
  customFields: Record<string, any> | null;
  onSuccess?: () => void;
}

// Debounce delay in ms for batch saving
const SAVE_DEBOUNCE_MS = 1500;

export function useDocumentChecklist({ leadId, customFields, onSuccess }: UseDocumentChecklistOptions) {
  const updateLead = useUpdateLead();
  
  // Estado inicial do checklist do custom_fields
  const initialState: ChecklistState = customFields?.documentChecklist || {
    benefitType: null,
    checkedDocuments: [],
  };
  
  const [state, setState] = useState<ChecklistState>(initialState);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  
  // Refs for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestStateRef = useRef<ChecklistState>(state);
  const leadIdRef = useRef(leadId);
  const customFieldsRef = useRef(customFields);

  // Keep refs updated
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    leadIdRef.current = leadId;
    customFieldsRef.current = customFields;
  }, [leadId, customFields]);

  // Atualiza o estado quando customFields muda (from external source)
  useEffect(() => {
    const checklistData = customFields?.documentChecklist;
    if (checklistData) {
      setState(checklistData);
    }
  }, [customFields]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Actual save function
  const performSave = useCallback(async (stateToSave: ChecklistState) => {
    setIsSaving(true);
    setPendingSave(false);
    
    try {
      const updatedCustomFields = {
        ...(customFieldsRef.current || {}),
        documentChecklist: {
          benefitType: stateToSave.benefitType,
          checkedDocuments: stateToSave.checkedDocuments,
        },
      };
      
      await updateLead.mutateAsync({
        id: leadIdRef.current,
        custom_fields: updatedCustomFields as Json,
      });
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao salvar checklist:', error);
    } finally {
      setIsSaving(false);
    }
  }, [updateLead, onSuccess]);

  // Debounced save - accumulates changes and saves after delay
  const scheduleSave = useCallback((newState: ChecklistState) => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    setPendingSave(true);
    
    // Schedule new save
    saveTimeoutRef.current = setTimeout(() => {
      performSave(latestStateRef.current);
    }, SAVE_DEBOUNCE_MS);
  }, [performSave]);

  // Force immediate save (for benefit type change or unmount)
  const saveNow = useCallback(async (newState: ChecklistState) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await performSave(newState);
  }, [performSave]);

  // Define o tipo de benefício (immediate save since it clears documents)
  const setBenefitType = useCallback((type: BenefitType | null) => {
    const newState = { ...state, benefitType: type, checkedDocuments: [] };
    setState(newState);
    saveNow(newState);
  }, [state, saveNow]);

  // Toggle de documento (debounced save)
  const toggleDocument = useCallback((documentId: string) => {
    const isChecked = state.checkedDocuments.includes(documentId);
    const newCheckedDocuments = isChecked
      ? state.checkedDocuments.filter(id => id !== documentId)
      : [...state.checkedDocuments, documentId];
    
    const newState = { ...state, checkedDocuments: newCheckedDocuments };
    setState(newState);
    scheduleSave(newState);
  }, [state, scheduleSave]);

  // Marcar todos (debounced save)
  const checkAll = useCallback(() => {
    if (!state.benefitType) return;
    
    const benefit = getDocumentsByBenefitType(state.benefitType);
    if (!benefit) return;
    
    const allDocIds = benefit.documents.map(d => d.id);
    const newState = { ...state, checkedDocuments: allDocIds };
    setState(newState);
    scheduleSave(newState);
  }, [state, scheduleSave]);

  // Desmarcar todos (debounced save)
  const uncheckAll = useCallback(() => {
    const newState = { ...state, checkedDocuments: [] };
    setState(newState);
    scheduleSave(newState);
  }, [state, scheduleSave]);

  // Calcula progresso
  const getProgress = useCallback(() => {
    if (!state.benefitType) return { checked: 0, total: 0, percentage: 0 };
    
    const benefit = getDocumentsByBenefitType(state.benefitType);
    if (!benefit) return { checked: 0, total: 0, percentage: 0 };
    
    const total = benefit.documents.length;
    const checked = state.checkedDocuments.length;
    const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;
    
    return { checked, total, percentage };
  }, [state]);

  // Verifica se documento está marcado
  const isDocumentChecked = useCallback((documentId: string) => {
    return state.checkedDocuments.includes(documentId);
  }, [state.checkedDocuments]);

  return {
    benefitType: state.benefitType,
    checkedDocuments: state.checkedDocuments,
    setBenefitType,
    toggleDocument,
    checkAll,
    uncheckAll,
    getProgress,
    isDocumentChecked,
    isSaving,
    pendingSave,
  };
}
