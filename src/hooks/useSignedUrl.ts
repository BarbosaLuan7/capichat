import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface SignedUrlCache {
  url: string;
  expiresAt: number;
}

// Cache global para evitar regenerar URLs
const urlCache = new Map<string, SignedUrlCache>();

// Tempo de expiração da signed URL (50 minutos, para ter margem antes dos 60 min do Supabase)
const SIGNED_URL_EXPIRY = 50 * 60; // em segundos

// Limite de requisições paralelas
const MAX_PARALLEL_REQUESTS = 5;

/**
 * Parseia uma URL de mídia para extrair bucket e path
 */
function parseMediaUrl(mediaUrl: string): { bucket: string; path: string } | null {
  if (mediaUrl.startsWith('storage://')) {
    const withoutPrefix = mediaUrl.replace('storage://', '');
    const slashIndex = withoutPrefix.indexOf('/');
    return {
      bucket: withoutPrefix.substring(0, slashIndex),
      path: withoutPrefix.substring(slashIndex + 1),
    };
  }

  const match = mediaUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
  if (match) {
    return { bucket: match[1], path: match[2] };
  }

  return null;
}

/**
 * Verifica se uma URL precisa de signed URL
 */
function needsSignedUrl(url: string): boolean {
  return url.startsWith('storage://') || url.includes('supabase.co/storage');
}

/**
 * Hook para gerar signed URLs para arquivos em buckets privados do Supabase Storage.
 */
export function useSignedUrl(mediaUrl: string | null | undefined) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaUrl) {
      setSignedUrl(null);
      return;
    }

    if (!needsSignedUrl(mediaUrl)) {
      setSignedUrl(mediaUrl);
      return;
    }

    const cached = urlCache.get(mediaUrl);
    if (cached && cached.expiresAt > Date.now()) {
      setSignedUrl(cached.url);
      return;
    }

    const generateSignedUrl = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const parsed = parseMediaUrl(mediaUrl);
        if (!parsed) {
          setSignedUrl(mediaUrl);
          setIsLoading(false);
          return;
        }

        const { data, error: signError } = await supabase.storage
          .from(parsed.bucket)
          .createSignedUrl(parsed.path, SIGNED_URL_EXPIRY);

        if (signError) {
          logger.error('[useSignedUrl] Erro ao gerar signed URL:', signError);
          const { data: { publicUrl } } = supabase.storage.from(parsed.bucket).getPublicUrl(parsed.path);
          setSignedUrl(publicUrl);
          setError(signError.message);
        } else if (data?.signedUrl) {
          urlCache.set(mediaUrl, {
            url: data.signedUrl,
            expiresAt: Date.now() + (SIGNED_URL_EXPIRY * 1000) - 60000,
          });
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        logger.error('[useSignedUrl] Erro:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        setSignedUrl(mediaUrl);
      } finally {
        setIsLoading(false);
      }
    };

    generateSignedUrl();
  }, [mediaUrl]);

  return { signedUrl, isLoading, error };
}

/**
 * Hook para gerar signed URLs em batch para múltiplas mídias.
 * Muito mais eficiente que chamar useSignedUrl para cada mensagem.
 */
