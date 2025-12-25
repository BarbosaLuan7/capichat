import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SignedUrlCache {
  url: string;
  expiresAt: number;
}

// Cache global para evitar regenerar URLs
const urlCache = new Map<string, SignedUrlCache>();

// Tempo de expiração da signed URL (50 minutos, para ter margem antes dos 60 min do Supabase)
const SIGNED_URL_EXPIRY = 50 * 60; // em segundos

/**
 * Hook para gerar signed URLs para arquivos em buckets privados do Supabase Storage.
 * Suporta URLs no formato:
 * - storage://bucket-name/path/to/file
 * - URLs diretas de storage do Supabase
 * - URLs públicas (retorna a própria URL)
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

    // Se for uma URL pública normal (não do storage), usar diretamente
    if (!mediaUrl.startsWith('storage://') && !mediaUrl.includes('supabase.co/storage')) {
      setSignedUrl(mediaUrl);
      return;
    }

    const generateSignedUrl = async () => {
      // Checar cache primeiro
      const cached = urlCache.get(mediaUrl);
      if (cached && cached.expiresAt > Date.now()) {
        setSignedUrl(cached.url);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let bucket: string;
        let path: string;

        if (mediaUrl.startsWith('storage://')) {
          // Formato: storage://bucket-name/path/to/file
          const withoutPrefix = mediaUrl.replace('storage://', '');
          const slashIndex = withoutPrefix.indexOf('/');
          bucket = withoutPrefix.substring(0, slashIndex);
          path = withoutPrefix.substring(slashIndex + 1);
        } else {
          // URL direta do Supabase Storage
          // Exemplo: https://xxx.supabase.co/storage/v1/object/public/bucket-name/path
          const match = mediaUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
          if (!match) {
            // Se não conseguir parsear, usar a URL diretamente
            setSignedUrl(mediaUrl);
            setIsLoading(false);
            return;
          }
          bucket = match[1];
          path = match[2];
        }

        // Gerar signed URL
        const { data, error: signError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, SIGNED_URL_EXPIRY);

        if (signError) {
          console.error('[useSignedUrl] Erro ao gerar signed URL:', signError);
          // Fallback: tentar usar URL pública
          const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
          setSignedUrl(publicUrl);
          setError(signError.message);
        } else if (data?.signedUrl) {
          // Cachear a URL
          urlCache.set(mediaUrl, {
            url: data.signedUrl,
            expiresAt: Date.now() + (SIGNED_URL_EXPIRY * 1000) - 60000, // 1 min antes de expirar
          });
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('[useSignedUrl] Erro:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        // Fallback: usar a URL original
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
 * Função utilitária para gerar signed URL de forma imperativa (não hook).
 * Útil para casos onde não se pode usar hooks.
 */
export async function getSignedUrl(mediaUrl: string): Promise<string> {
  if (!mediaUrl) return '';
  
  // Se for URL pública normal, retornar diretamente
  if (!mediaUrl.startsWith('storage://') && !mediaUrl.includes('supabase.co/storage')) {
    return mediaUrl;
  }

  // Checar cache primeiro
  const cached = urlCache.get(mediaUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    let bucket: string;
    let path: string;

    if (mediaUrl.startsWith('storage://')) {
      const withoutPrefix = mediaUrl.replace('storage://', '');
      const slashIndex = withoutPrefix.indexOf('/');
      bucket = withoutPrefix.substring(0, slashIndex);
      path = withoutPrefix.substring(slashIndex + 1);
    } else {
      const match = mediaUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
      if (!match) {
        return mediaUrl;
      }
      bucket = match[1];
      path = match[2];
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_EXPIRY);

    if (error || !data?.signedUrl) {
      console.error('[getSignedUrl] Erro:', error);
      // Fallback para URL pública
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
      return publicUrl;
    }

    // Cachear
    urlCache.set(mediaUrl, {
      url: data.signedUrl,
      expiresAt: Date.now() + (SIGNED_URL_EXPIRY * 1000) - 60000,
    });

    return data.signedUrl;
  } catch (err) {
    console.error('[getSignedUrl] Erro:', err);
    return mediaUrl;
  }
}

/**
 * Limpa o cache de URLs (útil para logout ou refresh)
 */
export function clearSignedUrlCache() {
  urlCache.clear();
}
