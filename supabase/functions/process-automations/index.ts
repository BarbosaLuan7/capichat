import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Automation {
  id: string;
  name: string;
  trigger: string;
  conditions: Condition[];
  actions: Action[];
  is_active: boolean;
}

interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: string | number | string[];
}

interface Action {
  type: string;
  params: Record<string, unknown>;
}

interface EventPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// Evaluate conditions against data
function evaluateConditions(conditions: Condition[], data: Record<string, unknown>): boolean {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every((condition) => {
    const fieldValue = getNestedValue(data, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(String(fieldValue));
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(String(fieldValue));
      default:
        return true;
    }
  });
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

// Execute automation actions
async function executeActions(
  supabase: SupabaseClient,
  actions: Action[],
  data: Record<string, unknown>,
  automationId: string
): Promise<{ success: boolean; results: unknown[] }> {
  const results: unknown[] = [];
  
  for (const action of actions) {
    try {
      console.log(`[Automation ${automationId}] Executing action: ${action.type}`, action.params);
      
      switch (action.type) {
        case 'move_lead_to_stage': {
          const leadId = (data.lead as Record<string, unknown>)?.id as string;
          const stageId = action.params.stage_id as string;
          
          if (leadId && stageId) {
            const { error } = await supabase
              .from('leads')
              .update({ stage_id: stageId })
              .eq('id', leadId);
            
            if (error) throw error;
            results.push({ action: 'move_lead_to_stage', success: true, leadId, stageId });
          }
          break;
        }
        
        case 'change_lead_temperature': {
          const leadId = (data.lead as Record<string, unknown>)?.id as string;
          const temperature = action.params.temperature as string;
          
          if (leadId && temperature) {
            const { error } = await supabase
              .from('leads')
              .update({ temperature })
              .eq('id', leadId);
            
            if (error) throw error;
            results.push({ action: 'change_lead_temperature', success: true, leadId, temperature });
          }
          break;
        }
        
        case 'add_label': {
          const leadId = (data.lead as Record<string, unknown>)?.id as string;
          const labelId = action.params.label_id as string;
          
          if (leadId && labelId) {
            // Check if label already exists
            const { data: existing } = await supabase
              .from('lead_labels')
              .select('id')
              .eq('lead_id', leadId)
              .eq('label_id', labelId)
              .single();
            
            if (!existing) {
              const { error } = await supabase
                .from('lead_labels')
                .insert({ lead_id: leadId, label_id: labelId });
              
              if (error) throw error;
            }
            results.push({ action: 'add_label', success: true, leadId, labelId });
          }
          break;
        }
        
        case 'remove_label': {
          const leadId = (data.lead as Record<string, unknown>)?.id as string;
          const labelId = action.params.label_id as string;
          
          if (leadId && labelId) {
            const { error } = await supabase
              .from('lead_labels')
              .delete()
              .eq('lead_id', leadId)
              .eq('label_id', labelId);
            
            if (error) throw error;
            results.push({ action: 'remove_label', success: true, leadId, labelId });
          }
          break;
        }
        
        case 'create_task': {
          const leadId = (data.lead as Record<string, unknown>)?.id as string;
          const assignedTo = action.params.assigned_to as string || (data.lead as Record<string, unknown>)?.assigned_to as string;
          const title = action.params.title as string;
          const description = action.params.description as string;
          const priority = action.params.priority as string || 'medium';
          const dueDays = action.params.due_days as number || 1;
          
          if (title && assignedTo) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + dueDays);
            
            const { error, data: task } = await supabase
              .from('tasks')
              .insert({
                title,
                description,
                priority,
                assigned_to: assignedTo,
                lead_id: leadId,
                due_date: dueDate.toISOString(),
                status: 'todo',
              })
              .select()
              .single();
            
            if (error) throw error;
            results.push({ action: 'create_task', success: true, task });
          }
          break;
        }
        
        case 'notify_user': {
          const userId = action.params.user_id as string || (data.lead as Record<string, unknown>)?.assigned_to as string;
          const title = action.params.title as string;
          const message = action.params.message as string;
          const type = action.params.type as string || 'info';
          
          if (userId && title && message) {
            const { error } = await supabase.rpc('create_notification', {
              p_user_id: userId,
              p_title: title,
              p_message: message,
              p_type: type,
              p_data: { automation_id: automationId, ...data },
            });
            
            if (error) throw error;
            results.push({ action: 'notify_user', success: true, userId });
          }
          break;
        }
        
        case 'assign_to_user': {
          const leadId = (data.lead as Record<string, unknown>)?.id as string;
          const userId = action.params.user_id as string;
          
          if (leadId && userId) {
            const { error } = await supabase
              .from('leads')
              .update({ assigned_to: userId })
              .eq('id', leadId);
            
            if (error) throw error;
            
            // Also update conversation if exists
            await supabase
              .from('conversations')
              .update({ assigned_to: userId })
              .eq('lead_id', leadId);
            
            results.push({ action: 'assign_to_user', success: true, leadId, userId });
          }
          break;
        }
        
        case 'send_message': {
          const leadId = (data.lead as Record<string, unknown>)?.id as string;
          const content = action.params.content as string;
          const templateId = action.params.template_id as string;
          
          if (leadId) {
            let messageContent = content;
            
            // If template_id is provided, fetch template
            if (templateId) {
              const { data: template } = await supabase
                .from('templates')
                .select('content')
                .eq('id', templateId)
                .single();
              
              if (template) {
                messageContent = template.content;
              }
            }
            
            if (messageContent) {
              // Replace placeholders in message
              const lead = data.lead as Record<string, unknown>;
              messageContent = messageContent
                .replace(/\{\{nome\}\}/gi, (lead?.name as string) || '')
                .replace(/\{\{telefone\}\}/gi, (lead?.phone as string) || '');
              
              // Get or create conversation
              let conversationId: string;
              const { data: existingConv } = await supabase
                .from('conversations')
                .select('id')
                .eq('lead_id', leadId)
                .neq('status', 'resolved')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
              
              if (existingConv) {
                conversationId = existingConv.id;
              } else {
                const { data: newConv, error: convError } = await supabase
                  .from('conversations')
                  .insert({ lead_id: leadId, status: 'open' })
                  .select()
                  .single();
                
                if (convError) throw convError;
                conversationId = newConv.id;
              }
              
              // Create message
              const { error: msgError } = await supabase
                .from('messages')
                .insert({
                  conversation_id: conversationId,
                  lead_id: leadId,
                  content: messageContent,
                  sender_type: 'agent',
                  sender_id: '00000000-0000-0000-0000-000000000000', // System sender
                  direction: 'outbound',
                  type: 'text',
                });
              
              if (msgError) throw msgError;
              results.push({ action: 'send_message', success: true, leadId, conversationId });
            }
          }
          break;
        }
        
        default:
          console.warn(`[Automation] Unknown action type: ${action.type}`);
          results.push({ action: action.type, success: false, error: 'Unknown action type' });
      }
    } catch (error) {
      console.error(`[Automation ${automationId}] Action ${action.type} failed:`, error);
      results.push({ action: action.type, success: false, error: String(error) });
    }
  }
  
  return { success: results.every((r: unknown) => (r as { success: boolean }).success), results };
}

