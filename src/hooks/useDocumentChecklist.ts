import { useState, useEffect, useCallback } from 'react';
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

export function useDocumentChecklist({ leadId, customFields, onSuccess }: UseDocumentChecklistOptions) {
  const updateLead = useUpdateLead();
  
  // Estado inicial do checklist do custom_fields
  const initialState: ChecklistState = customFields?.documentChecklist || {
    benefitType: null,
    checkedDocuments: [],
  };
  
  const [state, setState] = useState<ChecklistState>(initialState);
  const [isSaving, setIsSaving] = useState(false);

  // Atualiza o estado quando customFields muda
  useEffect(() => {
    const checklistData = customFields?.documentChecklist;
    if (checklistData) {
      setState(checklistData);
    }
  }, [customFields]);

  // Salva no banco de dados
  const saveToDatabase = useCallback(async (newState: ChecklistState) => {
    setIsSaving(true);
    try {
      const updatedCustomFields = {
        ...(customFields || {}),
        documentChecklist: {
          benefitType: newState.benefitType,
          checkedDocuments: newState.checkedDocuments,
        },
      };
      
      await updateLead.mutateAsync({
        id: leadId,
        custom_fields: updatedCustomFields as Json,
      });
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao salvar checklist:', error);
    } finally {
      setIsSaving(false);
    }
  }, [leadId, customFields, updateLead, onSuccess]);

  // Define o tipo de benefício
  const setBenefitType = useCallback((type: BenefitType | null) => {
    const newState = { ...state, benefitType: type, checkedDocuments: [] };
    setState(newState);
    saveToDatabase(newState);
  }, [state, saveToDatabase]);

  // Toggle de documento
  const toggleDocument = useCallback((documentId: string) => {
    const isChecked = state.checkedDocuments.includes(documentId);
    const newCheckedDocuments = isChecked
      ? state.checkedDocuments.filter(id => id !== documentId)
      : [...state.checkedDocuments, documentId];
    
    const newState = { ...state, checkedDocuments: newCheckedDocuments };
    setState(newState);
    saveToDatabase(newState);
  }, [state, saveToDatabase]);

  // Marcar todos
  const checkAll = useCallback(() => {
    if (!state.benefitType) return;
    
    const benefit = getDocumentsByBenefitType(state.benefitType);
    if (!benefit) return;
    
    const allDocIds = benefit.documents.map(d => d.id);
    const newState = { ...state, checkedDocuments: allDocIds };
    setState(newState);
    saveToDatabase(newState);
  }, [state, saveToDatabase]);

  // Desmarcar todos
  const uncheckAll = useCallback(() => {
    const newState = { ...state, checkedDocuments: [] };
    setState(newState);
    saveToDatabase(newState);
  }, [state, saveToDatabase]);

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
  };
}
