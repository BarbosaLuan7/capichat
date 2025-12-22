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

// Generate cache key from messages (use last message ID + count as fingerprint)
export function generateMessagesKey(prefix: string, messages: any[]): string {
  if (!messages || messages.length === 0) return `${prefix}:empty`;
  
  const lastMessage = messages[messages.length - 1];
  const fingerprint = `${messages.length}-${lastMessage?.id || lastMessage?.created_at || 'unknown'}`;
  
  return `${prefix}:${fingerprint}`;
}

export const aiCache = new AICache();
