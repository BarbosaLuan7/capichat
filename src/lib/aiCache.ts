// Simple in-memory cache for AI responses with TTL

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class AICache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + (ttl || this.defaultTTL),
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.timestamp) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Generate cache key from messages (use context ID + last message ID + count + lead context as fingerprint)
export function generateMessagesKey(
  prefix: string, 
  messages: any[], 
  contextId?: string,  // lead_id or conversation_id to isolate cache per lead
  leadContext?: { labels?: { name: string }[]; stage?: string } // lead labels and stage for context-aware caching
): string {
  const context = contextId || 'unknown';
  
  if (!messages || messages.length === 0) return `${prefix}:${context}:empty`;
  
  const lastMessage = messages[messages.length - 1];
  
  // Include lead context in fingerprint for context-aware caching
  let leadFingerprint = '';
  if (leadContext) {
    const labelNames = leadContext.labels?.map(l => l.name).sort().join(',') || '';
    const stage = leadContext.stage || '';
    leadFingerprint = `-${labelNames}-${stage}`;
  }
  
  const fingerprint = `${context}-${messages.length}-${lastMessage?.id || lastMessage?.created_at || 'unknown'}${leadFingerprint}`;
  
  return `${prefix}:${fingerprint}`;
}

export const aiCache = new AICache();
