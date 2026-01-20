import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const { data: keyId, error: keyError } = await supabase.rpc('validate_api_key', {
      key_value: apiKey,
    });

    if (keyError || !keyId) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const leadId = url.searchParams.get('lead_id');
    const tagId = url.searchParams.get('tag_id');
    const action = url.searchParams.get('action'); // 'lead' for lead_labels operations
    const category = url.searchParams.get('category');

    // Lead tags operations
    if (action === 'lead') {
      if (!leadId) {
        return new Response(
          JSON.stringify({ error: 'lead_id is required for lead tag operations' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET - Get lead's tags
      if (req.method === 'GET') {
        const { data, error } = await supabase
          .from('lead_labels')
          .select(
            `
            id,
            label:labels(*)
          `
          )
          .eq('lead_id', leadId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify(data?.map((ll) => ll.label) || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // POST - Add tags to lead
      if (req.method === 'POST') {
        const body = await req.json();
        const tagIds = body.tag_ids || (body.tag_id ? [body.tag_id] : []);

        if (tagIds.length === 0) {
          return new Response(JSON.stringify({ error: 'tag_ids or tag_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const inserts = tagIds.map((tid: string) => ({
          lead_id: leadId,
          label_id: tid,
        }));

        const { data, error } = await supabase
          .from('lead_labels')
          .upsert(inserts, { onConflict: 'lead_id,label_id', ignoreDuplicates: true })
          .select();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true, added: tagIds.length }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // DELETE - Remove tag from lead
      if (req.method === 'DELETE') {
        if (!tagId) {
          return new Response(JSON.stringify({ error: 'tag_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { error } = await supabase
          .from('lead_labels')
          .delete()
          .eq('lead_id', leadId)
          .eq('label_id', tagId);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Standard labels/tags CRUD
    // GET - List all tags or get single
    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await supabase.from('labels').select('*').eq('id', id).single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let query = supabase.from('labels').select('*');
      if (category) query = query.eq('category', category);

      const { data, error } = await query.order('name');

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Create tag
    if (req.method === 'POST') {
      const body = await req.json();

      if (!body.name) {
        return new Response(JSON.stringify({ error: 'name is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('labels')
        .insert({
          name: body.name,
          color: body.color || '#6B7280',
          category: body.category || 'status',
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PUT - Update tag
    if (req.method === 'PUT') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'id query parameter is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const updateData: Record<string, unknown> = {};

      if (body.name !== undefined) updateData.name = body.name;
      if (body.color !== undefined) updateData.color = body.color;
      if (body.category !== undefined) updateData.category = body.category;

      const { data, error } = await supabase
        .from('labels')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE - Delete tag
    if (req.method === 'DELETE') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'id query parameter is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase.from('labels').delete().eq('id', id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in api-tags:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
