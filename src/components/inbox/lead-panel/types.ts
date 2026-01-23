import type { Database } from '@/integrations/supabase/types';

export type Lead = Database['public']['Tables']['leads']['Row'];
export type Label = Database['public']['Tables']['labels']['Row'];

export interface LeadWithRelations extends Lead {
  funnel_stages?: { id: string; name: string; color: string; grupo?: string | null } | null;
  labels?: Label[];
  whatsapp_name?: string;
  is_facebook_lid?: boolean;
  original_lid?: string;
  qualification?: {
    situacao?: string;
    condicao_saude?: string;
    renda?: string;
    idade?: string;
  };
  custom_fields?: {
    case_summary?: string;
    documentChecklist?: {
      benefitType?: string;
      checkedDocuments?: string[];
    };
    [key: string]: unknown;
  };
}

export interface LeadDetailsPanelProps {
  lead: LeadWithRelations;
  conversationId: string;
  messages?: any[];
  isFavorite?: boolean;
  onToggleFavorite: () => void;
  onTransfer: (userId: string) => void;
  onLabelsUpdate: () => void;
}
