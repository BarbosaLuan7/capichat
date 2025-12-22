// Utilities to extract meaningful messages from Supabase Edge Function errors.

export function getEdgeFunctionErrorMessage(err: unknown): string | null {
  const message =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
        ? (err as any).message
        : null;

  if (!message) return null;

  // Typical format:
  // "Edge function returned 500: Error, {\"error\":\"...\"}"
  const jsonMatch = message.match(/\{[\s\S]*\}$/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed.error === 'string') return parsed.error;
    } catch {
      // ignore
    }
  }

  return message;
}
