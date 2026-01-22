/**
 * Utilitários de telefone para Edge Functions
 * Suporta números brasileiros e internacionais
 *
 * Uso:
 * import { normalizePhone, validateBrazilianPhone, parseInternationalPhone } from '../_shared/phone.ts';
 */

import type { ParsedPhone, PhoneValidation } from './types.ts';

// ============================================
// Constantes
// ============================================

/**
 * DDDs válidos do Brasil (11-99, excluindo inexistentes)
 */
export const VALID_DDDS = new Set([
  // Região Sudeste
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19, // São Paulo
  21,
  22,
  24, // Rio de Janeiro
  27,
  28, // Espírito Santo
  31,
  32,
  33,
  34,
  35,
  37,
  38, // Minas Gerais
  // Região Sul
  41,
  42,
  43,
  44,
  45,
  46, // Paraná
  47,
  48,
  49, // Santa Catarina
  51,
  53,
  54,
  55, // Rio Grande do Sul
  // Região Centro-Oeste
  61, // Distrito Federal
  62,
  64, // Goiás
  63, // Tocantins
  65,
  66, // Mato Grosso
  67, // Mato Grosso do Sul
  // Região Nordeste
  71,
  73,
  74,
  75,
  77, // Bahia
  79, // Sergipe
  81,
  87, // Pernambuco
  82, // Alagoas
  83, // Paraíba
  84, // Rio Grande do Norte
  85,
  88, // Ceará
  86,
  89, // Piauí
  // Região Norte
  91,
  93,
  94, // Pará
  92,
  97, // Amazonas
  95, // Roraima
  96, // Amapá
  98,
  99, // Maranhão
  69, // Rondônia
  68, // Acre
]);

/**
 * Códigos de países conhecidos (ordenados por tamanho decrescente para match correto)
 */
export const COUNTRY_CODES = [
  // 3 dígitos (DEVEM VIR PRIMEIRO!)
  { code: '595', name: 'Paraguai' },
  { code: '598', name: 'Uruguai' },
  { code: '593', name: 'Equador' },
  { code: '591', name: 'Bolívia' },
  { code: '353', name: 'Irlanda' },
  { code: '351', name: 'Portugal' },
  // 2 dígitos
  { code: '81', name: 'Japão' },
  { code: '61', name: 'Austrália' },
  { code: '55', name: 'Brasil' },
  { code: '54', name: 'Argentina' },
  { code: '56', name: 'Chile' },
  { code: '57', name: 'Colômbia' },
  { code: '58', name: 'Venezuela' },
  { code: '52', name: 'México' },
  { code: '51', name: 'Peru' },
  { code: '34', name: 'Espanha' },
  { code: '39', name: 'Itália' },
  { code: '49', name: 'Alemanha' },
  { code: '33', name: 'França' },
  { code: '44', name: 'Reino Unido' },
  // 1 dígito (por último)
  { code: '1', name: 'EUA/Canadá' },
];

// ============================================
// Funções de Normalização
// ============================================

/**
 * Remove sufixos do WhatsApp e caracteres não numéricos
 * @param phone - Número com possíveis sufixos (@c.us, @lid, etc)
 * @returns Apenas dígitos
 */
export function normalizePhone(phone: string): string {
  return phone
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace('@lid', '')
    .replace(/\D/g, '');
}

/**
 * Detecta o código do país a partir de um número completo
 * @param phone - Número completo com código do país
 * @returns Objeto com countryCode, localNumber, fullNumber e country (se detectado)
 */
export function parseInternationalPhone(phone: string): ParsedPhone {
  const digits = phone.replace(/\D/g, '');

  // Tentar detectar código do país conhecido
  for (const { code, name } of COUNTRY_CODES) {
    if (digits.startsWith(code)) {
      const localNumber = digits.substring(code.length);
      // Verificar se o número local tem tamanho razoável (mínimo 8 dígitos)
      if (localNumber.length >= 8) {
        return {
          countryCode: code,
          localNumber,
          fullNumber: digits,
          isValid: true,
        };
      }
    }
  }

  // Fallback: assumir Brasil (55) se não detectar
  if (digits.length >= 12) {
    // Provavelmente tem código do país desconhecido
    return {
      countryCode: digits.substring(0, digits.length - 10),
      localNumber: digits.slice(-10),
      fullNumber: digits,
      isValid: true,
    };
  }

  // Número local sem código do país (assumir Brasil)
  return {
    countryCode: '55',
    localNumber: digits,
    fullNumber: `55${digits}`,
    isValid: digits.length >= 10,
  };
}

/**
 * Normaliza telefone para salvar no banco
 * Retorna número local SEM código do país
 */
