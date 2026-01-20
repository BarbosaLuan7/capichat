import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Transform template to Portuguese format
function formatTemplate(template: any) {
  return {
    id: template.id,
    nome: template.name,
    atalho: template.shortcut,
    conteudo: template.content,
    criado_em: template.created_at,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ erro: 'Header de autorização ausente ou inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: keyId, error: keyError } = await supabase.rpc('validate_api_key', {
      key_value: apiKey,
    });

    if (keyError || !keyId) {
      return new Response(JSON.stringify({ erro: 'API key inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const shortcut = url.searchParams.get('shortcut') || url.searchParams.get('atalho');

    // GET - List templates or get single
    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await supabase.from('templates').select('*').eq('id', id).single();

        if (error) {
          return new Response(JSON.stringify({ erro: error.message }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify(formatTemplate(data)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (shortcut) {
        const { data, error } = await supabase
          .from('templates')
          .select('*')
          .eq('shortcut', shortcut)
          .single();

        if (error) {
          return new Response(JSON.stringify({ erro: error.message }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify(formatTemplate(data)), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase.from('templates').select('*').order('name');

      if (error) {
        return new Response(JSON.stringify({ erro: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[api-templates] Retornando', data?.length || 0, 'templates');

      return new Response(
        JSON.stringify({
          dados: (data || []).map(formatTemplate),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Create template
    if (req.method === 'POST') {
      const body = await req.json();

      // Accept both PT and EN parameter names
      const nome = body.nome || body.name;
      const atalho = body.atalho || body.shortcut;
      const conteudo = body.conteudo || body.content;

      if (!nome || !atalho || !conteudo) {
        return new Response(
          JSON.stringify({ erro: 'Campos obrigatórios: nome, atalho, conteudo' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('templates')
        .insert({
          name: nome,
          shortcut: atalho,
          content: conteudo,
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ erro: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[api-templates] Template criado:', data.id);

      return new Response(
        JSON.stringify({
          sucesso: true,
          template: formatTemplate(data),
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT - Update template
    if (req.method === 'PUT') {
      if (!id) {
        return new Response(JSON.stringify({ erro: 'Parâmetro id é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const updateData: Record<string, unknown> = {};

      // Accept both PT and EN parameter names
      if (body.nome !== undefined || body.name !== undefined) {
        updateData.name = body.nome || body.name;
      }
      if (body.atalho !== undefined || body.shortcut !== undefined) {
        updateData.shortcut = body.atalho || body.shortcut;
      }
      if (body.conteudo !== undefined || body.content !== undefined) {
        updateData.content = body.conteudo || body.content;
      }

      const { data, error } = await supabase
        .from('templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ erro: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[api-templates] Template atualizado:', id);

      return new Response(
        JSON.stringify({
          sucesso: true,
          template: formatTemplate(data),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Delete template
    if (req.method === 'DELETE') {
      if (!id) {
        return new Response(JSON.stringify({ erro: 'Parâmetro id é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase.from('templates').delete().eq('id', id);

      if (error) {
        return new Response(JSON.stringify({ erro: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[api-templates] Template removido:', id);

      return new Response(
        JSON.stringify({ sucesso: true, mensagem: 'Template removido com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ erro: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[api-templates] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(JSON.stringify({ erro: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