// Map webhook events to automation triggers
function mapEventToTrigger(event: string): string | null {
  const mapping: Record<string, string> = {
    'lead.created': 'lead_created',
    'lead.stage_changed': 'lead_stage_changed',
    'lead.temperature_changed': 'lead_temperature_changed',
    'lead.label_added': 'lead_label_added',
    'task.completed': 'task_overdue', // Will need additional logic for overdue
  };
  
  return mapping[event] || null;
}

// Busca foto de perfil do WhatsApp via WAHA API
async function fetchProfilePicture(
  wahaBaseUrl: string,
  apiKey: string,
  sessionName: string,
  contactId: string
): Promise<{ url: string | null; reason?: string }> {
  try {
    const cleanNumber = contactId.replace('@c.us', '').replace('@s.whatsapp.net', '').replace(/\D/g, '');
    
    if (cleanNumber.length < 10) {
      return { url: null, reason: 'number_too_short' };
    }
    
    const url = `${wahaBaseUrl}/api/contacts/profile-picture?contactId=${cleanNumber}&session=${sessionName}&refresh=true`;
    
    console.log(`[avatar-retry] 📷 Buscando foto: ${cleanNumber} via ${sessionName}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[avatar-retry] ❌ API retornou ${response.status}: ${errorText.substring(0, 100)}`);
      return { url: null, reason: `api_error_${response.status}` };
    }
    
    const data = await response.json();
    console.log(`[avatar-retry] 📥 Resposta:`, JSON.stringify(data).substring(0, 200));
    
    const profilePictureUrl = data?.profilePictureURL || data?.profilePicture || data?.url || data?.imgUrl;
    
    if (profilePictureUrl && typeof profilePictureUrl === 'string' && profilePictureUrl.startsWith('http')) {
      return { url: profilePictureUrl };
    }
    
    return { url: null, reason: 'no_picture_or_private' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { url: null, reason: 'timeout' };
    }
    return { url: null, reason: error instanceof Error ? error.message : 'unknown_error' };
  }
}

