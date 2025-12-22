import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MessagePayload {
  phone: string;
  message: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'document';
  media_url?: string;
  timestamp?: string;
  external_id?: string;
  sender_name?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API Key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    
    // Validate API key using database function
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', {
      key_value: apiKey
    });

    if (apiKeyError || !apiKeyId) {
      console.error('Invalid API key:', apiKeyError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('API key validated successfully');

    const body: MessagePayload = await req.json();

    // Validate required fields
    if (!body.phone || !body.message) {
      return new Response(
        JSON.stringify({ success: false, error: 'phone and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Received message from phone:', body.phone);

    // Normalize phone number for search
    const normalizedPhone = body.phone.replace(/\D/g, '');

    // Find or create lead by phone
    let lead;
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${body.phone}%`)
      .maybeSingle();

    if (existingLead) {
      lead = existingLead;
      console.log('Found existing lead:', lead.id);

      // Update lead with WhatsApp name if provided
      if (body.sender_name && !existingLead.whatsapp_name) {
        await supabase
          .from('leads')
          .update({ 
            whatsapp_name: body.sender_name,
            last_interaction_at: new Date().toISOString()
          })
          .eq('id', lead.id);
      } else {
        // Just update last interaction
        await supabase
          .from('leads')
          .update({ last_interaction_at: new Date().toISOString() })
          .eq('id', lead.id);
      }
    } else {
      // Create new lead
      const { data: firstStage } = await supabase
        .from('funnel_stages')
        .select('id')
        .order('order', { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: newLead, error: createLeadError } = await supabase
        .from('leads')
        .insert({
          name: body.sender_name || `Lead ${body.phone}`,
          phone: body.phone,
          whatsapp_name: body.sender_name,
          source: 'whatsapp',
          temperature: 'warm',
          stage_id: firstStage?.id,
          status: 'active',
          last_interaction_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (createLeadError) {
        console.error('Error creating lead:', createLeadError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error creating lead' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      lead = newLead;
      console.log('Created new lead:', lead.id);

      // Dispatch webhook for lead.created
      try {
        await supabase.functions.invoke('dispatch-webhook', {
          body: {
            event: 'lead.created',
            data: { lead: newLead }
          }
        });
      } catch (webhookError) {
        console.error('Error dispatching lead.created webhook:', webhookError);
      }
    }

    // Find or create conversation
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
      console.log('Found existing conversation:', conversation.id);

      // Update conversation
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          unread_count: (conversation.unread_count || 0) + 1,
          status: 'open' // Reopen if pending
        })
        .eq('id', conversation.id);
    } else {
      // Create new conversation
      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          lead_id: lead.id,
          status: 'open',
          assigned_to: lead.assigned_to,
          last_message_at: new Date().toISOString(),
          unread_count: 1
        })
        .select('*')
        .single();

      if (createConvError) {
        console.error('Error creating conversation:', createConvError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error creating conversation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      conversation = newConversation;
      console.log('Created new conversation:', conversation.id);

      // Dispatch webhook for conversation.created
      try {
        await supabase.functions.invoke('dispatch-webhook', {
          body: {
            event: 'conversation.created',
            data: { conversation: newConversation, lead }
          }
        });
      } catch (webhookError) {
        console.error('Error dispatching conversation.created webhook:', webhookError);
      }
    }

    // Create message
    const { data: message, error: createMsgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        lead_id: lead.id,
        sender_id: lead.id,
        sender_type: 'lead',
        content: body.message,
        type: body.type || 'text',
        media_url: body.media_url,
        direction: 'inbound',
        status: 'delivered',
        created_at: body.timestamp || new Date().toISOString()
      })
      .select('*')
      .single();

    if (createMsgError) {
      console.error('Error creating message:', createMsgError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error creating message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Message created successfully:', message.id);

    // Create notification for assigned user
    if (conversation.assigned_to) {
      try {
        await supabase.rpc('create_notification', {
          p_user_id: conversation.assigned_to,
          p_title: 'Nova mensagem',
          p_message: `${lead.name}: ${body.message.substring(0, 100)}`,
          p_type: 'message',
          p_link: `/inbox?conversation=${conversation.id}`,
          p_data: { lead_id: lead.id, conversation_id: conversation.id }
        });
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
      }
    }

    // Dispatch webhook for message.received
    try {
      await supabase.functions.invoke('dispatch-webhook', {
        body: {
          event: 'message.received',
          data: {
            message,
            lead,
            conversation
          }
        }
      });
    } catch (webhookError) {
      console.error('Error dispatching message.received webhook:', webhookError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message,
          lead: {
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            is_new: !existingLead
          },
          conversation: {
            id: conversation.id,
            is_new: !existingConversation
          }
        }
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const error = err as Error;
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
