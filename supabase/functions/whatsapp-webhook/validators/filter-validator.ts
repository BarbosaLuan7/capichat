import { isGroupChat, isStatusBroadcast } from '../../_shared/index.ts';

/**
 * Check if the contact is a group chat that should be filtered out
 */
export function shouldFilterGroupChat(rawContact: string): boolean {
  return isGroupChat(rawContact);
}

/**
 * Check if the contact is a status/broadcast that should be filtered out
 */
export function shouldFilterStatusBroadcast(rawContact: string): boolean {
  return isStatusBroadcast(rawContact);
}

/**
 * Validate contact and return filter reason if should be ignored
 * Returns null if contact is valid, otherwise returns the reason to ignore
 */
export function validateContact(rawContact: string): string | null {
  if (shouldFilterGroupChat(rawContact)) {
    console.log('[whatsapp-webhook] Ignorando mensagem de grupo:', rawContact);
    return 'group_message';
  }

  if (shouldFilterStatusBroadcast(rawContact)) {
    console.log('[whatsapp-webhook] Ignorando mensagem de status/broadcast:', rawContact);
    return 'status_broadcast';
  }

  return null;
}

/**
 * Check if phone is the same as instance phone (self-message)
 * Compares last 10 digits to ignore country code differences
 */
export function isSelfMessage(phoneA: string, phoneB: string): boolean {
  const digitsA = phoneA.replace(/\D/g, '');
  const digitsB = phoneB.replace(/\D/g, '');
  return digitsA.slice(-10) === digitsB.slice(-10);
}
