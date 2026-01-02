/**
 * Utilitários para suporte a telefones internacionais
 * Detecta código do país e normaliza para salvar no banco
 */

// Códigos de países conhecidos (ordenados por tamanho decrescente para match correto)
const COUNTRY_CODES = [
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

export interface ParsedPhone {
  countryCode: string;
  localNumber: string;
  fullNumber: string;
  country?: string;
}

/**
 * Detecta o código do país a partir de um número completo
 * Retorna o número separado em código do país e número local
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
          country: name,
        };
      }
    }
  }
  
  // Fallback: assumir Brasil (55) se não detectar
  // Ou retornar como está se já for um número curto (sem código do país)
  if (digits.length >= 12) {
    // Provavelmente tem código do país desconhecido
    return {
      countryCode: digits.substring(0, digits.length - 10), // Assume últimos 10-11 são o número
      localNumber: digits.slice(-10),
      fullNumber: digits,
    };
  }
  
  // Número local sem código do país (assumir Brasil)
  return {
    countryCode: '55',
    localNumber: digits,
    fullNumber: `55${digits}`,
  };
}

/**
 * Valida telefone internacional (mais flexível que validação brasileira)
 */
export function validateInternationalPhone(phone: string, countryCode: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length < 8) {
    return {
      valid: false,
      normalized: digits,
      error: `Número muito curto (${digits.length} dígitos). Mínimo: 8 dígitos.`,
    };
  }
  
  if (digits.length > 15) {
    return {
      valid: false,
      normalized: digits,
      error: `Número muito longo (${digits.length} dígitos). Máximo: 15 dígitos.`,
    };
  }
  
  // Validação específica para Brasil
  if (countryCode === '55') {
    if (digits.length < 10 || digits.length > 11) {
      return {
        valid: false,
        normalized: digits,
        error: 'Número brasileiro deve ter 10-11 dígitos (DDD + número)',
      };
    }
    
    // Validar DDD
    const VALID_DDDS = [
      '11', '12', '13', '14', '15', '16', '17', '18', '19',
      '21', '22', '24', '27', '28',
      '31', '32', '33', '34', '35', '37', '38',
      '41', '42', '43', '44', '45', '46', '47', '48', '49',
      '51', '53', '54', '55',
      '61', '62', '63', '64', '65', '66', '67', '68', '69',
      '71', '73', '74', '75', '77', '79',
      '81', '82', '83', '84', '85', '86', '87', '88', '89',
      '91', '92', '93', '94', '95', '96', '97', '98', '99',
    ];
    
    const ddd = digits.substring(0, 2);
    if (!VALID_DDDS.includes(ddd)) {
      return {
        valid: false,
        normalized: digits,
        error: `DDD ${ddd} não é válido no Brasil`,
      };
    }
    
    // Celulares com 11 dígitos devem começar com 9 após o DDD
    if (digits.length === 11 && digits[2] !== '9') {
      return {
        valid: false,
        normalized: digits,
        error: 'Celulares brasileiros devem começar com 9',
      };
    }
  }
  
  return {
    valid: true,
    normalized: digits,
  };
}

/**
 * Monta o número completo para envio via WhatsApp
 */
export function toWhatsAppFormat(localNumber: string, countryCode: string = '55'): string {
  const digits = localNumber.replace(/\D/g, '');
  // Remover código do país se já estiver presente
  if (digits.startsWith(countryCode) && digits.length > countryCode.length + 8) {
    return digits;
  }
  return `${countryCode}${digits}`;
}

/**
 * Formata telefone para exibição baseado no país
 */
export function formatPhoneByCountry(localNumber: string, countryCode: string): string {
  const digits = localNumber.replace(/\D/g, '');
  
  // Formatação brasileira: (11) 99999-9999
  if (countryCode === '55') {
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
  }
  
  // Formatação EUA/Canadá: (123) 456-7890
  if (countryCode === '1' && digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  // Formatação México: (55) 1234-5678
  if (countryCode === '52' && digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  
  // Formatação Irlanda: 87 123 4567
  if (countryCode === '353' && digits.length >= 9) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  
  // Formatação Japão: 90-1234-5678
  if (countryCode === '81' && digits.length >= 10) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  
  // Formatação Austrália: 0412 345 678
  if (countryCode === '61' && digits.length >= 9) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  
  // Formatação genérica para outros países
  return digits;
}