export function useSignedUrlBatch(mediaUrls: (string | null | undefined)[]) {
  const [urlMap, setUrlMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Stable key for dependency - only changes when actual URLs change
  const urlsKey = useMemo(() => {
    const sorted = mediaUrls.filter(Boolean).sort();
    return sorted.join('|');
  }, [mediaUrls]);

  // Filtrar URLs únicas que precisam de signed URL
  const urlsToResolve = useMemo(() => {
    const unique = new Set<string>();
    mediaUrls.forEach(url => {
      if (url && needsSignedUrl(url)) {
        const cached = urlCache.get(url);
        if (!cached || cached.expiresAt <= Date.now()) {
          unique.add(url);
        }
      }
    });
    return Array.from(unique);
  }, [urlsKey]);

  useEffect(() => {
    // Build initial map from cache
    const buildMapFromCache = () => {
      const cached = new Map<string, string>();
      mediaUrls.forEach(url => {
        if (url) {
          if (!needsSignedUrl(url)) {
            cached.set(url, url);
          } else {
            const c = urlCache.get(url);
            if (c && c.expiresAt > Date.now()) {
              cached.set(url, c.url);
            }
          }
        }
      });
      return cached;
    };

    if (urlsToResolve.length === 0) {
      setUrlMap(buildMapFromCache());
      return;
    }

    let cancelled = false;

    const resolveBatch = async () => {
      setIsLoading(true);

      // Start with cached values
      const newMap = buildMapFromCache();

      // Processar em chunks para não sobrecarregar
      const chunks: string[][] = [];
      for (let i = 0; i < urlsToResolve.length; i += MAX_PARALLEL_REQUESTS) {
        chunks.push(urlsToResolve.slice(i, i + MAX_PARALLEL_REQUESTS));
      }

      for (const chunk of chunks) {
        if (cancelled) return;

        const results = await Promise.all(
          chunk.map(async (url) => {
            // Double-check cache before making request
            const cached = urlCache.get(url);
            if (cached && cached.expiresAt > Date.now()) {
              return { original: url, signed: cached.url };
            }

            try {
              const parsed = parseMediaUrl(url);
              if (!parsed) return { original: url, signed: url };

              const { data, error } = await supabase.storage
                .from(parsed.bucket)
                .createSignedUrl(parsed.path, SIGNED_URL_EXPIRY);

              if (error || !data?.signedUrl) {
                const { data: { publicUrl } } = supabase.storage.from(parsed.bucket).getPublicUrl(parsed.path);
                return { original: url, signed: publicUrl };
              }

              // Cachear
              urlCache.set(url, {
                url: data.signedUrl,
                expiresAt: Date.now() + (SIGNED_URL_EXPIRY * 1000) - 60000,
              });

              return { original: url, signed: data.signedUrl };
            } catch (err) {
              logger.error('[useSignedUrlBatch] Erro:', err);
              return { original: url, signed: url };
            }
          })
        );

        if (cancelled) return;

        results.forEach(({ original, signed }) => {
          newMap.set(original, signed);
        });
      }

      if (!cancelled) {
        setUrlMap(newMap);
        setIsLoading(false);
      }
    };

    resolveBatch();

    return () => {
      cancelled = true;
    };
  }, [urlsKey]);

  const getSignedUrl = useCallback((originalUrl: string | null | undefined): string | null => {
    if (!originalUrl) return null;
    
    // Se não precisa de signed URL, retorna a original
    if (!needsSignedUrl(originalUrl)) {
      return originalUrl;
    }
    
    // Se precisa de signed URL, só retorna se já tiver resolvida
    // Retorna null enquanto não resolve para evitar carregar storage:// no <img>
    const resolved = urlMap.get(originalUrl);
    if (resolved && !resolved.startsWith('storage://')) {
      return resolved;
    }
    
    return null;
  }, [urlMap]);

  return { getSignedUrl, isLoading, urlMap };
}

/**
 * Função utilitária para gerar signed URL de forma imperativa.
 */
export async function getSignedUrl(mediaUrl: string): Promise<string> {
  if (!mediaUrl) return '';
  
  if (!needsSignedUrl(mediaUrl)) {
    return mediaUrl;
  }

  const cached = urlCache.get(mediaUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const parsed = parseMediaUrl(mediaUrl);
    if (!parsed) return mediaUrl;

    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, SIGNED_URL_EXPIRY);

    if (error || !data?.signedUrl) {
      const { data: { publicUrl } } = supabase.storage.from(parsed.bucket).getPublicUrl(parsed.path);
      return publicUrl;
    }

    urlCache.set(mediaUrl, {
      url: data.signedUrl,
      expiresAt: Date.now() + (SIGNED_URL_EXPIRY * 1000) - 60000,
    });

    return data.signedUrl;
  } catch (err) {
    logger.error('[getSignedUrl] Erro:', err);
    return mediaUrl;
  }
}

/**
 * Limpa o cache de URLs
 */
export function clearSignedUrlCache() {
  urlCache.clear();
}
