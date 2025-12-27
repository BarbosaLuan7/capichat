/**
 * Utility functions for formatting and unformatting Brazilian document numbers and phone numbers
 */

/**
 * Normaliza número de telefone brasileiro - remove código do país (55)
 * Para armazenar no banco - só números, sem código do país
 */
export function normalizePhoneNumber(phone: string): string {
  let numbers = phone.replace(/\D/g, '');
  // Remove @s.whatsapp.net ou @c.us se presente (caso venha com sufixo)
  numbers = numbers.replace(/@.+$/, '');
  // Remove código do país (55) se presente e número tem 12+ dígitos
  if (numbers.startsWith('55') && numbers.length >= 12) {
    numbers = numbers.substring(2);
  }
  return numbers;
}

/**
 * Formata telefone brasileiro para exibição SEM código do país
 * Formato: (XX) 9XXXX-XXXX
 * Para números de 10 dígitos, adiciona o 9º dígito visualmente
 */
export function formatPhoneNumber(phone: string): string {
  const numbers = normalizePhoneNumber(phone);
  
  // Celular (11 dígitos): (XX) 9XXXX-XXXX
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  // Fixo antigo (10 dígitos) - adiciona 9 na frente visualmente: (XX) 9XXXX-XXXX
  if (numbers.length === 10) {
    return `(${numbers.slice(0, 2)}) 9${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  
  return phone; // retorna original se não conseguir formatar
}

/**
 * Converte para formato WhatsApp API - com código do país
 */
export function toWhatsAppFormat(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return `55${normalized}`;
}

/**
 * Format phone number to (00) 00000-0000 or (00) 0000-0000
 * Mantida para compatibilidade com MaskedInput (entrada manual incremental)
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : '';
  }
  
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  
  // 11 digits (mobile)
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Remove phone formatting, returns only digits
 */
export function unformatPhone(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Format CPF to 000.000.000-00
 */
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length <= 3) {
    return digits;
  }
  
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Mask CPF for display (shows only last 5 digits): ***.***123-45
 */
export function maskCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return formatCPF(cpf);
  return `***.***${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Remove CPF formatting, returns only digits
 */
export function unformatCPF(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Validate CPF with verifier digits (algoritmo da Receita Federal)
 */
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  
  // Must be 11 digits
  if (digits.length !== 11) return false;
  
  // Reject known invalid patterns (all same digit)
  if (/^(\d)\1{10}$/.test(digits)) return false;
  
  // Validate first verifier digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  
  // Validate second verifier digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;
  
  return true;
}

/**
 * Check if CPF has valid length (for real-time validation)
 */
export function isValidCPFLength(cpf: string): boolean {
  return cpf.replace(/\D/g, '').length === 11;
}

/**
 * Get CPF validation error message
 */
export function getCPFErrorMessage(cpf: string): string | null {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length < 11) return 'CPF incompleto';
  if (!isValidCPF(cpf)) return 'CPF inválido';
  return null;
}

// Valid Brazilian DDDs
const VALID_DDDS = [
  '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
  '21', '22', '24', // RJ
  '27', '28', // ES
  '31', '32', '33', '34', '35', '37', '38', // MG
  '41', '42', '43', '44', '45', '46', // PR
  '47', '48', '49', // SC
  '51', '53', '54', '55', // RS
  '61', // DF
  '62', '64', // GO
  '63', // TO
  '65', '66', // MT
  '67', // MS
  '68', // AC
  '69', // RO
  '71', '73', '74', '75', '77', // BA
  '79', // SE
  '81', '87', // PE
  '82', // AL
  '83', // PB
  '84', // RN
  '85', '88', // CE
  '86', '89', // PI
  '91', '93', '94', // PA
  '92', '97', // AM
  '95', // RR
  '96', // AP
  '98', '99', // MA
];

/**
 * Validate phone with DDD check
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  
  // Must be 10 (landline) or 11 (mobile) digits
  if (digits.length < 10 || digits.length > 11) return false;
  
  // Validate DDD
  const ddd = digits.substring(0, 2);
  if (!VALID_DDDS.includes(ddd)) return false;
  
  // Mobile must start with 9 after DDD
  if (digits.length === 11 && digits[2] !== '9') return false;
  
  return true;
}

/**
 * Check if phone has valid length (for real-time validation)
 */
export function isValidPhoneLength(phone: string): boolean {
  const len = phone.replace(/\D/g, '').length;
  return len >= 10 && len <= 11;
}

/**
 * Get phone validation error message
 */
export function getPhoneErrorMessage(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length < 10) return 'Telefone incompleto';
  if (!isValidPhone(phone)) return 'Telefone inválido (verifique o DDD)';
  return null;
}