export function normalizePhoneForStorage(phone: string): {
  localNumber: string;
  countryCode: string;
} {
  const parsed = parseInternationalPhone(normalizePhone(phone));
  return {
    localNumber: parsed.localNumber,
    countryCode: parsed.countryCode,
  };
}

/**
 * Formata telefone para exibição (suporta internacionais)
 * Brasil: (11) 99999-9999
 * Internacional: +54 9999999999
 */
export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const parsed = parseInternationalPhone(digits);

  // Formatação brasileira (55)
  if (parsed.countryCode === '55') {
    const local = parsed.localNumber;
    if (local.length === 11) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }
    if (local.length === 10) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    }
  }

  // Formatação internacional: +{código} {número}
  return `+${parsed.countryCode} ${parsed.localNumber}`;
}

/**
 * Monta número com código do país correto para chamadas de API
 * Detecta código automaticamente ou usa existingCountryCode do lead
 */
export function getPhoneWithCountryCode(
  phone: string,
  existingCountryCode?: string | null
): string {
  const digits = phone.replace(/\D/g, '');
  const parsed = parseInternationalPhone(digits);

  // Se detectou um código de país diferente de 55 (Brasil), usar o número completo
  if (parsed.countryCode !== '55') {
    return parsed.fullNumber;
  }

  // Se temos country_code do lead existente e NÃO é 55, usar ele
  if (existingCountryCode && existingCountryCode !== '55') {
    return existingCountryCode + parsed.localNumber;
  }

  // Fallback: usar número completo parseado (Brasil)
  return parsed.fullNumber;
}

// ============================================
// Validação Brasileira
// ============================================

/**
 * Valida telefone brasileiro e retorna objeto com resultado
 * Verifica: tamanho, DDD válido, formato correto
 */
export function validateBrazilianPhone(phone: string): PhoneValidation {
  if (!phone || phone.trim() === '') {
    return { valid: false, normalized: '', error: 'Número de telefone não informado' };
  }

  // Remove tudo que não é número
  const numbers = phone.replace(/\D/g, '');

  // Verifica tamanho mínimo (10 dígitos sem código país: DDD + 8 dígitos)
  if (numbers.length < 10) {
    return {
      valid: false,
      normalized: numbers,
      error: `Número de telefone muito curto (${numbers.length} dígitos). Formato esperado: (DDD) 9XXXX-XXXX`,
    };
  }

  // Verifica tamanho máximo (13 dígitos com código país: 55 + DDD + 9 dígitos)
  if (numbers.length > 13) {
    return {
      valid: false,
      normalized: numbers,
      error: `Número de telefone muito longo (${numbers.length} dígitos). Verifique se há dígitos extras.`,
    };
  }

  let ddd: number;
  let phoneNumber: string;
  let normalized: string;

  // Determina formato baseado no tamanho
  if (numbers.startsWith('55')) {
    // Com código do país
    if (numbers.length < 12 || numbers.length > 13) {
      return {
        valid: false,
        normalized: numbers,
        error: 'Número com código 55 deve ter 12-13 dígitos (55 + DDD + número)',
      };
    }
    ddd = parseInt(numbers.substring(2, 4));
    phoneNumber = numbers.substring(4);
    normalized = numbers;
  } else {
    // Sem código do país
    if (numbers.length < 10 || numbers.length > 11) {
      return {
        valid: false,
        normalized: numbers,
        error: 'Número sem código do país deve ter 10-11 dígitos (DDD + número)',
      };
    }
    ddd = parseInt(numbers.substring(0, 2));
    phoneNumber = numbers.substring(2);
    normalized = '55' + numbers;
  }

  // Valida DDD
  if (!VALID_DDDS.has(ddd)) {
    return {
      valid: false,
      normalized,
      error: `DDD ${ddd} não é válido no Brasil. Verifique o código de área.`,
      ddd: String(ddd),
    };
  }

  // Valida número (8 ou 9 dígitos)
  if (phoneNumber.length < 8 || phoneNumber.length > 9) {
    return {
      valid: false,
      normalized,
      error: `Número após DDD deve ter 8-9 dígitos, mas tem ${phoneNumber.length}`,
      ddd: String(ddd),
    };
  }

  // Celulares brasileiros começam com 9
  if (phoneNumber.length === 9 && !phoneNumber.startsWith('9')) {
    return {
      valid: false,
      normalized,
      error: 'Celulares brasileiros com 9 dígitos devem começar com 9',
      ddd: String(ddd),
    };
  }

  // Verifica se não são todos dígitos iguais (número inválido)
  if (/^(\d)\1+$/.test(phoneNumber)) {
    return {
      valid: false,
      normalized,
      error: 'Número de telefone inválido (todos os dígitos são iguais)',
      ddd: String(ddd),
    };
  }

  return {
    valid: true,
    normalized,
    ddd: String(ddd),
    localNumber: phoneNumber,
  };
}
