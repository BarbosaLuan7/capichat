import { uploadMediaToStorage, WAHAMessage } from '../../_shared/index.ts';
import type { SupabaseClientType, WAHAConfig } from '../types.ts';

/**
 * Extension map for base64 to file extension conversion
 */
const MIMETYPE_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/ogg': 'ogg',
  'audio/ogg; codecs=opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
};

/**
 * Extension map for message type to default extension
 */
const TYPE_TO_EXTENSION: Record<string, string> = {
  image: 'jpg',
  audio: 'ogg',
  video: 'mp4',
  document: 'bin',
};

/**
 * Detect if a string is valid base64 data
 */
export function isValidBase64(str: string): boolean {
  if (!str || typeof str !== 'string' || str.length < 100) return false;

  // Common base64 patterns for different file types
  const base64Patterns = ['/9j/', 'iVBOR', 'R0lGOD', 'UklGR', 'AAAA', 'GkXf', 'T2dn'];

  return (
    base64Patterns.some((p) => str.startsWith(p)) ||
    (str.length > 500 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)))
  );
}

/**
 * Extract base64 data from message payload
 */
export function extractBase64FromPayload(messageData: any): {
  data: string | null;
  mimetype: string;
} {
  const base64Data =
    messageData?._data?.media?.data ||
    messageData?.media?.data ||
    messageData?.mediaData ||
    messageData?._data?.body;

  const mimetype =
    messageData?._data?.media?.mimetype ||
    messageData?.media?.mimetype ||
    messageData?._data?.mimetype ||
    '';

  return { data: base64Data, mimetype };
}

/**
 * Get file extension from mimetype or type
 */
export function getExtension(mimetype: string, type: string): string {
  return MIMETYPE_TO_EXTENSION[mimetype] || TYPE_TO_EXTENSION[type] || 'bin';
}

/**
 * Upload base64 data directly to storage
 */
export async function uploadBase64ToStorage(
  supabase: SupabaseClientType,
  base64Data: string,
  mimetype: string,
  type: string,
  leadId: string
): Promise<string | null> {
  try {
    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const extension = getExtension(mimetype, type);
    const fileName = `leads/${leadId}/${Date.now()}.${extension}`;
    const contentType = mimetype || 'application/octet-stream';

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('message-attachments')
      .upload(fileName, bytes.buffer, {
        contentType,
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      console.error('[media-processor] Error uploading base64:', uploadError);
      return null;
    }

    const storageUrl = `storage://message-attachments/${uploadData.path}`;
    console.log('[media-processor] Base64 uploaded successfully:', storageUrl);
    return storageUrl;
  } catch (error) {
    console.error('[media-processor] Error processing base64:', error);
    return null;
  }
}

/**
 * Fetch media from WAHA API
 */
export async function fetchMediaFromWAHA(
  wahaConfig: WAHAConfig,
  chatId: string,
  messageId: string
): Promise<{ url?: string; base64?: string; mimetype?: string } | null> {
  try {
    const cleanChatId = chatId.includes('@') ? chatId : `${chatId}@c.us`;
    const url = `${wahaConfig.baseUrl}/api/${wahaConfig.sessionName}/chats/${cleanChatId}/messages/${messageId}?downloadMedia=true`;

    console.log('[media-processor] Fetching media from WAHA:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': wahaConfig.apiKey,
        Authorization: `Bearer ${wahaConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log('[media-processor] WAHA API error:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[media-processor] WAHA response:', JSON.stringify(data).substring(0, 500));

    const mediaUrl =
      data?.media?.url ||
      data?.mediaUrl ||
      data?._data?.media?.url ||
      data?._data?.deprecatedMms3Url;

    const base64 = data?.media?.data || data?._data?.media?.data;
    const mimetype = data?.media?.mimetype || data?._data?.media?.mimetype || '';

    return { url: mediaUrl, base64, mimetype };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[media-processor] Timeout fetching media from WAHA');
    } else {
      console.error('[media-processor] Error fetching media from WAHA:', error);
    }
    return null;
  }
}

/**
 * Process media from message - handles base64, WAHA API fetch, and storage upload
 */
export async function processMediaFromMessage(
  supabase: SupabaseClientType,
  messageData: WAHAMessage & { _data?: any },
  type: string,
  mediaUrl: string | undefined,
  leadId: string,
  wahaConfig: WAHAConfig | null,
  externalMessageId: string,
  isFromMe: boolean
): Promise<string | undefined> {
  let finalMediaUrl = mediaUrl;

  // Try to extract base64 from payload
  const { data: base64Data, mimetype: base64Mimetype } = extractBase64FromPayload(messageData);

  // If no URL but has base64, upload directly
  if (!finalMediaUrl && type !== 'text' && base64Data && isValidBase64(base64Data)) {
    console.log('[media-processor] Base64 found in payload, uploading directly...');
    console.log('[media-processor] Base64 length:', base64Data.length, 'mimetype:', base64Mimetype);

    const storageUrl = await uploadBase64ToStorage(
      supabase,
      base64Data,
      base64Mimetype,
      type,
      leadId
    );

    if (storageUrl) {
      return storageUrl;
    }
  }

  // If still no media and it's a media type, try fetching from WAHA API
  if (!finalMediaUrl && type !== 'text' && wahaConfig && externalMessageId) {
    console.log('[media-processor] No URL/base64, trying WAHA API...');

    const rawContact = isFromMe
      ? messageData.to || messageData.chatId
      : messageData.from || messageData.chatId;

    if (rawContact) {
      const wahaMedia = await fetchMediaFromWAHA(wahaConfig, rawContact, externalMessageId);

      if (wahaMedia?.url) {
        console.log('[media-processor] URL retrieved from API:', wahaMedia.url.substring(0, 100));
        finalMediaUrl = wahaMedia.url;
      } else if (wahaMedia?.base64 && isValidBase64(wahaMedia.base64)) {
        console.log('[media-processor] Base64 retrieved from API, uploading...');
        const storageUrl = await uploadBase64ToStorage(
          supabase,
          wahaMedia.base64,
          wahaMedia.mimetype || '',
          type,
          leadId
        );

        if (storageUrl) {
          return storageUrl;
        }
      } else {
        console.log('[media-processor] WAHA returned no media.url or valid base64');
      }
    }
  }

  // If we have a URL (original or from API), upload to permanent storage
  if (finalMediaUrl && type !== 'text') {
    console.log('[media-processor] Processing media for storage:', {
      type,
      mediaUrl: finalMediaUrl.substring(0, 100),
      hasConfig: !!wahaConfig,
    });

    const storageUrl = await uploadMediaToStorage(
      supabase,
      finalMediaUrl,
      type,
      leadId,
      wahaConfig
    );

    if (storageUrl) {
      console.log('[media-processor] Media saved to storage:', storageUrl);
      return storageUrl;
    } else {
      console.log('[media-processor] Upload failed, returning undefined');
      return undefined;
    }
  }

  return finalMediaUrl;
}

/**
 * Update existing message with media URL (for deferred media processing)
 */
export async function updateMessageWithMedia(
  supabase: SupabaseClientType,
  messageId: string,
  mediaUrl: string
): Promise<boolean> {
  const { error } = await supabase
    .from('messages')
    .update({ media_url: mediaUrl })
    .eq('id', messageId);

  if (error) {
    console.error('[media-processor] Error updating message with media:', error);
    return false;
  }

  console.log('[media-processor] Message updated with media URL:', mediaUrl.substring(0, 50));
  return true;
}
