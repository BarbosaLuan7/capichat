/**
 * Utilitários de configuração WAHA para Edge Functions
 * Busca configurações do banco de dados
 *
 * Uso:
 * import { getWAHAConfig, getWAHAConfigBySession } from '../_shared/waha-config.ts';
 */

import { debugError, debugWarn, debugInfo } from './debug.ts';

const PREFIX = 'waha-config';

// ============================================
// Tipos
// ============================================

export interface WAHAConfigResult {
  baseUrl: string;
  apiKey: string;
  sessionName: string;
  instanceId: string;
  tenantId: string | null;
  phoneNumber?: string;
}

// ============================================
// Funções de Busca
// ============================================

/**
 * Busca configuração do WAHA no banco (genérica - qualquer instância ativa)
 *
 * @param supabase - Cliente Supabase
 * @returns Configuração WAHA ou null se não encontrar
 */
export async function getWAHAConfig(supabase: any): Promise<WAHAConfigResult | null> {
  try {
    const { data } = await supabase
      .from('whatsapp_config')
      .select('id, base_url, api_key, instance_name, phone_number, tenant_id')
      .eq('is_active', true)
      .eq('provider', 'waha')
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        baseUrl: data.base_url.replace(/\/$/, ''), // Remove trailing slash
        apiKey: data.api_key,
        sessionName: data.instance_name || 'default',
        instanceId: data.id,
        tenantId: data.tenant_id || null,
        phoneNumber: data.phone_number,
      };
    }

    return null;
  } catch (error) {
    debugError(PREFIX, 'Erro ao buscar config WAHA:', error);
    return null;
  }
}

/**
 * Busca configuração do WAHA pela session/instance_name específica
 * Usa ilike para busca case-insensitive (LUAN = luan = Luan)
 *
 * @param supabase - Cliente Supabase
 * @param sessionName - Nome da sessão (do webhook payload)
 * @returns Configuração WAHA ou null se não encontrar
 */
export async function getWAHAConfigBySession(
  supabase: any,
  sessionName: string
): Promise<WAHAConfigResult | null> {
  try {
    debugInfo(PREFIX, 'Buscando config WAHA para session:', sessionName);

    const { data } = await supabase
      .from('whatsapp_config')
      .select('id, base_url, api_key, instance_name, phone_number, tenant_id')
      .eq('is_active', true)
      .eq('provider', 'waha')
      .ilike('instance_name', sessionName) // Case-insensitive
      .limit(1)
      .maybeSingle();

    if (data) {
      debugInfo(
        PREFIX,
        '✅ Config encontrada para session:',
        sessionName,
        '| instanceId:',
        data.id,
        '| instance_name:',
        data.instance_name,
        '| phone:',
        data.phone_number,
        '| tenant_id:',
        data.tenant_id
      );
      return {
        baseUrl: data.base_url.replace(/\/$/, ''),
        apiKey: data.api_key,
        sessionName: data.instance_name || 'default',
        instanceId: data.id,
        tenantId: data.tenant_id || null,
        phoneNumber: data.phone_number,
      };
    }

    // Fallback: se não encontrar pela session, buscar qualquer uma ativa
    debugWarn(
      PREFIX,
      '⚠️ Instância NÃO encontrada para session:',
      sessionName,
      '- usando fallback (primeira ativa)'
    );
    const fallback = await getWAHAConfig(supabase);
    if (fallback) {
      debugWarn(
        PREFIX,
        '⚠️ ATENÇÃO: Usando instância fallback:',
        fallback.sessionName,
        '| Cadastre a instância "' + sessionName + '" em Configurações > WhatsApp para corrigir'
      );
    }
    return fallback;
  } catch (error) {
    debugError(PREFIX, 'Erro ao buscar config WAHA por session:', error);
    return null;
  }
}

/**
 * Busca configuração WAHA por tenant_id específico
 *
 * @param supabase - Cliente Supabase
 * @param tenantId - ID do tenant
 * @returns Configuração WAHA ou null se não encontrar
 */
export async function getWAHAConfigByTenant(
  supabase: any,
  tenantId: string
): Promise<WAHAConfigResult | null> {
  try {
    const { data } = await supabase
      .from('whatsapp_config')
      .select('id, base_url, api_key, instance_name, phone_number, tenant_id')
      .eq('is_active', true)
      .eq('provider', 'waha')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        baseUrl: data.base_url.replace(/\/$/, ''),
        apiKey: data.api_key,
        sessionName: data.instance_name || 'default',
        instanceId: data.id,
        tenantId: data.tenant_id || null,
        phoneNumber: data.phone_number,
      };
    }

    return null;
  } catch (error) {
    debugError(PREFIX, 'Erro ao buscar config WAHA por tenant:', error);
    return null;
  }
}
