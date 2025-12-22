import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Tipos de eventos WAHA
interface WAHAMessage {
  id: string;
  timestamp: number;
  from: string;
  to: string;
  body: string;
  hasMedia: boolean;
  mediaUrl?: string;
  type: 'chat' | 'image' | 'video' | 'audio' | 'document' | 'ptt';
  fromMe: boolean;
  pushName?: string;
  chatId?: string;
}

interface WAHAWebhookPayload {
  event: string;
  session: string;
  engine?: string;
  payload: WAHAMessage | Record<string, unknown>;
  me?: {
    id: string;
    pushName: string;
  };
}

// Tipos Evolution API
interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { url?: string; caption?: string };
    audioMessage?: { url?: string };
    videoMessage?: { url?: string; caption?: string };
    documentMessage?: { url?: string; fileName?: string };
  };
  messageType: string;
  messageTimestamp: number;
}

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: EvolutionMessage;
}

function normalizePhone(phone: string): string {
  // Remove @c.us, @s.whatsapp.net e caracteres não numéricos
  let numbers = phone
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace(/\D/g, '');
  
  // Remove código do país (55) se presente e número tem 12+ dígitos
  if (numbers.startsWith('55') && numbers.length >= 12) {
    numbers = numbers.substring(2);
  }
  
  return numbers;
}

// Formata telefone para exibição em fallback do nome
function formatPhoneForDisplay(phone: string): string {
  if (phone.length === 11) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
  }
  if (phone.length === 10) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
  }
  return phone;
}

// Função para baixar mídia e fazer upload para o storage
async function uploadMediaToStorage(
  supabase: any,
  mediaUrl: string,
  type: string,
  leadId: string
): Promise<string | null> {
  try {
    console.log('[whatsapp-webhook] Baixando mídia de:', mediaUrl);
    
    // Baixar o arquivo
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      console.error('[whatsapp-webhook] Erro ao baixar mídia:', response.status);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    
    console.log('[whatsapp-webhook] Mídia baixada, contentType:', contentType, 'size:', arrayBuffer.byteLength);
    
    // Determinar extensão baseada no content-type ou tipo de mensagem
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'audio/ogg': 'ogg',
      'audio/ogg; codecs=opus': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    };
    
    // Tentar encontrar extensão pelo content-type exato ou parcial
    let extension = extensionMap[contentType];
    if (!extension) {
      // Tentar match parcial
      for (const [ct, ext] of Object.entries(extensionMap)) {
        if (contentType.includes(ct.split('/')[1])) {
          extension = ext;
          break;
        }
      }
    }
    
    // Fallback baseado no tipo de mensagem
    if (!extension) {
      const typeExtMap: Record<string, string> = {
        'image': 'jpg',
        'audio': 'ogg',
        'video': 'mp4',
        'document': 'bin',
      };
      extension = typeExtMap[type] || 'bin';
    }
    
    // Nome do arquivo: leads/{leadId}/{timestamp}.{ext}
    const fileName = `leads/${leadId}/${Date.now()}.${extension}`;
    
    // Upload para o storage
    const { data, error } = await supabase.storage
      .from('message-attachments')
      .upload(fileName, arrayBuffer, {
        contentType,
        cacheControl: '31536000', // 1 ano
        upsert: false,
      });
    
    if (error) {
      console.error('[whatsapp-webhook] Erro no upload:', error);
      return null;
    }
    
    // Gerar URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(data.path);
    
    console.log('[whatsapp-webhook] Mídia salva em:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('[whatsapp-webhook] Erro ao processar mídia:', error);
    return null;
  }
}

