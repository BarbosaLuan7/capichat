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
 * Formata telefone brasileiro para exibição
 * Detecta e remove código do país automaticamente
 */
export function formatPhoneNumber(phone: string): string {
  const numbers = normalizePhoneNumber(phone);
  
  // Celular (11 dígitos): (XX) XXXXX-XXXX
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  // Fixo (10 dígitos): (XX) XXXX-XXXX
  if (numbers.length === 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
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
 * Remove CPF formatting, returns only digits
 */
export function unformatCPF(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Validate CPF (basic validation - 11 digits)
 */
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  return digits.length === 11;
}

/**
 * Validate phone (basic validation - 10 or 11 digits)
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}
