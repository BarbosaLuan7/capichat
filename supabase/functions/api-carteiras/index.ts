import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CarteiraPayload {
  nome: string;
  descricao?: string;
  cor?: string;
  tenant_id?: string;
}

function formatCarteira(carteira: any, totalContatos?: number) {
  return {
    id: carteira.id,
    nome: carteira.name,
    descricao: carteira.description,
    cor: carteira.color,
    total_contatos: totalContatos ?? carteira.total_contatos ?? 0,
    criada_em: carteira.created_at,
    atualizada_em: carteira.updated_at,
  };
}

function formatContato(lead: any) {
  return {
    id: lead.id,
    nome: lead.name,
    telefone: lead.phone,
    email: lead.email,
    adicionado_em: lead.wallet_contacts?.[0]?.created_at || lead.created_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API Key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Header Authorization ausente ou inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: apiKeyId, error: apiKeyError } = await supabase.rpc('validate_api_key', {
      key_value: apiKey,
    });

    if (apiKeyError || !apiKeyId) {
      return new Response(JSON.stringify({ sucesso: false, erro: 'API key inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action');
    const tenantId = url.searchParams.get('tenant_id');
    const page = parseInt(url.searchParams.get('pagina') || url.searchParams.get('page') || '1');
    const pageSize = parseInt(
      url.searchParams.get('por_pagina') || url.searchParams.get('page_size') || '50'
    );

    // GET - List carteiras or contatos
    if (req.method === 'GET') {
      // GET /api-carteiras?id=xxx&action=contatos - List contacts in wallet
      if (id && action === 'contatos') {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const {
          data: contacts,
          error,
          count,
        } = await supabase
          .from('wallet_contacts')
          .select(
            `
            lead_id,
            created_at,
            leads:lead_id(id, name, phone, email)
          `,
            { count: 'exact' }
          )
          .eq('wallet_id', id)
          .range(from, to);

        if (error) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Erro ao listar contatos' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const formattedContacts = (contacts || []).map((c: any) => ({
          id: c.leads?.id,
          nome: c.leads?.name,
          telefone: c.leads?.phone,
          email: c.leads?.email,
          adicionado_em: c.created_at,
        }));

        return new Response(
          JSON.stringify({
            dados: formattedContacts,
            paginacao: {
              pagina: page,
              por_pagina: pageSize,
              total: count || 0,
              total_paginas: Math.ceil((count || 0) / pageSize),
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /api-carteiras?id=xxx - Get single wallet
      if (id) {
        const { data, error } = await supabase.from('wallets').select('*').eq('id', id).single();

        if (error) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Carteira não encontrada' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get contact count
        const { count } = await supabase
          .from('wallet_contacts')
          .select('*', { count: 'exact', head: true })
          .eq('wallet_id', id);

        return new Response(JSON.stringify(formatCarteira(data, count || 0)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /api-carteiras - List all wallets
      let query = supabase
        .from('wallets')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) {
        return new Response(JSON.stringify({ sucesso: false, erro: 'Erro ao listar carteiras' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get contact counts for each wallet
      const walletIds = (data || []).map((w) => w.id);
      const { data: counts } = await supabase
        .from('wallet_contacts')
        .select('wallet_id')
        .in('wallet_id', walletIds);

      const countMap: Record<string, number> = {};
      (counts || []).forEach((c: any) => {
        countMap[c.wallet_id] = (countMap[c.wallet_id] || 0) + 1;
      });

      const formatted = (data || []).map((w) => formatCarteira(w, countMap[w.id] || 0));

      return new Response(JSON.stringify({ dados: formatted }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Create wallet or add contact
    if (req.method === 'POST') {
      // POST /api-carteiras?id=xxx&action=contatos - Add contact to wallet
      if (id && action === 'contatos') {
        const body = await req.json();

        if (!body.contato_id) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'contato_id é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase.from('wallet_contacts').insert({
          wallet_id: id,
          lead_id: body.contato_id,
        });

        if (error) {
          if (error.code === '23505') {
            // Unique violation
            return new Response(
              JSON.stringify({ sucesso: false, erro: 'Contato já está na carteira' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'Erro ao adicionar contato' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ sucesso: true }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // POST /api-carteiras - Create wallet
      const body: CarteiraPayload = await req.json();

      if (!body.nome) {
        return new Response(JSON.stringify({ sucesso: false, erro: 'nome é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('wallets')
        .insert({
          name: body.nome,
          description: body.descricao,
          color: body.cor || '#6366f1',
          tenant_id: body.tenant_id || tenantId,
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ sucesso: false, erro: 'Erro ao criar carteira' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ sucesso: true, carteira: formatCarteira(data, 0) }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT - Update wallet
    if (req.method === 'PUT') {
      if (!id) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Parâmetro id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body: Partial<CarteiraPayload> = await req.json();
      const updateData: Record<string, unknown> = {};

      if (body.nome !== undefined) updateData.name = body.nome;
      if (body.descricao !== undefined) updateData.description = body.descricao;
      if (body.cor !== undefined) updateData.color = body.cor;

      const { data, error } = await supabase
        .from('wallets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Erro ao atualizar carteira' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ sucesso: true, carteira: formatCarteira(data) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE - Remove wallet or contact from wallet
    if (req.method === 'DELETE') {
      if (!id) {
        return new Response(
          JSON.stringify({ sucesso: false, erro: 'Parâmetro id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // DELETE /api-carteiras?id=xxx&action=contatos&contato_id=yyy - Remove contact
      if (action === 'contatos') {
        const contatoId = url.searchParams.get('contato_id');
        if (!contatoId) {
          return new Response(
            JSON.stringify({ sucesso: false, erro: 'contato_id é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('wallet_contacts')
          .delete()
          .eq('wallet_id', id)
          .eq('lead_id', contatoId);

        if (error) {
          return new Response(JSON.stringify({ sucesso: false, erro: 'Erro ao remover contato' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ sucesso: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // DELETE /api-carteiras?id=xxx - Soft delete wallet
      const { error } = await supabase.from('wallets').update({ is_active: false }).eq('id', id);

      if (error) {
        return new Response(JSON.stringify({ sucesso: false, erro: 'Erro ao remover carteira' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ sucesso: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sucesso: false, erro: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[api-carteiras] Error:', error);
    return new Response(JSON.stringify({ sucesso: false, erro: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