function getMessageContent(payload: WAHAMessage | EvolutionMessage, provider: 'waha' | 'evolution'): { content: string; type: string; mediaUrl?: string } {
  if (provider === 'waha') {
    const msg = payload as WAHAMessage;
    let type = 'text';
    
    if (msg.type === 'ptt' || msg.type === 'audio') {
      type = 'audio';
    } else if (msg.type === 'image') {
      type = 'image';
    } else if (msg.type === 'video') {
      type = 'video';
    } else if (msg.type === 'document') {
      type = 'document';
    }
    
    return {
      content: msg.body || '[Mídia]',
      type,
      mediaUrl: msg.mediaUrl,
    };
  } else {
    const msg = payload as EvolutionMessage;
    const message = msg.message;
    
    if (!message) {
      return { content: '[Mensagem vazia]', type: 'text' };
    }
    
    if (message.conversation) {
      return { content: message.conversation, type: 'text' };
    }
    
    if (message.extendedTextMessage?.text) {
      return { content: message.extendedTextMessage.text, type: 'text' };
    }
    
    if (message.imageMessage) {
      return {
        content: message.imageMessage.caption || '[Imagem]',
        type: 'image',
        mediaUrl: message.imageMessage.url,
      };
    }
    
    if (message.audioMessage) {
      return {
        content: '[Áudio]',
        type: 'audio',
        mediaUrl: message.audioMessage.url,
      };
    }
    
    if (message.videoMessage) {
      return {
        content: message.videoMessage.caption || '[Vídeo]',
        type: 'video',
        mediaUrl: message.videoMessage.url,
      };
    }
    
    if (message.documentMessage) {
      return {
        content: message.documentMessage.fileName || '[Documento]',
        type: 'document',
        mediaUrl: message.documentMessage.url,
      };
    }
    
    return { content: '[Mensagem não suportada]', type: 'text' };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('[whatsapp-webhook] Recebido:', JSON.stringify(body).substring(0, 500));

    // Detectar provider pelo formato do payload
    let provider: 'waha' | 'evolution' = 'waha';
    let event = '';
    let messageData: WAHAMessage | EvolutionMessage | null = null;
    let senderPhone = '';
    let senderName = '';
    let isFromMe = false;

    // WAHA format
    if (body.event && body.session !== undefined) {
      provider = 'waha';
      event = body.event;
      
      // Log completo para debug
      console.log('[whatsapp-webhook] Payload WAHA completo:', JSON.stringify(body));
      
      // ========== WAHA: Evento de ACK (status delivered/read) ==========
      if (event === 'message.ack') {
        const payload = body.payload || {};
        const messageId = payload.id || payload.key?.id || payload.ids?.[0];
        const ackName = payload.ackName || payload.receipt_type || payload.ack;
        const ackNumber = payload.ack;
        
        console.log('[whatsapp-webhook] ACK recebido:', { messageId, ackName, ackNumber });
        
        let newStatus: 'delivered' | 'read' | null = null;
        
        // WAHA usa ackName: 'DEVICE' (entregue), 'READ' (lida), 'PLAYED' (áudio reproduzido)
        // Ou ack: 2 (delivered), 3 (read)
        if (['DEVICE', 'delivered', 'DELIVERY_ACK'].includes(ackName) || ackNumber === 2) {
          newStatus = 'delivered';
        } else if (['READ', 'read', 'PLAYED'].includes(ackName) || ackNumber === 3) {
          newStatus = 'read';
        }
        
        if (newStatus && messageId) {
          const { error: updateError } = await supabase
            .from('messages')
            .update({ status: newStatus })
            .eq('external_id', messageId);
          
          if (updateError) {
            console.error('[whatsapp-webhook] Erro ao atualizar status:', updateError);
          } else {
            console.log('[whatsapp-webhook] Status atualizado para:', newStatus, 'messageId:', messageId);
          }
        }
        
        return new Response(
          JSON.stringify({ success: true, event: 'ack', status: newStatus, messageId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Eventos de mensagem do WAHA
      if (event === 'message' || event === 'message.any') {
        const payload = body.payload as WAHAMessage;
        
        // Ignorar mensagens enviadas por nós
        if (payload.fromMe) {
          console.log('[whatsapp-webhook] Ignorando mensagem enviada por nós');
          return new Response(
            JSON.stringify({ success: true, ignored: true, reason: 'fromMe' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        messageData = payload;
        senderPhone = normalizePhone(payload.from || payload.chatId || '');
        
        // Extrair pushName de múltiplas fontes possíveis no payload WAHA
        senderName = 
          payload.pushName ||
          (body.payload as any)?._data?.pushName ||
          (body.payload as any)?._data?.notifyName ||
          body.pushName ||
          (body.payload as any)?.chat?.contact?.pushname ||
          (body.payload as any)?.sender?.pushName ||
          '';
        
        console.log('[whatsapp-webhook] pushName extraído:', senderName);
        isFromMe = payload.fromMe;
      } else {
        console.log('[whatsapp-webhook] Evento não processado:', event);
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: 'event not handled', event }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Evolution API format
    else if (body.event && body.instance !== undefined) {
      provider = 'evolution';
      event = body.event;
      
      // ========== Evolution: Evento de status update ==========
      if (event === 'messages.update') {
        const payload = body.data || {};
        const messageId = payload.key?.id || payload.id;
        const status = payload.update?.status || payload.status;
        
        console.log('[whatsapp-webhook] Evolution status update:', { messageId, status });
        
        let newStatus: 'delivered' | 'read' | null = null;
        
        // Evolution usa: 2 = delivered, 3 = read (ou strings equivalentes)
        if (status === 2 || status === 'DELIVERY_ACK' || status === 'delivered') {
          newStatus = 'delivered';
        } else if (status === 3 || status === 'READ' || status === 'read') {
          newStatus = 'read';
        }
        
        if (newStatus && messageId) {
          const { error: updateError } = await supabase
            .from('messages')
            .update({ status: newStatus })
            .eq('external_id', messageId);
          
          if (updateError) {
            console.error('[whatsapp-webhook] Erro ao atualizar status Evolution:', updateError);
          } else {
            console.log('[whatsapp-webhook] Status Evolution atualizado para:', newStatus, 'messageId:', messageId);
          }
        }
        
        return new Response(
          JSON.stringify({ success: true, event: 'status_update', status: newStatus, messageId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (event === 'messages.upsert') {
        const payload = body.data as EvolutionMessage;
        
        // Ignorar mensagens enviadas por nós
        if (payload.key?.fromMe) {
          console.log('[whatsapp-webhook] Ignorando mensagem enviada por nós');
          return new Response(
            JSON.stringify({ success: true, ignored: true, reason: 'fromMe' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        messageData = payload;
        senderPhone = normalizePhone(payload.key?.remoteJid || '');
        senderName = payload.pushName || '';
        isFromMe = payload.key?.fromMe || false;
      } else {
        console.log('[whatsapp-webhook] Evento Evolution não processado:', event);
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: 'event not handled', event }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Formato desconhecido
    else {
      console.log('[whatsapp-webhook] Formato de payload desconhecido');
      return new Response(
        JSON.stringify({ success: false, error: 'Unknown payload format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messageData || !senderPhone) {
      console.log('[whatsapp-webhook] Dados inválidos:', { messageData: !!messageData, senderPhone });
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid message data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[whatsapp-webhook] Processando mensagem de:', senderPhone, 'Nome:', senderName);

    // Extrair conteúdo da mensagem
    const { content, type, mediaUrl } = getMessageContent(messageData, provider);
    console.log('[whatsapp-webhook] Conteúdo:', content.substring(0, 100), 'Tipo:', type, 'MediaUrl:', mediaUrl ? 'presente' : 'nenhum');

    // Buscar lead pelo telefone
    let lead;
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .or(`phone.ilike.%${senderPhone}%,phone.eq.${senderPhone}`)
      .maybeSingle();

    if (existingLead) {
      lead = existingLead;
      console.log('[whatsapp-webhook] Lead encontrado:', lead.id);

      // Atualizar nome do WhatsApp se disponível
      const updateData: Record<string, unknown> = {
        last_interaction_at: new Date().toISOString(),
      };
      
      if (senderName && !existingLead.whatsapp_name) {
        updateData.whatsapp_name = senderName;
      }

      await supabase
        .from('leads')
        .update(updateData)
        .eq('id', lead.id);
    } else {
      // Criar novo lead
      console.log('[whatsapp-webhook] Criando novo lead para:', senderPhone);
      
      const { data: firstStage } = await supabase
        .from('funnel_stages')
        .select('id')
        .order('order', { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: newLead, error: createLeadError } = await supabase
        .from('leads')
        .insert({
          name: senderName || `Lead ${formatPhoneForDisplay(senderPhone)}`,
          phone: senderPhone,
          whatsapp_name: senderName,
          source: 'whatsapp',
          temperature: 'warm',
          stage_id: firstStage?.id,
          status: 'active',
          last_interaction_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (createLeadError) {
        console.error('[whatsapp-webhook] Erro ao criar lead:', createLeadError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error creating lead' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      lead = newLead;
      console.log('[whatsapp-webhook] Lead criado:', lead.id);
    }

    // Buscar ou criar conversa
    let conversation;
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', lead.id)
      .in('status', ['open', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConversation) {
      conversation = existingConversation;
      console.log('[whatsapp-webhook] Conversa encontrada:', conversation.id);

      // Atualizar conversa
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          unread_count: (conversation.unread_count || 0) + 1,
          status: 'open',
        })
        .eq('id', conversation.id);
    } else {
      // Criar nova conversa
      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          lead_id: lead.id,
          status: 'open',
          assigned_to: lead.assigned_to,
          last_message_at: new Date().toISOString(),
          unread_count: 1,
        })
        .select('*')
        .single();

      if (createConvError) {
        console.error('[whatsapp-webhook] Erro ao criar conversa:', createConvError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error creating conversation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      conversation = newConversation;
      console.log('[whatsapp-webhook] Conversa criada:', conversation.id);
    }

    // Se tiver mídia, fazer upload para o storage permanente
    let finalMediaUrl = mediaUrl;
    if (mediaUrl && type !== 'text') {
      console.log('[whatsapp-webhook] Processando mídia para storage...');
      const storageUrl = await uploadMediaToStorage(supabase, mediaUrl, type, lead.id);
      if (storageUrl) {
        finalMediaUrl = storageUrl;
        console.log('[whatsapp-webhook] Mídia salva no storage:', storageUrl);
      } else {
        console.log('[whatsapp-webhook] Falha no upload, usando URL original como fallback');
      }
    }

    // Criar mensagem
    const { data: message, error: createMsgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        lead_id: lead.id,
        sender_id: lead.id,
        sender_type: 'lead',
        content: content,
        type: type as 'text' | 'image' | 'audio' | 'video' | 'document',
        media_url: finalMediaUrl,
        direction: 'inbound',
        status: 'delivered',
      })
      .select('*')
      .single();

    if (createMsgError) {
      console.error('[whatsapp-webhook] Erro ao criar mensagem:', createMsgError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error creating message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[whatsapp-webhook] Mensagem criada:', message.id);

    // Criar notificação para o usuário atribuído
    if (conversation.assigned_to) {
      try {
        await supabase.rpc('create_notification', {
          p_user_id: conversation.assigned_to,
          p_title: 'Nova mensagem',
          p_message: `${lead.name}: ${content.substring(0, 100)}`,
          p_type: 'message',
          p_link: `/inbox?conversation=${conversation.id}`,
          p_data: { lead_id: lead.id, conversation_id: conversation.id },
        });
      } catch (notifError) {
        console.error('[whatsapp-webhook] Erro ao criar notificação:', notifError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message_id: message.id,
          conversation_id: conversation.id,
          lead_id: lead.id,
          provider,
        },
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[whatsapp-webhook] Erro não tratado:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
