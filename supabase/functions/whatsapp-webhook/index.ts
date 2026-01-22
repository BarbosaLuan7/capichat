import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================
// Imports from shared modules
// ============================================
import {
  WAHAMessage,
  corsHeaders,
  isGroupChat,
  isStatusBroadcast,
  isLID,
  normalizePhone,
  parseInternationalPhone,
  normalizePhoneForStorage,
  formatPhoneForDisplay,
  getPhoneWithCountryCode,
  getWAHAConfigBySession,
  extractRealPhoneFromPayload,
  resolvePhoneFromLID,
  getContactInfo,
  getProfilePictureWithReason,
  findLeadByPhone,
  findLeadByPhoneAndName,
  uploadMediaToStorage,
  isSystemNotification,
  getMessageContent,
  verifyWebhookSignature,
} from '../_shared/index.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read raw body for signature verification
    const rawBody = await req.text();

    // Get signature from various possible headers (different providers use different header names)
    const signature =
      req.headers.get('x-webhook-signature') ||
      req.headers.get('x-hub-signature-256') ||
      req.headers.get('x-signature') ||
      req.headers.get('x-waha-signature');

    // Get active WhatsApp config to retrieve webhook_secret
    const { data: activeConfig } = await supabase
      .from('whatsapp_config')
      .select('webhook_secret, provider')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    // Soft validation: log warning but allow processing (WAHA may not be sending signatures correctly)
    if (activeConfig?.webhook_secret) {
      const isValidSignature = await verifyWebhookSignature(
        rawBody,
        signature,
        activeConfig.webhook_secret
      );

      if (!isValidSignature) {
        // Soft validation: log warning but continue processing
        console.warn(
          '[whatsapp-webhook] Invalid or missing webhook signature - processing anyway (soft validation)'
        );
        console.warn(
          '[whatsapp-webhook] Signature received:',
          signature?.substring(0, 50) || 'none'
        );
        console.warn(
          '[whatsapp-webhook] Headers:',
          JSON.stringify(Object.fromEntries(req.headers.entries()))
        );

        // TODO: Em produção com WAHA configurado corretamente, descomentar para rejeitar:
        // return new Response(
        //   JSON.stringify({ error: 'Invalid webhook signature' }),
        //   { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        // );
      } else {
        console.log('[whatsapp-webhook] Webhook signature verified successfully');
      }
    } else {
      console.log(
        '[whatsapp-webhook] No webhook_secret configured - signature verification skipped'
      );
    }

    const body = JSON.parse(rawBody);
    console.log('[whatsapp-webhook] Recebido:', JSON.stringify(body).substring(0, 1000));

    // Detectar provider pelo formato do payload
    let provider: 'waha' | 'meta' = 'waha';
    let event = '';
    let messageData: WAHAMessage | null = null;
    let senderPhone = '';
    let senderName = '';
    let isFromMe = false;
    let externalMessageId = '';
    let isFromFacebookLid = false;
    let originalLid: string | null = null;

    // WAHA format
    if (body.event && body.session !== undefined) {
      provider = 'waha';
      event = body.event;

      // Log completo para debug
      console.log('[whatsapp-webhook] Payload WAHA completo:', JSON.stringify(body));

      // ========== WAHA: Evento de ACK (status delivered/read) ==========
      if (event === 'message.ack') {
        const payload = body.payload || {};
        // Extrair messageId - pode vir em vários formatos
        const rawMessageId = payload.id || payload.key?.id || payload.ids?.[0];
        const ackName = payload.ackName || payload.receipt_type || payload.ack;
        const ackNumber = payload.ack;

        console.log('[whatsapp-webhook] ACK recebido:', {
          messageId: rawMessageId,
          ackName,
          ackNumber,
          payload: JSON.stringify(payload),
        });

        let newStatus: 'delivered' | 'read' | null = null;

        // WAHA usa ackName: 'DEVICE' (entregue), 'READ' (lida), 'PLAYED' (áudio reproduzido)
        // Ou ack: 2 (delivered), 3 (read)
        if (['DEVICE', 'delivered', 'DELIVERY_ACK'].includes(ackName) || ackNumber === 2) {
          newStatus = 'delivered';
        } else if (['READ', 'read', 'PLAYED'].includes(ackName) || ackNumber === 3) {
          newStatus = 'read';
        }

        if (newStatus && rawMessageId) {
          // Extrair o ID curto se vier no formato serializado
          // "true_554599957851@c.us_3EB0725EB8EE5F6CC14B33" → "3EB0725EB8EE5F6CC14B33"
          let shortId: string | null = null;
          if (typeof rawMessageId === 'string' && rawMessageId.includes('_')) {
            const parts = rawMessageId.split('_');
            shortId = parts[parts.length - 1]; // Último segmento é o ID curto
          }

          console.log('[whatsapp-webhook] IDs para busca:', { rawMessageId, shortId });

          // Tentar match com ID curto primeiro (formato novo)
          let found = false;
          if (shortId) {
            const { data: shortMatch, error: shortError } = await supabase
              .from('messages')
              .update({ status: newStatus })
              .eq('external_id', shortId)
              .select('id');

            if (!shortError && shortMatch && shortMatch.length > 0) {
              console.log(
                '[whatsapp-webhook] Status atualizado (match shortId) para:',
                newStatus,
                'shortId:',
                shortId
              );
              found = true;
            }
          }

          // Tentar match exato com ID completo (serializado)
          if (!found) {
            const { data: exactMatch, error: exactError } = await supabase
              .from('messages')
              .update({ status: newStatus })
              .eq('external_id', rawMessageId)
              .select('id');

            if (!exactError && exactMatch && exactMatch.length > 0) {
              console.log(
                '[whatsapp-webhook] Status atualizado (match exato) para:',
                newStatus,
                'messageId:',
                rawMessageId
              );
              found = true;
            }
          }

          // Tentar busca parcial para formatos JSON antigos
          if (!found && shortId) {
            console.log('[whatsapp-webhook] Match exato não encontrou, tentando busca parcial...');

            const { data: partialMatch, error: partialError } = await supabase
              .from('messages')
              .update({ status: newStatus })
              .like('external_id', `%${shortId}%`)
              .select('id');

            if (!partialError && partialMatch && partialMatch.length > 0) {
              console.log(
                '[whatsapp-webhook] Status atualizado (match parcial) para:',
                newStatus,
                'encontradas:',
                partialMatch.length
              );
              found = true;
            }
          }

          // ========== CRIAR MENSAGEM OUTBOUND VIA ACK SE NÃO EXISTIR ==========
          if (!found && payload?.fromMe === true) {
            console.log(
              '[whatsapp-webhook] Mensagem outbound não existe no banco, tentando criar via ACK...'
            );

            try {
              // Extrair phone do destinatário (to)
              const toField = payload.to || payload.chatId || '';
              const toPhone = normalizePhone(toField);

              // ========== CORREÇÃO: Buscar lead pelo original_lid para LIDs ==========
              let resolvedToPhone = toPhone;
              let leadFromLid: { id: string; name: string; phone: string } | null = null;

              if (isLID(toField)) {
                const lidNumber = toField.replace('@lid', '').replace(/\D/g, '');
                console.log(
                  '[whatsapp-webhook] ACK para LID detectado, buscando lead pelo original_lid:',
                  lidNumber
                );

                // Buscar config para obter tenant_id
                const wahaConfigForLid = await getWAHAConfigBySession(
                  supabase,
                  body.session || 'default'
                );
                const tenantIdForLid = wahaConfigForLid?.tenantId;

                // Buscar lead pelo original_lid (com filtro de tenant se disponível)
                let leadByLidQuery = supabase
                  .from('leads')
                  .select('id, phone, name')
                  .eq('original_lid', lidNumber);

                if (tenantIdForLid) {
                  leadByLidQuery = leadByLidQuery.eq('tenant_id', tenantIdForLid);
                }

                const { data: existingLeadByLid, error: lidError } =
                  await leadByLidQuery.maybeSingle();

                if (lidError) {
                  console.error('[whatsapp-webhook] Erro ao buscar lead por LID no ACK:', lidError);
                }

                if (existingLeadByLid) {
                  console.log(
                    '[whatsapp-webhook] ✅ Lead encontrado pelo original_lid no ACK:',
                    existingLeadByLid.name,
                    existingLeadByLid.phone
                  );
                  resolvedToPhone = normalizePhone(existingLeadByLid.phone);
                  leadFromLid = existingLeadByLid;
                } else {
                  // Tentar resolver via API do WAHA
                  if (wahaConfigForLid) {
                    const resolvedPhone = await resolvePhoneFromLID(
                      wahaConfigForLid.baseUrl,
                      wahaConfigForLid.apiKey,
                      wahaConfigForLid.sessionName,
                      lidNumber
                    );
                    if (resolvedPhone) {
                      console.log(
                        '[whatsapp-webhook] ✅ LID resolvido via API no ACK:',
                        resolvedPhone
                      );
                      resolvedToPhone = normalizePhone(resolvedPhone);
                    } else {
                      console.log(
                        '[whatsapp-webhook] ⏭️ Ignorando ACK: LID não resolvido e sem lead associado:',
                        lidNumber
                      );
                      return new Response(
                        JSON.stringify({
                          success: true,
                          ignored: true,
                          reason: 'ack_for_unresolved_lid_no_lead',
                          lid: toField,
                        }),
                        {
                          status: 200,
                          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        }
                      );
                    }
                  } else {
                    console.log(
                      '[whatsapp-webhook] ⏭️ Ignorando ACK: LID sem config WAHA para resolver:',
                      lidNumber
                    );
                    return new Response(
                      JSON.stringify({
                        success: true,
                        ignored: true,
                        reason: 'ack_for_unresolved_lid_no_config',
                        lid: toField,
                      }),
                      {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                      }
                    );
                  }
                }
              }

              // ========== VALIDAÇÃO: Ignorar se destinatário for o próprio número do WhatsApp ==========
              const wahaConfigForAck = await getWAHAConfigBySession(
                supabase,
                body.session || 'default'
              );
              if (wahaConfigForAck) {
                const { data: whatsappConfigData } = await supabase
                  .from('whatsapp_config')
                  .select('phone_number')
                  .eq('id', wahaConfigForAck.instanceId)
                  .maybeSingle();

                if (whatsappConfigData?.phone_number) {
                  const ownPhone = whatsappConfigData.phone_number.replace(/\D/g, '');
                  const toPhoneDigits = resolvedToPhone.replace(/\D/g, '');
                  // Comparar últimos 10 dígitos (ignora código do país)
                  if (toPhoneDigits.slice(-10) === ownPhone.slice(-10)) {
                    console.log(
                      '[whatsapp-webhook] ⏭️ Ignorando: destinatário é o próprio número WhatsApp'
                    );
                    return new Response(
                      JSON.stringify({ success: true, ignored: true, reason: 'self_message_ack' }),
                      {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                      }
                    );
                  }
                }
              }

              // Usar lead já encontrado pelo LID ou buscar pelo phone
              let lead = leadFromLid;
              if (!lead && resolvedToPhone) {
                console.log('[whatsapp-webhook] Buscando lead pelo phone:', resolvedToPhone);
                lead = await findLeadByPhone(supabase, resolvedToPhone);
              }

              if (lead) {
                console.log('[whatsapp-webhook] Lead encontrado para ACK:', lead.id, lead.name);

                // Buscar ou criar conversa (filtrar por instância específica)
                const instanceId = wahaConfigForAck?.instanceId || null;
                let { data: conversation } = await supabase
                  .from('conversations')
                  .select('id')
                  .eq('lead_id', lead.id)
                  .eq('whatsapp_instance_id', instanceId)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (!conversation) {
                  const { data: newConv } = await supabase
                    .from('conversations')
                    .insert({
                      lead_id: lead.id,
                      status: 'open',
                      whatsapp_instance_id: instanceId,
                    })
                    .select('id')
                    .single();
                  conversation = newConv;
                  console.log(
                    '[whatsapp-webhook] Nova conversa criada para instância:',
                    instanceId,
                    '| conv:',
                    conversation?.id
                  );
                }

                if (conversation) {
                  // Extrair conteúdo da mensagem
                  const messageBody =
                    payload.body ||
                    (payload as any)._data?.body ||
                    (payload as any).text ||
                    (payload as any).caption ||
                    '';

                  // Detectar tipo de mensagem
                  let msgType:
                    | 'text'
                    | 'image'
                    | 'audio'
                    | 'video'
                    | 'document'
                    | 'sticker'
                    | 'location'
                    | 'contact' = 'text';
                  const rawType = (payload as any).type || (payload as any)._data?.type || '';
                  if (
                    rawType === 'image' ||
                    (payload.hasMedia && (payload as any).media?.mimetype?.startsWith('image'))
                  ) {
                    msgType = 'image';
                  } else if (rawType === 'ptt' || rawType === 'audio') {
                    msgType = 'audio';
                  } else if (rawType === 'video') {
                    msgType = 'video';
                  } else if (rawType === 'document') {
                    msgType = 'document';
                  } else if (rawType === 'sticker') {
                    msgType = 'sticker';
                  }

                  const finalContent = messageBody || (msgType !== 'text' ? `[${msgType}]` : '');

                  // Criar timestamp a partir do payload
                  const msgTimestamp = payload.timestamp
                    ? new Date(payload.timestamp * 1000).toISOString()
                    : new Date().toISOString();

                  // Verificar se mensagem já existe pelo waha_message_id antes de criar
                  const { data: existingMsgByWaha } = await supabase
                    .from('messages')
                    .select('id')
                    .eq('waha_message_id', shortId)
                    .maybeSingle();

                  if (existingMsgByWaha) {
                    console.log(
                      '[whatsapp-webhook] Mensagem já existe (waha_message_id), atualizando status apenas:',
                      existingMsgByWaha.id
                    );
                    // Apenas atualizar status se necessário
                    await supabase
                      .from('messages')
                      .update({ status: newStatus || 'sent' })
                      .eq('id', existingMsgByWaha.id);
                    found = true;
                  } else {
                    // Criar mensagem COM waha_message_id para prevenir duplicação
                    const { data: newMessage, error: insertError } = await supabase
                      .from('messages')
                      .insert({
                        conversation_id: conversation.id,
                        lead_id: lead.id,
                        sender_id: null, // Outbound do celular - sem sender_id
                        sender_type: 'agent',
                        content: finalContent,
                        type: msgType,
                        direction: 'outbound',
                        source: 'mobile',
                        external_id: rawMessageId,
                        waha_message_id: shortId, // Prevenir duplicação
                        status: newStatus || 'sent',
                        created_at: msgTimestamp,
                      })
                      .select('id')
                      .single();

                    if (insertError) {
                      console.error(
                        '[whatsapp-webhook] Erro ao criar mensagem via ACK:',
                        insertError
                      );
                    } else {
                      console.log(
                        '[whatsapp-webhook] ✅ Mensagem outbound criada via ACK:',
                        newMessage?.id
                      );
                      found = true;
                    }
                  }
                }
              } else {
                console.log('[whatsapp-webhook] Lead não encontrado para phone:', resolvedToPhone);
              }
            } catch (createError) {
              console.error(
                '[whatsapp-webhook] Erro ao tentar criar mensagem via ACK:',
                createError
              );
            }
          } else if (!found) {
            console.warn(
              '[whatsapp-webhook] Nenhuma mensagem encontrada para messageId:',
              rawMessageId,
              'shortId:',
              shortId
            );
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            event: 'ack',
            status: newStatus,
            messageId: rawMessageId,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Eventos de mensagem do WAHA
      if (event === 'message' || event === 'message.any') {
        const payload = body.payload as WAHAMessage & { _data?: any };

        // Processar TODAS as mensagens - tanto inbound quanto outbound
        // fromMe=true: enviada por nós (celular, CRM, bot)
        // fromMe=false: recebida do lead
        isFromMe = payload.fromMe || false;

        // ========== CORREÇÃO: Usar telefone correto baseado em fromMe ==========
        // Para mensagens outbound (fromMe=true): o lead é o DESTINATÁRIO (to)
        // Para mensagens inbound (fromMe=false): o lead é o REMETENTE (from)
        let rawContact: string;
        if (isFromMe) {
          // Mensagem ENVIADA por nós: o lead é o DESTINATÁRIO
          rawContact = payload.to || payload.chatId || '';
          console.log('[whatsapp-webhook] Mensagem OUTBOUND - destinatário:', rawContact);
        } else {
          // Mensagem RECEBIDA: o lead é o REMETENTE
          rawContact = payload.from || payload.chatId || '';
          console.log('[whatsapp-webhook] Mensagem INBOUND - remetente:', rawContact);
        }

        // ========== FILTRO DE GRUPOS - Ignorar mensagens de grupos ==========
        if (isGroupChat(rawContact)) {
          console.log('[whatsapp-webhook] Ignorando mensagem de grupo:', rawContact);
          return new Response(
            JSON.stringify({ success: true, ignored: true, reason: 'group_message' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ========== FILTRO DE STATUS/BROADCAST - Ignorar stories ==========
        if (isStatusBroadcast(rawContact)) {
          console.log('[whatsapp-webhook] Ignorando mensagem de status/broadcast:', rawContact);
          return new Response(
            JSON.stringify({ success: true, ignored: true, reason: 'status_broadcast' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        messageData = payload;
        externalMessageId = payload.id || '';

        // ========== LOG DE DEBUG DETALHADO ==========
        console.log('[whatsapp-webhook] ===== MENSAGEM RECEBIDA =====');
        console.log('[whatsapp-webhook] fromMe:', isFromMe);
        console.log('[whatsapp-webhook] external_id:', externalMessageId);
        console.log('[whatsapp-webhook] rawContact (from/to):', rawContact);
        console.log('[whatsapp-webhook] body preview:', (payload.body || '').substring(0, 50));
        console.log('[whatsapp-webhook] type:', payload.type);
        console.log('[whatsapp-webhook] hasMedia:', payload.hasMedia);
        console.log('[whatsapp-webhook] ==============================');

        // ========== Detectar LID e extrair número real ==========
        if (isLID(rawContact)) {
          console.log('[whatsapp-webhook] Detectado LID do Facebook, buscando número real...');
          isFromFacebookLid = true;
          originalLid = rawContact.replace('@lid', '').replace(/\D/g, '');

          // Primeiro tenta extrair do payload
          let realPhone = extractRealPhoneFromPayload(body.payload);

          // Se não conseguiu, tenta via API do WAHA
          if (!realPhone) {
            const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
            if (wahaConfig) {
              realPhone = await resolvePhoneFromLID(
                wahaConfig.baseUrl,
                wahaConfig.apiKey,
                wahaConfig.sessionName,
                rawContact
              );

              if (realPhone) {
                isFromFacebookLid = false; // Conseguimos o número real!
                console.log('[whatsapp-webhook] Número real resolvido via API WAHA:', realPhone);
              }
            } else {
              console.log('[whatsapp-webhook] Config WAHA não encontrada para resolver LID');
            }
          } else {
            isFromFacebookLid = false; // Conseguimos o número real do payload!
          }

          if (realPhone) {
            senderPhone = normalizePhone(realPhone);
          } else {
            // ========== CORREÇÃO: Buscar lead existente pelo original_lid para mensagens OUTBOUND ==========
            // Se é mensagem outbound (fromMe) e não conseguimos resolver o LID via API,
            // tentar buscar um lead existente pelo original_lid no banco de dados
            if (isFromMe) {
              const lidNumber = rawContact.replace('@lid', '').replace(/\D/g, '');
              console.log(
                '[whatsapp-webhook] Buscando lead existente pelo original_lid:',
                lidNumber
              );

              // Buscar config para obter tenant_id
              const wahaConfigForLid = await getWAHAConfigBySession(
                supabase,
                body.session || 'default'
              );
              const tenantIdForLid = wahaConfigForLid?.tenantId;

              // Buscar lead pelo original_lid (com filtro de tenant se disponível)
              let leadByLidQuery = supabase
                .from('leads')
                .select('id, phone, name, country_code')
                .eq('original_lid', lidNumber);

              if (tenantIdForLid) {
                leadByLidQuery = leadByLidQuery.eq('tenant_id', tenantIdForLid);
              }

              const { data: existingLeadByLid, error: lidError } =
                await leadByLidQuery.maybeSingle();

              if (lidError) {
                console.error('[whatsapp-webhook] Erro ao buscar lead por LID:', lidError);
              }

              if (existingLeadByLid) {
                // Lead encontrado! Usar o telefone real do lead
                console.log(
                  '[whatsapp-webhook] ✅ Lead encontrado pelo original_lid:',
                  existingLeadByLid.name,
                  existingLeadByLid.phone
                );
                senderPhone = normalizePhone(existingLeadByLid.phone);
                senderName = existingLeadByLid.name || '';
                isFromFacebookLid = true; // Marcar que veio de LID para manter consistência
              } else {
                // Não encontrou lead - agora sim ignorar para evitar criar lead incorreto
                console.log(
                  '[whatsapp-webhook] ⏭️ Ignorando outbound para LID sem lead associado:',
                  lidNumber
                );
                return new Response(
                  JSON.stringify({
                    success: true,
                    ignored: true,
                    reason: 'outbound_to_unresolved_lid_no_lead',
                    lid: rawContact,
                  }),
                  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }

            // Para mensagens inbound de LID não resolvido, continuar normalmente
            console.warn(
              '[whatsapp-webhook] Não foi possível extrair número real do LID, usando como identificador temporário'
            );
            senderPhone = originalLid || normalizePhone(rawContact);
          }
        } else {
          senderPhone = normalizePhone(rawContact);
        }

        // ========== PROTEÇÃO: Ignorar self-messages (mensagens para o próprio número da instância) ==========
        // Isso evita criar leads com o número do WhatsApp Business
        const wahaConfigForSelfCheck = await getWAHAConfigBySession(
          supabase,
          body.session || 'default'
        );
        if (wahaConfigForSelfCheck) {
          const { data: instancePhoneData } = await supabase
            .from('whatsapp_config')
            .select('phone_number')
            .eq('id', wahaConfigForSelfCheck.instanceId)
            .maybeSingle();

          if (instancePhoneData?.phone_number) {
            const instancePhone = instancePhoneData.phone_number.replace(/\D/g, '');
            const senderPhoneDigits = senderPhone.replace(/\D/g, '');

            // Comparar últimos 10 dígitos (ignora código do país)
            if (senderPhoneDigits.slice(-10) === instancePhone.slice(-10)) {
              console.log(
                '[whatsapp-webhook] ⏭️ Ignorando self-message: telefone é o próprio número da instância:',
                senderPhone
              );
              return new Response(
                JSON.stringify({
                  success: true,
                  ignored: true,
                  reason: 'self_message',
                  phone: senderPhone,
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }

        // ========== EXTRAÇÃO DO NOME DO CONTATO ==========
        // Para mensagens OUTBOUND (fromMe=true): pushName é o NOSSO nome, não do destinatário
        // Precisamos buscar o nome do destinatário via API
        if (isFromMe) {
          // Mensagem enviada por nós - buscar nome do DESTINATÁRIO via API
          console.log(
            '[whatsapp-webhook] Mensagem outbound - buscando nome do destinatário via API...'
          );

          const wahaConfigForContact = await getWAHAConfigBySession(
            supabase,
            body.session || 'default'
          );
          if (wahaConfigForContact) {
            // Buscar lead existente para obter country_code
            const existingLeadForContact = await findLeadByPhone(supabase, senderPhone);
            const phoneWithCountry = getPhoneWithCountryCode(
              senderPhone,
              existingLeadForContact?.country_code
            );

            console.log('[whatsapp-webhook] Buscando contato para:', phoneWithCountry);

            const contactInfo = await getContactInfo(
              wahaConfigForContact.baseUrl,
              wahaConfigForContact.apiKey,
              wahaConfigForContact.sessionName,
              phoneWithCountry
            );

            // Prioridade: nome salvo nos contatos > pushname do WhatsApp
            senderName = contactInfo.name || contactInfo.pushname || '';
            console.log('[whatsapp-webhook] Nome do destinatário obtido via API:', senderName);
          } else {
            senderName = '';
            console.log(
              '[whatsapp-webhook] Config WAHA não encontrada para buscar nome do destinatário'
            );
          }
        } else {
          // Mensagem recebida - usar pushName do payload normalmente
          senderName =
            payload.pushName ||
            (body.payload as any)?._data?.pushName ||
            (body.payload as any)?._data?.notifyName ||
            body.pushName ||
            (body.payload as any)?.chat?.contact?.pushname ||
            (body.payload as any)?.sender?.pushName ||
            '';
        }

        console.log(
          '[whatsapp-webhook] Nome extraído:',
          senderName,
          'phone normalizado:',
          senderPhone,
          'isLID:',
          isFromFacebookLid,
          'isFromMe:',
          isFromMe
        );
      } else {
        console.log('[whatsapp-webhook] Evento não processado:', event);
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: 'event not handled', event }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Meta Cloud API format (webhook verification e messages)
    else if (body.object === 'whatsapp_business_account' && body.entry) {
      provider = 'meta';

      // Processar cada entry do webhook Meta
      for (const entry of body.entry as MetaWebhookEntry[]) {
        for (const change of entry.changes) {
          if (change.field !== 'messages') continue;

          const value = change.value;

          // ========== Meta: Status updates ==========
          if (value.statuses && value.statuses.length > 0) {
            for (const statusUpdate of value.statuses) {
              const messageId = statusUpdate.id;
              const status = statusUpdate.status;

              console.log('[whatsapp-webhook] Meta status update:', { messageId, status });

              let newStatus: 'delivered' | 'read' | null = null;
              if (status === 'delivered') {
                newStatus = 'delivered';
              } else if (status === 'read') {
                newStatus = 'read';
              }

              if (newStatus && messageId) {
                const { error: updateError } = await supabase
                  .from('messages')
                  .update({ status: newStatus })
                  .eq('external_id', messageId);

                if (updateError) {
                  console.error('[whatsapp-webhook] Erro ao atualizar status Meta:', updateError);
                } else {
                  console.log(
                    '[whatsapp-webhook] Status Meta atualizado para:',
                    newStatus,
                    'messageId:',
                    messageId
                  );
                }
              }
            }

            return new Response(
              JSON.stringify({ success: true, event: 'status_update', provider: 'meta' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // ========== Meta: Mensagens recebidas ==========
          if (value.messages && value.messages.length > 0) {
            const metaMsg = value.messages[0];
            const contact = value.contacts?.[0];

            event = 'message';
            externalMessageId = metaMsg.id;
            senderPhone = normalizePhone(metaMsg.from);
            senderName = contact?.profile?.name || '';
            isFromMe = false; // Meta webhook só recebe mensagens inbound

            // Converter para formato WAHAMessage para compatibilidade
            let msgBody = '';
            let msgType: 'chat' | 'image' | 'audio' | 'video' | 'document' | 'ptt' = 'chat';
            let mediaUrl: string | undefined;

            if (metaMsg.type === 'text' && metaMsg.text) {
              msgBody = metaMsg.text.body;
              msgType = 'chat';
            } else if (metaMsg.type === 'image' && metaMsg.image) {
              msgBody = metaMsg.image.caption || '';
              msgType = 'image';
              // Media URL precisa ser baixada via API Meta (media_id)
            } else if (metaMsg.type === 'audio' && metaMsg.audio) {
              msgType = 'audio';
            } else if (metaMsg.type === 'video' && metaMsg.video) {
              msgBody = metaMsg.video.caption || '';
              msgType = 'video';
            } else if (metaMsg.type === 'document' && metaMsg.document) {
              msgBody = metaMsg.document.caption || '';
              msgType = 'document';
            }

            messageData = {
              id: metaMsg.id,
              timestamp: parseInt(metaMsg.timestamp),
              from: metaMsg.from,
              to: value.metadata.phone_number_id,
              body: msgBody,
              hasMedia: ['image', 'audio', 'video', 'document'].includes(metaMsg.type),
              mediaUrl,
              type: msgType,
              fromMe: false,
              pushName: senderName,
            };

            console.log('[whatsapp-webhook] Meta mensagem recebida:', {
              from: senderPhone,
              name: senderName,
              type: msgType,
            });
          }
        }
      }

      if (!messageData) {
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: 'no_messages_in_payload' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Formato desconhecido
    else {
      console.log('[whatsapp-webhook] Formato de payload desconhecido');
      return new Response(JSON.stringify({ success: false, error: 'Unknown payload format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!messageData || !senderPhone) {
      console.log('[whatsapp-webhook] Dados inválidos:', {
        messageData: !!messageData,
        senderPhone,
      });
      return new Response(JSON.stringify({ success: false, error: 'Invalid message data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== CORREÇÃO DEFINITIVA: Verificar por waha_message_id (UNIQUE no banco) ==========
    // Calcular waha_message_id canônico a partir do external_id
    let wahaMessageId: string | null = null;
    if (externalMessageId) {
      // Extrair o ID curto (último segmento após underscore) que é único por mensagem WAHA
      // Formato: "true_554599957851@c.us_3EB0725EB8EE5F6CC14B33" → "3EB0725EB8EE5F6CC14B33"
      // Ou formato curto: "3EB0725EB8EE5F6CC14B33" → "3EB0725EB8EE5F6CC14B33"
      if (typeof externalMessageId === 'string' && externalMessageId.includes('_')) {
        const parts = externalMessageId.split('_');
        wahaMessageId = parts[parts.length - 1];
      } else {
        wahaMessageId = externalMessageId;
      }

      console.log(
        '[whatsapp-webhook] 🔑 waha_message_id calculado:',
        wahaMessageId,
        '| original external_id:',
        externalMessageId
      );

      // ========== CORREÇÃO: Verificar duplicata usando AMBOS os formatos (curto e completo) ==========
      // O CRM salva no formato completo (true_554591570202@c.us_3EB...) mas o webhook extrai só o ID curto (3EB...)
      // Precisamos verificar ambos para evitar duplicação
      const { data: existingByWahaId } = await supabase
        .from('messages')
        .select('id, waha_message_id, media_url, type, conversation_id')
        .or(`waha_message_id.eq.${wahaMessageId},waha_message_id.eq.${externalMessageId}`)
        .limit(1)
        .maybeSingle();

      if (existingByWahaId) {
        // ========== CORREÇÃO CRÍTICA: Se a mensagem existe mas NÃO tem media_url, verificar se este evento tem mídia ==========
        // WAHA envia primeiro message.ack (sem mídia) e depois message.any (com mídia)
        // O primeiro evento cria a mensagem sem media_url, o segundo deve atualizar
        const isMediaType =
          existingByWahaId.type &&
          ['image', 'audio', 'video', 'document'].includes(existingByWahaId.type);

        if (isMediaType && !existingByWahaId.media_url) {
          console.log(
            '[whatsapp-webhook] 📎 Mensagem de mídia existente sem media_url, tentando extrair mídia deste evento...'
          );

          // Extrair mídia deste evento
          const { mediaUrl: eventMediaUrl, type: eventType } = getMessageContent(
            messageData,
            provider
          );

          if (eventMediaUrl) {
            console.log('[whatsapp-webhook] 📎 Mídia encontrada neste evento, fazendo upload...');

            // Buscar lead e config para fazer upload
            const existingLead = await findLeadByPhone(supabase, senderPhone);
            const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');

            if (existingLead && wahaConfig) {
              try {
                const finalMediaUrl = await uploadMediaToStorage(
                  supabase,
                  eventMediaUrl,
                  eventType,
                  existingLead.id,
                  wahaConfig
                );

                if (finalMediaUrl) {
                  const { error: updateError } = await supabase
                    .from('messages')
                    .update({ media_url: finalMediaUrl })
                    .eq('id', existingByWahaId.id);

                  if (updateError) {
                    console.error(
                      '[whatsapp-webhook] ❌ Erro ao atualizar media_url:',
                      updateError
                    );
                  } else {
                    console.log(
                      '[whatsapp-webhook] ✅ media_url atualizado com sucesso:',
                      finalMediaUrl.substring(0, 50)
                    );
                  }
                }
              } catch (uploadError) {
                console.error('[whatsapp-webhook] ❌ Erro no upload de mídia:', uploadError);
              }
            } else {
              console.log(
                '[whatsapp-webhook] ⚠️ Não foi possível fazer upload: lead ou config não encontrados'
              );
            }
          } else {
            console.log(
              '[whatsapp-webhook] 📎 Nenhuma mídia neste evento para atualizar mensagem existente'
            );
          }
        }

        console.log(
          '[whatsapp-webhook] ⏭️ Mensagem já processada (waha_message_id):',
          wahaMessageId,
          'ou',
          externalMessageId,
          '| matched:',
          existingByWahaId.waha_message_id
        );
        return new Response(
          JSON.stringify({
            success: true,
            duplicate: true,
            existing_message_id: existingByWahaId.id,
            matched_by: 'waha_message_id',
            matched_value: existingByWahaId.waha_message_id,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('[whatsapp-webhook] Processando mensagem de:', senderPhone, 'Nome:', senderName);

    // Extrair conteúdo da mensagem
    const { content, type, mediaUrl, isSystemMessage } = getMessageContent(messageData, provider);

    // Ignorar notificações do sistema
    if (isSystemMessage) {
      console.log('[whatsapp-webhook] Ignorando notificação do sistema');
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: 'system_notification' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== CORREÇÃO: Validar conteúdo da mensagem ==========
    // Ignorar mensagens com conteúdo inválido/placeholder
    const invalidContents = [
      '[text]',
      '[Text]',
      '[TEXT]',
      '[media]',
      '[Media]',
      '[MEDIA]',
      '[Mídia]',
    ];
    if (!content && !mediaUrl) {
      console.log('[whatsapp-webhook] Ignorando mensagem sem conteúdo e sem mídia');
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: 'empty_message' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (content && invalidContents.includes(content)) {
      console.log('[whatsapp-webhook] Ignorando mensagem com placeholder inválido:', content);
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: 'placeholder_content' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      '[whatsapp-webhook] Conteúdo:',
      content.substring(0, 100),
      'Tipo:',
      type,
      'MediaUrl:',
      mediaUrl ? 'presente' : 'nenhum'
    );

    // ========== BUSCA FLEXÍVEL DE LEAD POR TELEFONE ==========
    // Encontra lead mesmo com formato diferente (com/sem 55, com/sem 9° dígito)
    let existingLead = await findLeadByPhone(supabase, senderPhone);

    // Fallback: se não encontrou por telefone, tentar por telefone + nome
    if (!existingLead && senderName) {
      console.log(
        '[whatsapp-webhook] Lead não encontrado por telefone, tentando por nome + telefone...'
      );
      existingLead = await findLeadByPhoneAndName(supabase, senderPhone, senderName);
    }

    let lead;

    if (existingLead) {
      lead = existingLead;
      console.log('[whatsapp-webhook] Lead encontrado:', lead.id, '| nome:', lead.name);

      // Atualizar dados do lead
      const updateData: Record<string, unknown> = {
        last_interaction_at: new Date().toISOString(),
      };

      // Sempre atualizar whatsapp_name se receber um novo (pessoa pode mudar nome no WhatsApp)
      if (senderName) {
        updateData.whatsapp_name = senderName;

        // Se o nome ainda é genérico, atualizar para o NotifyName real
        const isGenericName =
          existingLead.name.startsWith('Lead ') ||
          existingLead.name.includes('via anúncio') ||
          existingLead.name.includes('(via anúncio)');

        if (isGenericName) {
          updateData.name = senderName;
          console.log('[whatsapp-webhook] Atualizando nome genérico para NotifyName:', senderName);
        }
      }

      // Se o lead existente era um LID e agora recebemos o número real, atualizar flag
      if (existingLead.is_facebook_lid && !isFromFacebookLid) {
        updateData.is_facebook_lid = false;
        console.log('[whatsapp-webhook] Atualizando lead LID com número real');
      }

      // Buscar foto de perfil se ainda não tiver
      // CORREÇÃO: Para leads LID, usar o original_lid com @lid para buscar foto
      if (!existingLead.avatar_url) {
        console.log('[whatsapp-webhook] 📷 Lead existente sem avatar, tentando buscar...');
        const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
        if (wahaConfig) {
          // Se é lead LID, usar o original_lid com sufixo @lid
          // Senão, usar número com código do país
          let contactIdForAvatar: string;
          let isLidRequest = false;

          if (isFromFacebookLid && originalLid) {
            contactIdForAvatar = `${originalLid}@lid`;
            isLidRequest = true;
            console.log('[whatsapp-webhook] 📷 Buscando avatar via LID:', contactIdForAvatar);
          } else if (existingLead.original_lid && existingLead.is_facebook_lid) {
            contactIdForAvatar = `${existingLead.original_lid}@lid`;
            isLidRequest = true;
            console.log(
              '[whatsapp-webhook] 📷 Buscando avatar via LID existente:',
              contactIdForAvatar
            );
          } else {
            contactIdForAvatar = getPhoneWithCountryCode(senderPhone, existingLead.country_code);
            console.log('[whatsapp-webhook] 📷 Buscando avatar via telefone:', contactIdForAvatar);
          }

          const avatarResult = await getProfilePictureWithReason(
            wahaConfig.baseUrl,
            wahaConfig.apiKey,
            wahaConfig.sessionName,
            contactIdForAvatar,
            isLidRequest
          );

          if (avatarResult.url) {
            updateData.avatar_url = avatarResult.url;
            console.log('[whatsapp-webhook] 📷 Avatar atualizado para lead existente');
          } else {
            // Agendar retry se não encontrou foto (pode ser delay do WhatsApp)
            console.log('[whatsapp-webhook] 📷 Avatar não encontrado, agendando retry...');
            await supabase.from('automation_queue').insert({
              event: 'avatar_retry',
              payload: {
                lead_id: existingLead.id,
                contact_id: contactIdForAvatar,
                is_lid: isLidRequest,
                session: wahaConfig.sessionName,
                instance_id: wahaConfig.instanceId,
                attempt: 1,
                reason: avatarResult.reason,
              },
            });
          }
        }
      }

      // Se lead existe mas nome é genérico e não temos nome do WhatsApp, tentar buscar via API
      if (
        !senderName &&
        (existingLead.name.startsWith('Lead ') || existingLead.name.includes('via anúncio'))
      ) {
        console.log('[whatsapp-webhook] 📇 Lead com nome genérico, tentando buscar nome real...');
        const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
        if (wahaConfig) {
          const phoneWithCountry = getPhoneWithCountryCode(senderPhone, existingLead.country_code);
          const contactInfo = await getContactInfo(
            wahaConfig.baseUrl,
            wahaConfig.apiKey,
            wahaConfig.sessionName,
            phoneWithCountry
          );
          if (contactInfo.pushname || contactInfo.name) {
            const newName = contactInfo.name || contactInfo.pushname;
            updateData.whatsapp_name = contactInfo.pushname || contactInfo.name;
            updateData.name = newName;
            console.log('[whatsapp-webhook] 📇 Nome atualizado via API:', newName);
          }
        }
      }

      await supabase.from('leads').update(updateData).eq('id', lead.id);
    } else {
      // Criar novo lead com upsert (proteção adicional contra race condition)
      console.log('[whatsapp-webhook] Criando novo lead para:', senderPhone);

      // Buscar config do WAHA para obter tenant_id
      const wahaConfigForLead = await getWAHAConfigBySession(supabase, body.session || 'default');
      const tenantIdForLead = wahaConfigForLead?.tenantId || null;
      console.log('[whatsapp-webhook] Tenant ID para novo lead:', tenantIdForLead);

      const { data: firstStage } = await supabase
        .from('funnel_stages')
        .select('id')
        .order('order', { ascending: true })
        .limit(1)
        .maybeSingle();

      // Ajustar nome para leads via anúncio (Facebook LID)
      // Para LIDs, usamos o whatsapp_name se disponível, senão criamos identificador temporário
      let leadName = senderName || `Lead ${formatPhoneForDisplay(senderPhone)}`;
      let internalNoteForLid: string | null = null;

      if (isFromFacebookLid) {
        if (senderName) {
          leadName = senderName; // Usar nome real sem "(via anúncio)" - menos poluição visual
        } else {
          leadName = `Lead Facebook ${originalLid?.slice(-6) || Date.now().toString().slice(-6)}`;
        }
        // Nota interna explicando situação do LID
        internalNoteForLid = `⚠️ Número Privado (Facebook Ads)\n\nEste contato veio de um anúncio Click-to-WhatsApp. O número de telefone real ainda não está disponível por questões de privacidade do Facebook.\n\nLID: ${originalLid}\n\nO sistema tentará resolver o número automaticamente. Enquanto isso, você pode conversar normalmente com o cliente.`;
      }

      // Buscar foto de perfil para novo lead
      // CORREÇÃO: Para leads LID, usar o original_lid com @lid para buscar foto
      let avatarUrl: string | null = null;
      let shouldScheduleAvatarRetry = false;
      let avatarRetryData: {
        contact_id: string;
        is_lid: boolean;
        session: string;
        instance_id: string;
        reason?: string;
      } | null = null;

      if (wahaConfigForLead) {
        // Se é lead LID, usar o original_lid com sufixo @lid
        // Senão, usar número com código do país
        let contactIdForAvatar: string;
        let isLidRequest = false;

        if (isFromFacebookLid && originalLid) {
          contactIdForAvatar = `${originalLid}@lid`;
          isLidRequest = true;
          console.log(
            '[whatsapp-webhook] 📷 Buscando avatar para novo lead via LID:',
            contactIdForAvatar
          );
        } else {
          contactIdForAvatar = getPhoneWithCountryCode(senderPhone);
          console.log(
            '[whatsapp-webhook] 📷 Buscando avatar para novo lead via telefone:',
            contactIdForAvatar
          );
        }

        const avatarResult = await getProfilePictureWithReason(
          wahaConfigForLead.baseUrl,
          wahaConfigForLead.apiKey,
          wahaConfigForLead.sessionName,
          contactIdForAvatar,
          isLidRequest
        );

        if (avatarResult.url) {
          avatarUrl = avatarResult.url;
          console.log('[whatsapp-webhook] ✅ Avatar encontrado para novo lead');
        } else {
          // Marcar para agendar retry após criar o lead
          shouldScheduleAvatarRetry = true;
          avatarRetryData = {
            contact_id: contactIdForAvatar,
            is_lid: isLidRequest,
            session: wahaConfigForLead.sessionName,
            instance_id: wahaConfigForLead.instanceId,
            reason: avatarResult.reason,
          };
          console.log(
            '[whatsapp-webhook] 📷 Avatar não encontrado, será agendado retry após criar lead'
          );
        }
      }

      // Normalizar telefone separando código do país
      const phoneData = normalizePhoneForStorage(senderPhone);
      console.log(
        '[whatsapp-webhook] Normalizando telefone para salvar:',
        senderPhone,
        '->',
        phoneData
      );

      // Para leads LID, usar o original_lid como phone temporário (garantir unicidade)
      // Isso evita conflitos já que cada LID é único
      const phoneForDb = isFromFacebookLid ? `LID_${originalLid}` : phoneData.localNumber;

      const { data: upsertedLead, error: upsertError } = await supabase
        .from('leads')
        .upsert(
          {
            name: leadName,
            phone: phoneForDb, // Para LID: "LID_174621106159626", para normal: "45988428644"
            country_code: isFromFacebookLid ? null : phoneData.countryCode, // LIDs não têm código de país
            whatsapp_name: senderName || null,
            source: isFromFacebookLid ? 'facebook_ads' : 'whatsapp',
            temperature: 'warm',
            stage_id: firstStage?.id,
            status: 'active',
            last_interaction_at: new Date().toISOString(),
            is_facebook_lid: isFromFacebookLid,
            original_lid: originalLid,
            avatar_url: avatarUrl,
            tenant_id: tenantIdForLead,
            internal_notes: internalNoteForLid, // Nota explicando situação do LID
          },
          {
            onConflict: 'phone',
            ignoreDuplicates: false,
          }
        )
        .select('*')
        .single();

      if (upsertError) {
        console.error('[whatsapp-webhook] Erro ao criar/upsert lead:', upsertError);

        // Se falhou por conflito, tentar buscar o existente usando busca flexível
        if (upsertError.code === '23505') {
          const conflictLead = await findLeadByPhone(supabase, senderPhone);

          if (conflictLead) {
            lead = conflictLead;
            console.log('[whatsapp-webhook] Lead encontrado após conflito:', lead.id);
          } else {
            return new Response(
              JSON.stringify({ success: false, error: 'Error handling lead conflict' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          return new Response(JSON.stringify({ success: false, error: 'Error creating lead' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        lead = upsertedLead;
        console.log('[whatsapp-webhook] Lead criado/atualizado:', lead.id);

        // Agendar retry de avatar se necessário (após ter o lead_id)
        if (shouldScheduleAvatarRetry && avatarRetryData && lead.id) {
          console.log('[whatsapp-webhook] 📷 Agendando retry de avatar para novo lead:', lead.id);
          await supabase.from('automation_queue').insert({
            event: 'avatar_retry',
            payload: {
              lead_id: lead.id,
              contact_id: avatarRetryData.contact_id,
              is_lid: avatarRetryData.is_lid,
              session: avatarRetryData.session,
              instance_id: avatarRetryData.instance_id,
              attempt: 1,
              reason: avatarRetryData.reason,
            },
          });
        }
      }
    }

    // Buscar ou criar conversa (sem upsert - evita erro 42P10)
    let conversation;
    const wahaConfig = await getWAHAConfigBySession(supabase, body.session || 'default');
    const whatsappInstanceId = wahaConfig?.instanceId || null;

    console.log(
      '[whatsapp-webhook] Buscando conversa para lead:',
      lead.id,
      'instância:',
      whatsappInstanceId
    );

    // Buscar conversa existente com match exato (lead_id + whatsapp_instance_id)
    // IMPORTANTE: Cada instância WhatsApp = canal separado, então NÃO usar fallback
    // Se o lead manda msg pelo número 8066, deve ter conversa separada do número 7851
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', lead.id)
      .eq('whatsapp_instance_id', whatsappInstanceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Se não encontrou conversa para esta instância específica, será criada uma nova
    // NÃO fazer fallback para conversa de outra instância - são canais separados

    if (existingConversation) {
      conversation = existingConversation;
      console.log(
        '[whatsapp-webhook] ✅ Conversa encontrada:',
        conversation.id,
        'status:',
        conversation.status
      );

      // Reabrir conversa se estava 'resolved' ou 'pending' e é mensagem INBOUND
      if (!isFromMe && (conversation.status === 'resolved' || conversation.status === 'pending')) {
        console.log('[whatsapp-webhook] Reabrindo conversa:', conversation.id);
        await supabase.from('conversations').update({ status: 'open' }).eq('id', conversation.id);
      }

      // Atualizar whatsapp_instance_id se ainda não estava definido
      if (!conversation.whatsapp_instance_id && whatsappInstanceId) {
        await supabase
          .from('conversations')
          .update({ whatsapp_instance_id: whatsappInstanceId })
          .eq('id', conversation.id);
      }
    } else {
      // 3. Criar nova conversa (insert simples, sem upsert)
      console.log('[whatsapp-webhook] Criando nova conversa para lead:', lead.id);

      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          lead_id: lead.id,
          status: 'open',
          assigned_to: lead.assigned_to,
          whatsapp_instance_id: whatsappInstanceId,
        })
        .select('*')
        .single();

      if (createConvError) {
        // Race condition: outra requisição pode ter criado a conversa para ESTA instância
        console.log(
          '[whatsapp-webhook] ⚠️ Erro ao criar conversa, buscando existente para mesma instância:',
          createConvError.code,
          createConvError.message
        );

        const { data: fallbackConv } = await supabase
          .from('conversations')
          .select('*')
          .eq('lead_id', lead.id)
          .eq('whatsapp_instance_id', whatsappInstanceId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackConv) {
          conversation = fallbackConv;
          console.log(
            '[whatsapp-webhook] ✅ Conversa encontrada após fallback (mesma instância):',
            conversation.id
          );
        } else {
          console.error('[whatsapp-webhook] ❌ Erro ao criar conversa:', createConvError);
          return new Response(
            JSON.stringify({ success: false, error: 'Error creating conversation' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        conversation = newConversation;
        console.log(
          '[whatsapp-webhook] ✅ Conversa criada:',
          conversation.id,
          'whatsapp_instance_id:',
          whatsappInstanceId
        );
      }
    }

    // ========== CORREÇÃO: Se é mídia mas não veio URL, buscar via WAHA API ou usar base64 ==========
    let finalMediaUrl = mediaUrl;

    // Buscar config do WAHA antecipadamente (pode ser usada para buscar mídia ou fazer upload)
    const wahaConfigForMedia = await getWAHAConfigBySession(supabase, body.session || 'default');

    // ========== TRATAMENTO DE BASE64 DIRETO DO PAYLOAD ==========
    // Se tem base64 no payload mas não tem URL, fazer upload direto
    const base64Data =
      (messageData as any)?._data?.media?.data ||
      (messageData as any)?.media?.data ||
      (messageData as any)?.mediaData ||
      (messageData as any)?._data?.body; // Alguns casos o base64 vem no body

    const base64Mimetype =
      (messageData as any)?._data?.media?.mimetype ||
      (messageData as any)?.media?.mimetype ||
      (messageData as any)?._data?.mimetype ||
      '';

    // Função auxiliar para detectar base64
    const isValidBase64 = (str: string): boolean => {
      if (!str || typeof str !== 'string' || str.length < 100) return false;
      // Padrões comuns de início de base64
      const base64Patterns = ['/9j/', 'iVBOR', 'R0lGOD', 'UklGR', 'AAAA', 'GkXf', 'T2dn'];
      return (
        base64Patterns.some((p) => str.startsWith(p)) ||
        (str.length > 500 && !str.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(str.substring(0, 100)))
      );
    };

    // Se é mídia sem URL mas tem base64 no payload
    if (!mediaUrl && type !== 'text' && base64Data && isValidBase64(base64Data)) {
      console.log('[whatsapp-webhook] 📁 Base64 encontrado no payload, fazendo upload direto...');
      console.log(
        '[whatsapp-webhook] 📁 Base64 length:',
        base64Data.length,
        'mimetype:',
        base64Mimetype
      );

      try {
        // Converter base64 para ArrayBuffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Determinar extensão pelo mimetype ou tipo
        const extensionMap: Record<string, string> = {
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

        let extension = extensionMap[base64Mimetype];
        if (!extension) {
          const typeExtMap: Record<string, string> = {
            image: 'jpg',
            audio: 'ogg',
            video: 'mp4',
            document: 'bin',
          };
          extension = typeExtMap[type] || 'bin';
        }

        const fileName = `leads/${lead.id}/${Date.now()}.${extension}`;
        const contentType = base64Mimetype || 'application/octet-stream';

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(fileName, bytes.buffer, {
            contentType,
            cacheControl: '31536000',
            upsert: false,
          });

        if (uploadError) {
          console.error('[whatsapp-webhook] ❌ Erro upload base64:', uploadError);
        } else {
          finalMediaUrl = `storage://message-attachments/${uploadData.path}`;
          console.log('[whatsapp-webhook] ✅ Base64 convertido e salvo:', finalMediaUrl);
        }
      } catch (b64Error) {
        console.error('[whatsapp-webhook] ❌ Erro ao processar base64:', b64Error);
      }
    }

    // Se AINDA não tem mídia e é mídia, tentar buscar via WAHA API
    if (!finalMediaUrl && type !== 'text' && wahaConfigForMedia && externalMessageId) {
      console.log('[whatsapp-webhook] 📁 Mídia sem URL/base64, tentando buscar via WAHA API...');

      // Extrair chatId e messageId para a chamada
      const rawContact = isFromMe
        ? (messageData as WAHAMessage)?.to || (messageData as WAHAMessage)?.chatId
        : (messageData as WAHAMessage)?.from || (messageData as WAHAMessage)?.chatId;

      if (rawContact) {
        try {
          // GET /api/{session}/chats/{chatId}/messages/{messageId}?downloadMedia=true
          const cleanChatId = rawContact.includes('@') ? rawContact : `${rawContact}@c.us`;
          // IMPORTANTE: usar externalMessageId completo (ex: true_554599889851@c.us_3EB0...)
          const url = `${wahaConfigForMedia.baseUrl}/api/${wahaConfigForMedia.sessionName}/chats/${cleanChatId}/messages/${externalMessageId}?downloadMedia=true`;

          console.log('[whatsapp-webhook] 📁 Chamando WAHA para obter mídia:', url);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

          const mediaResponse = await fetch(url, {
            method: 'GET',
            headers: {
              'X-Api-Key': wahaConfigForMedia.apiKey,
              Authorization: `Bearer ${wahaConfigForMedia.apiKey}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (mediaResponse.ok) {
            const fetchedMediaData = await mediaResponse.json();
            console.log(
              '[whatsapp-webhook] 📁 Resposta WAHA mídia:',
              JSON.stringify(fetchedMediaData).substring(0, 500)
            );

            // Extrair URL de mídia do resultado
            const fetchedMediaUrl =
              fetchedMediaData?.media?.url ||
              fetchedMediaData?.mediaUrl ||
              fetchedMediaData?._data?.media?.url ||
              fetchedMediaData?._data?.deprecatedMms3Url;

            // Também checar se veio base64 na resposta da API
            const fetchedBase64 =
              fetchedMediaData?.media?.data || fetchedMediaData?._data?.media?.data;

            if (fetchedMediaUrl) {
              console.log(
                '[whatsapp-webhook] 📁 URL de mídia recuperada via API:',
                fetchedMediaUrl.substring(0, 100)
              );
              finalMediaUrl = fetchedMediaUrl;
            } else if (fetchedBase64 && isValidBase64(fetchedBase64)) {
              console.log('[whatsapp-webhook] 📁 Base64 recuperado via API, fazendo upload...');
              // Fazer upload do base64 obtido via API
              try {
                const binaryString = atob(fetchedBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }

                const fetchedMimetype =
                  fetchedMediaData?.media?.mimetype ||
                  fetchedMediaData?._data?.media?.mimetype ||
                  '';
                const extMap: Record<string, string> = {
                  image: 'jpg',
                  audio: 'ogg',
                  video: 'mp4',
                  document: 'bin',
                };
                const ext = extMap[type] || 'bin';
                const fileName = `leads/${lead.id}/${Date.now()}.${ext}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('message-attachments')
                  .upload(fileName, bytes.buffer, {
                    contentType: fetchedMimetype || 'application/octet-stream',
                    cacheControl: '31536000',
                    upsert: false,
                  });

                if (!uploadError && uploadData) {
                  finalMediaUrl = `storage://message-attachments/${uploadData.path}`;
                  console.log(
                    '[whatsapp-webhook] ✅ Base64 da API convertido e salvo:',
                    finalMediaUrl
                  );
                }
              } catch (apiB64Error) {
                console.error(
                  '[whatsapp-webhook] ❌ Erro ao processar base64 da API:',
                  apiB64Error
                );
              }
            } else {
              console.log(
                '[whatsapp-webhook] ⚠️ WAHA retornou mas sem media.url nem base64 válido'
              );
            }
          } else {
            console.log('[whatsapp-webhook] ⚠️ WAHA API retornou erro:', mediaResponse.status);
          }
        } catch (fetchError) {
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            console.log('[whatsapp-webhook] ⚠️ Timeout ao buscar mídia via WAHA API');
          } else {
            console.error('[whatsapp-webhook] ⚠️ Erro ao buscar mídia via WAHA API:', fetchError);
          }
        }
      }
    }

    // Se tiver mídia (original ou recuperada), fazer upload para o storage permanente
    if (finalMediaUrl && type !== 'text') {
      console.log('[whatsapp-webhook] 📁 Processando mídia para storage:', {
        type,
        mediaUrl: finalMediaUrl?.substring(0, 100),
        mediaUrlLength: finalMediaUrl?.length,
        isLocalhost: finalMediaUrl?.includes('localhost'),
        hasProtocol: finalMediaUrl?.startsWith('http'),
      });

      console.log('[whatsapp-webhook] 📁 WAHA config para mídia:', {
        hasConfig: !!wahaConfigForMedia,
        baseUrl: wahaConfigForMedia?.baseUrl?.substring(0, 50),
      });

      const storageUrl = await uploadMediaToStorage(
        supabase,
        finalMediaUrl,
        type,
        lead.id,
        wahaConfigForMedia
      );
      if (storageUrl) {
        finalMediaUrl = storageUrl;
        console.log('[whatsapp-webhook] 📁 Mídia salva no storage:', storageUrl);
      } else {
        console.log('[whatsapp-webhook] ⚠️ Falha no upload, mantendo referência original');
        // Não usar URL original como fallback se não conseguiu fazer upload
        // Deixar undefined para permitir recuperação posterior
        finalMediaUrl = undefined;
      }
    }

    // Extrair quote se houver (re-extrair do payload porque não está disponível aqui)
    const { quotedMessage } = getMessageContent(messageData, provider);

    // ========== VERIFICAÇÃO DE SEGURANÇA: Garantir que temos conversa ==========
    if (!conversation || !conversation.id) {
      console.error(
        '[whatsapp-webhook] ❌ ERRO CRÍTICO: conversation é null/undefined antes de criar mensagem'
      );
      console.error('[whatsapp-webhook] Lead:', lead?.id, 'Content:', content?.substring(0, 50));
      return new Response(
        JSON.stringify({ success: false, error: 'No conversation found - cannot create message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== DETERMINAR DIREÇÃO E TIPO DE REMETENTE ==========
    // isFromMe=true: mensagem enviada por nós (celular, CRM, bot)
    // isFromMe=false: mensagem recebida do lead
    const direction = isFromMe ? 'outbound' : 'inbound';
    const senderType = isFromMe ? 'agent' : 'lead';
    const source = isFromMe ? 'mobile' : 'lead'; // 'mobile' porque veio pelo celular (não pelo CRM)

    console.log('[whatsapp-webhook] Direção:', direction, 'Sender:', senderType, 'Source:', source);

    // Criar mensagem com dados de quote se existirem (usar upsert com waha_message_id)
    const messageInsertData: Record<string, unknown> = {
      conversation_id: conversation.id,
      lead_id: lead.id,
      sender_id: isFromMe ? null : lead.id,
      sender_type: senderType,
      content: content,
      type: type as 'text' | 'image' | 'audio' | 'video' | 'document',
      media_url: finalMediaUrl,
      direction: direction,
      source: source,
      status: isFromMe ? 'sent' : 'delivered',
      external_id: externalMessageId || null,
      waha_message_id: wahaMessageId, // ← ID canônico para idempotência
    };

    // Adicionar dados de quote se existir
    if (quotedMessage) {
      messageInsertData.reply_to_external_id = quotedMessage.id;
      messageInsertData.quoted_message = quotedMessage;
      console.log('[whatsapp-webhook] Salvando mensagem com quote:', quotedMessage.id);
    }

    // Usar upsert para garantir idempotência (UNIQUE constraint no waha_message_id)
    let message;
    if (wahaMessageId) {
      const { data: upsertedMessage, error: upsertMsgError } = await supabase
        .from('messages')
        .upsert(messageInsertData, {
          onConflict: 'waha_message_id',
          ignoreDuplicates: true, // Ignora se já existe (não atualiza)
        })
        .select('*')
        .maybeSingle();

      if (upsertMsgError) {
        // Se erro for de duplicata, buscar a mensagem existente
        if (upsertMsgError.code === '23505') {
          console.log('[whatsapp-webhook] ⏭️ Mensagem duplicada detectada no upsert, ignorando');
          const { data: existingMsg } = await supabase
            .from('messages')
            .select('id')
            .eq('waha_message_id', wahaMessageId)
            .maybeSingle();

          return new Response(
            JSON.stringify({
              success: true,
              duplicate: true,
              existing_message_id: existingMsg?.id,
              matched_by: 'upsert_conflict',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.error('[whatsapp-webhook] ❌ Erro ao criar mensagem:', upsertMsgError);
        return new Response(JSON.stringify({ success: false, error: 'Error creating message' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      message = upsertedMessage;
    } else {
      // Sem waha_message_id, usar insert normal
      const { data: insertedMessage, error: insertMsgError } = await supabase
        .from('messages')
        .insert(messageInsertData)
        .select('*')
        .single();

      if (insertMsgError) {
        console.error('[whatsapp-webhook] ❌ Erro ao criar mensagem:', insertMsgError);
        return new Response(JSON.stringify({ success: false, error: 'Error creating message' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      message = insertedMessage;
    }

    // BUG FIX: message pode ser null/undefined quando upsert ignora duplicata
    // Nesse caso, buscar a mensagem existente para retornar o ID correto
    if (!message && wahaMessageId) {
      console.log('[whatsapp-webhook] ⚠️ Upsert retornou null, buscando mensagem existente...');
      const { data: existingMsg } = await supabase
        .from('messages')
        .select('*')
        .eq('waha_message_id', wahaMessageId)
        .maybeSingle();

      if (existingMsg) {
        console.log('[whatsapp-webhook] ✅ Mensagem existente encontrada:', existingMsg.id);
        // Usar a mensagem existente para o dispatch
        message = existingMsg;
        // Não retornar aqui - continuar para disparar webhook
      }
    }

    console.log(
      '[whatsapp-webhook] ✅ Mensagem criada:',
      message?.id,
      'waha_message_id:',
      wahaMessageId
    );

    // Disparar webhook para sistemas externos (N8N, Make, etc.) via dispatch-webhook
    console.log(
      '[whatsapp-webhook] 📋 message existe?',
      !!message,
      'ID:',
      message?.id,
      'direction:',
      message?.direction
    );
    if (message) {
      try {
        // Determinar evento baseado na direção
        const webhookEvent = message.direction === 'inbound' ? 'message.received' : 'message.sent';
        console.log('[whatsapp-webhook] 🔔 Disparando webhook:', webhookEvent);

        // Chamar dispatch-webhook via fetch (tem payload completo com todas as infos)
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const dispatchResponse = await fetch(`${supabaseUrl}/functions/v1/dispatch-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: webhookEvent,
            data: {
              message: message,
              lead: lead,
              conversation: conversation,
            },
          }),
        });

        const dispatchResult = await dispatchResponse.text();
        console.log(
          '[whatsapp-webhook] ✅ dispatch-webhook respondeu:',
          dispatchResponse.status,
          dispatchResult.substring(0, 150)
        );
      } catch (webhookError) {
        console.error('[whatsapp-webhook] ⚠️ Erro ao disparar webhook:', webhookError);
      }
    } else {
      console.log('[whatsapp-webhook] ⏭️ message é null, pulando dispatch');
    }

    // Notificações de mensagens removidas - o sino é reservado para eventos importantes
    // Alertas de novas mensagens são tratados via toast/som no frontend (useInboxRealtime)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message_id: message?.id || null,
          conversation_id: conversation.id,
          lead_id: lead.id,
          provider,
          external_id: externalMessageId,
        },
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[whatsapp-webhook] Erro não tratado:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
