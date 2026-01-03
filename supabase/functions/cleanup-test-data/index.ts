import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem limpar dados de teste' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[cleanup-test-data] Iniciando limpeza de dados de teste...');

    // 1. Buscar leads de teste (telefone começa com 5511999000 ou nome contém [TESTE])
    const { data: testLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, phone, name')
      .or('phone.like.5511999000%,name.ilike.%[TESTE]%');

    if (leadsError) {
      throw new Error(`Erro ao buscar leads de teste: ${leadsError.message}`);
    }

    if (!testLeads || testLeads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum dado de teste encontrado para limpar',
          deleted: { leads: 0, conversations: 0, messages: 0 }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leadIds = testLeads.map(l => l.id);
    console.log(`[cleanup-test-data] Encontrados ${leadIds.length} leads de teste`);

    // 2. Buscar conversations desses leads
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .in('lead_id', leadIds);

    const conversationIds = conversations?.map(c => c.id) || [];
    console.log(`[cleanup-test-data] Encontradas ${conversationIds.length} conversas de teste`);

    let messagesDeleted = 0;
    let conversationsDeleted = 0;
    let leadsDeleted = 0;

    // 3. Deletar mensagens das conversas
    if (conversationIds.length > 0) {
      const { count: msgCount, error: msgError } = await supabase
        .from('messages')
        .delete({ count: 'exact' })
        .in('conversation_id', conversationIds);

      if (msgError) {
        console.error('[cleanup-test-data] Erro ao deletar mensagens:', msgError);
      } else {
        messagesDeleted = msgCount || 0;
        console.log(`[cleanup-test-data] ${messagesDeleted} mensagens deletadas`);
      }
    }

    // 4. Deletar internal_notes das conversas
    if (conversationIds.length > 0) {
      await supabase
        .from('internal_notes')
        .delete()
        .in('conversation_id', conversationIds);
    }

    // 5. Deletar conversas
    if (conversationIds.length > 0) {
      const { count: convCount, error: convError } = await supabase
        .from('conversations')
        .delete({ count: 'exact' })
        .in('id', conversationIds);

      if (convError) {
        console.error('[cleanup-test-data] Erro ao deletar conversas:', convError);
      } else {
        conversationsDeleted = convCount || 0;
        console.log(`[cleanup-test-data] ${conversationsDeleted} conversas deletadas`);
      }
    }

    // 6. Deletar lead_labels
    await supabase
      .from('lead_labels')
      .delete()
      .in('lead_id', leadIds);

    // 7. Deletar lead_history
    await supabase
      .from('lead_history')
      .delete()
      .in('lead_id', leadIds);

    // 8. Deletar lead_activities
    await supabase
      .from('lead_activities')
      .delete()
      .in('lead_id', leadIds);

    // 9. Deletar tasks relacionadas
    await supabase
      .from('tasks')
      .delete()
      .in('lead_id', leadIds);

    // 10. Deletar leads
    const { count: leadCount, error: leadError } = await supabase
      .from('leads')
      .delete({ count: 'exact' })
      .in('id', leadIds);

    if (leadError) {
      console.error('[cleanup-test-data] Erro ao deletar leads:', leadError);
    } else {
      leadsDeleted = leadCount || 0;
      console.log(`[cleanup-test-data] ${leadsDeleted} leads deletados`);
    }

    console.log('[cleanup-test-data] Limpeza concluída');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Dados de teste limpos com sucesso',
        deleted: {
          leads: leadsDeleted,
          conversations: conversationsDeleted,
          messages: messagesDeleted,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cleanup-test-data] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