// Processa retry de avatar
async function processAvatarRetry(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<{ success: boolean; avatarUrl?: string; reason?: string }> {
  const { lead_id, phone, session, instance_id, attempt } = payload as {
    lead_id: string;
    phone: string;
    session: string;
    instance_id: string;
    attempt: number;
  };
  
  console.log(`[avatar-retry] 📷 Processando tentativa ${attempt} para lead ${lead_id}`);
  
  // Buscar config WAHA pela instância
  const { data: wahaConfig } = await supabase
    .from('whatsapp_config')
    .select('base_url, api_key, instance_name')
    .eq('id', instance_id)
    .eq('is_active', true)
    .maybeSingle();
  
  if (!wahaConfig) {
    console.log('[avatar-retry] ❌ Config WAHA não encontrada para instância:', instance_id);
    return { success: false, reason: 'config_not_found' };
  }
  
  const baseUrl = wahaConfig.base_url.replace(/\/$/, '');
  const result = await fetchProfilePicture(baseUrl, wahaConfig.api_key, wahaConfig.instance_name || session, phone);
  
  if (result.url) {
    // Atualizar lead com avatar
    const { error: updateError } = await supabase
      .from('leads')
      .update({ 
        avatar_url: result.url,
        updated_at: new Date().toISOString()
      })
      .eq('id', lead_id);
    
    if (updateError) {
      console.error('[avatar-retry] ❌ Erro ao atualizar lead:', updateError);
      return { success: false, reason: 'db_update_failed' };
    }
    
    console.log(`[avatar-retry] ✅ Avatar capturado para ${lead_id} na tentativa ${attempt}`);
    return { success: true, avatarUrl: result.url };
  }
  
  // Se não encontrou e ainda tem tentativas, agendar mais uma
  const maxAttempts = 3;
  if (attempt < maxAttempts) {
    console.log(`[avatar-retry] 📷 Agendando tentativa ${attempt + 1}/${maxAttempts} para lead ${lead_id}`);
    await supabase.from('automation_queue').insert({
      event: 'avatar_retry',
      payload: {
        lead_id,
        phone,
        session,
        instance_id,
        attempt: attempt + 1,
        reason: result.reason,
      }
    });
  } else {
    console.log(`[avatar-retry] ⚠️ Máximo de tentativas atingido para lead ${lead_id}. Motivo: ${result.reason}`);
  }
  
  return { success: false, reason: result.reason };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get unprocessed items from automation queue
    const { data: queueItems, error: queueError } = await supabase
      .from('automation_queue')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(100);

    if (queueError) {
      console.error('[Automation] Error fetching queue:', queueError);
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('[Automation] No items to process');
      return new Response(
        JSON.stringify({ message: 'No items to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Automation] Processing ${queueItems.length} queue items`);

    const allResults: unknown[] = [];

    for (const queueItem of queueItems) {
      const payload: EventPayload = {
        event: queueItem.event,
        timestamp: queueItem.created_at,
        data: queueItem.payload.data || queueItem.payload,
      };

      console.log('[Automation] Processing event:', payload.event);

      // ========== HANDLER ESPECIAL: Avatar Retry ==========
      if (payload.event === 'avatar_retry') {
        console.log('[Automation] Processing avatar_retry event');
        const avatarResult = await processAvatarRetry(supabase, queueItem.payload);
        
        allResults.push({
          queueId: queueItem.id,
          event: 'avatar_retry',
          result: avatarResult,
        });
        
        // Mark as processed
        await supabase
          .from('automation_queue')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', queueItem.id);
        continue;
      }

      // Map event to trigger
      const trigger = mapEventToTrigger(payload.event);
      if (!trigger) {
        console.log('[Automation] No matching trigger for event:', payload.event);
        // Mark as processed
        await supabase
          .from('automation_queue')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', queueItem.id);
        continue;
      }

      // Fetch active automations for this trigger
      const { data: automations, error: autoError } = await supabase
        .from('automations')
        .select('*')
        .eq('trigger', trigger)
        .eq('is_active', true);

      if (autoError) {
        console.error('[Automation] Error fetching automations:', autoError);
        continue;
      }

      if (!automations || automations.length === 0) {
        console.log('[Automation] No active automations for trigger:', trigger);
        // Mark as processed
        await supabase
          .from('automation_queue')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', queueItem.id);
        continue;
      }

      console.log(`[Automation] Found ${automations.length} automations for trigger:`, trigger);

      const results: { automationId: string; name: string; matched: boolean; executed: boolean; results?: unknown }[] = [];

      for (const automation of automations as Automation[]) {
        // Evaluate conditions
        const conditionsMatch = evaluateConditions(automation.conditions || [], payload.data);

        if (!conditionsMatch) {
          console.log(`[Automation ${automation.id}] Conditions not met, skipping`);
          results.push({ automationId: automation.id, name: automation.name, matched: false, executed: false });
          continue;
        }

        console.log(`[Automation ${automation.id}] Conditions met, executing actions`);

        // Execute actions
        const actionResults = await executeActions(
          supabase,
          automation.actions || [],
          payload.data,
          automation.id
        );

        results.push({
          automationId: automation.id,
          name: automation.name,
          matched: true,
          executed: actionResults.success,
          results: actionResults.results,
        });

        console.log(`[Automation ${automation.id}] Execution complete:`, actionResults);
      }

      allResults.push({
        queueId: queueItem.id,
        event: payload.event,
        trigger,
        results,
      });

      // Mark as processed
      await supabase
        .from('automation_queue')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', queueItem.id);
    }

    return new Response(
      JSON.stringify({
        message: 'Automation queue processed',
        processed: queueItems.length,
        results: allResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Automation] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
