/**
 * Centralized template variable replacement utility
 * Supports both {{variable}} and {variable} formats
 */

import { formatPhoneNumber, formatCPF } from './masks';

export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  aliases?: string[];
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  {
    key: '{{nome}}',
    label: 'Nome do Lead',
    description: 'Nome completo do cliente',
    aliases: ['{nome}'],
  },
  {
    key: '{{primeiro_nome}}',
    label: 'Primeiro Nome',
    description: 'Primeiro nome do cliente',
    aliases: ['{primeiro_nome}'],
  },
  {
    key: '{{telefone}}',
    label: 'Telefone',
    description: 'Telefone do cliente',
    aliases: ['{telefone}'],
  },
  {
    key: '{{valor}}',
    label: 'Valor Estimado',
    description: 'Valor estimado do benefício',
    aliases: ['{valor}'],
  },
  {
    key: '{{data}}',
    label: 'Data Atual',
    description: 'Data de hoje (DD/MM/AAAA)',
    aliases: ['{data}'],
  },
  { key: '{{hora}}', label: 'Hora Atual', description: 'Hora atual (HH:MM)', aliases: ['{hora}'] },
  {
    key: '{{data_inicio}}',
    label: 'Data de Início',
    description: 'Data de criação do lead',
    aliases: ['{data_inicio}'],
  },
  {
    key: '{{beneficio}}',
    label: 'Tipo de Benefício',
    description: 'Tipo de benefício pretendido',
    aliases: ['{beneficio}', '{tipo_beneficio}', '{{tipo_beneficio}}'],
  },
  {
    key: '{{atendente}}',
    label: 'Nome do Atendente',
    description: 'Nome do atendente responsável',
    aliases: ['{atendente}'],
  },
  { key: '{{cpf}}', label: 'CPF', description: 'CPF do cliente', aliases: ['{cpf}'] },
  { key: '{{email}}', label: 'Email', description: 'Email do cliente', aliases: ['{email}'] },
];

export interface LeadData {
  name?: string;
  phone?: string;
  estimated_value?: number | null;
  benefit_type?: string | null;
  cpf?: string | null;
  email?: string | null;
  created_at?: string | null;
}

export interface ReplaceOptions {
  lead?: LeadData;
  agentName?: string;
  removeUnmatched?: boolean; // true = remove, false = show placeholder [key]
}

/**
 * Formats a value as Brazilian currency
 */
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formats a date string to DD/MM/YYYY
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

/**
 * Replaces template variables in content with actual values
 * Supports both {{variable}} and {variable} formats
 */
export function replaceTemplateVariables(content: string, options: ReplaceOptions = {}): string {
  let result = content;

  const lead = options.lead || {};
  const firstName = lead.name ? lead.name.split(' ')[0] : '';
  const now = new Date();

  // Build replacements map
  const replacements: Record<string, string> = {
    nome: lead.name || '',
    primeiro_nome: firstName,
    telefone: lead.phone ? formatPhoneNumber(lead.phone) : '',
    valor: formatCurrency(lead.estimated_value),
    data: now.toLocaleDateString('pt-BR'),
    hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    data_inicio: formatDate(lead.created_at) || now.toLocaleDateString('pt-BR'),
    beneficio: lead.benefit_type || '',
    tipo_beneficio: lead.benefit_type || '',
    atendente: options.agentName || '',
    cpf: lead.cpf ? formatCPF(lead.cpf) : '',
    email: lead.email || '',
  };

  // Replace {{variable}} and {variable} patterns
  for (const [key, value] of Object.entries(replacements)) {
    const doublePattern = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    const singlePattern = new RegExp(`\\{${key}\\}`, 'gi');

    if (value) {
      result = result.replace(doublePattern, value);
      result = result.replace(singlePattern, value);
    } else if (options.removeUnmatched) {
      result = result.replace(doublePattern, '');
      result = result.replace(singlePattern, '');
    } else {
      // Show placeholder for missing values
      result = result.replace(doublePattern, `[${key}]`);
      result = result.replace(singlePattern, `[${key}]`);
    }
  }

  // Handle any remaining unmatched variables
  if (options.removeUnmatched) {
    result = result.replace(/\{\{(\w+)\}\}/g, '');
    result = result.replace(/\{(\w+)\}/g, '');
  } else {
    result = result.replace(/\{\{(\w+)\}\}/g, '[$1]');
    result = result.replace(/\{(\w+)\}/g, '[$1]');
  }

  return result;
}

/**
 * Gets a preview of template content with sample data
 */
export function getTemplatePreview(content: string): string {
  const sampleLead: LeadData = {
    name: 'Maria Silva',
    phone: '11999999999',
    estimated_value: 1412,
    benefit_type: 'BPC/LOAS',
    cpf: '12345678901',
    email: 'maria@email.com',
    created_at: new Date().toISOString(),
  };

  return replaceTemplateVariables(content, {
    lead: sampleLead,
    agentName: 'Dra. Ana',
    removeUnmatched: false,
  });
}
