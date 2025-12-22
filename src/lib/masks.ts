/**
 * Utility functions for formatting and unformatting Brazilian document numbers and phone numbers
 */

/**
 * Format phone number to (00) 00000-0000 or (00) 0000-0000
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
