import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StressTestConfig {
  total_leads: number;
  messages_per_lead: number;
  batch_size: number;
  delay_between_batches_ms: number;
  dry_run: boolean;
}

interface StressTestMetrics {
  total_messages: number;
  successful: number;
  failed: number;
  avg_response_ms: number;
  min_response_ms: number;
  max_response_ms: number;
  leads_created: number;
  conversations_created: number;
  duration_ms: number;
  errors: string[];
}

// Nomes brasileiros comuns para gerar leads fictícios
const FIRST_NAMES = [
  'Maria', 'José', 'Ana', 'João', 'Francisca', 'Antonio', 'Adriana', 'Paulo',
  'Lúcia', 'Carlos', 'Juliana', 'Marcos', 'Fernanda', 'Pedro', 'Patricia',
  'Lucas', 'Amanda', 'Rafael', 'Camila', 'Bruno', 'Beatriz', 'Diego', 'Larissa',
  'Rodrigo', 'Letícia', 'Marcelo', 'Gabriela', 'Fernando', 'Aline', 'Ricardo'
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Rodrigues',
  'Almeida', 'Nascimento', 'Ferreira', 'Araújo', 'Carvalho', 'Gomes', 'Martins',
  'Ribeiro', 'Barbosa', 'Moreira', 'Cardoso', 'Nunes', 'Mendes', 'Cavalcante'
];

// Mensagens típicas de pessoas interessadas em BPC/LOAS
const MESSAGE_TEMPLATES = [
  'Boa tarde, gostaria de saber sobre o benefício',
  'Olá, tenho {age} anos e quero saber se tenho direito ao BPC',
  'Vi o anúncio de vocês no Facebook',
  'Minha mãe tem {age} anos, ela tem direito?',
  'Quanto tempo demora para conseguir o benefício?',
  'Preciso de quais documentos?',
  'Vocês atendem em {city}?',
  'Tenho problema de {health_condition}, posso pedir o benefício?',
  'Qual o valor do BPC atualmente?',
  'Meu CPF é {cpf}',
  'Posso mandar os documentos por aqui?',
  'Obrigado pela informação',
  'Vou providenciar os documentos',
  'Quando posso agendar uma consulta?',
  'Já tentei no INSS mas foi negado',
  'Meu pai recebe aposentadoria, mesmo assim posso pedir?',
  'Tenho renda de {income} reais por mês',
  'Moro com minha família, isso atrapalha?',
  'Como funciona o atendimento de vocês?',
  'Vocês cobram alguma coisa?'
];

const CITIES = ['São Paulo', 'Rio de Janeiro', 'Curitiba', 'Belo Horizonte', 'Salvador', 'Fortaleza', 'Recife', 'Porto Alegre'];
const HEALTH_CONDITIONS = ['diabetes', 'pressão alta', 'coluna', 'depressão', 'artrose', 'hérnia', 'visão', 'coração'];

function generateRandomPhone(index: number): string {
  // Usa prefixo 55119990 para identificar leads de teste
  const suffix = String(index).padStart(4, '0');
  return `5511999000${suffix}`;
}

function generateRandomName(): string {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${firstName} ${lastName} [TESTE]`;
}

function generateRandomMessage(): string {
  const template = MESSAGE_TEMPLATES[Math.floor(Math.random() * MESSAGE_TEMPLATES.length)];
  
  return template
    .replace('{age}', String(Math.floor(Math.random() * 30) + 50))
    .replace('{city}', CITIES[Math.floor(Math.random() * CITIES.length)])
    .replace('{health_condition}', HEALTH_CONDITIONS[Math.floor(Math.random() * HEALTH_CONDITIONS.length)])
    .replace('{cpf}', `${Math.floor(Math.random() * 900) + 100}.${Math.floor(Math.random() * 900) + 100}.${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90) + 10}`)
    .replace('{income}', String(Math.floor(Math.random() * 1500) + 500));
}

function generateRandomCPF(): string {
  const n = () => Math.floor(Math.random() * 10);
  return `${n()}${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}-${n()}${n()}`;
}

// Gerar API key temporária para o teste
function generateTempApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'gd_test_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendTestMessage(
  supabaseUrl: string,
  apiKey: string,
  phone: string,
  name: string,
  message: string
): Promise<{ success: boolean; duration_ms: number; error?: string; lead_created?: boolean; conversation_created?: boolean }> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/api-messages-receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        phone,
        name,
        message,
        source: 'stress-test',
      }),
    });

    const duration_ms = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, duration_ms, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    return { 
      success: true, 
      duration_ms,
      lead_created: result.lead_created,
      conversation_created: result.conversation_created,
    };
  } catch (error) {
    const duration_ms = Date.now() - startTime;
    return { success: false, duration_ms, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Apenas POST permitido
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
    
    // Verificar se o usuário é admin
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
        JSON.stringify({ error: 'Apenas administradores podem executar testes de estresse' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse config
    const body = await req.json();
    const config: StressTestConfig = {
      total_leads: Math.min(body.total_leads || 200, 500), // Max 500 leads
      messages_per_lead: Math.min(body.messages_per_lead || 5, 20), // Max 20 msgs por lead
      batch_size: Math.min(body.batch_size || 10, 50), // Max 50 por batch
      delay_between_batches_ms: Math.max(body.delay_between_batches_ms || 500, 50), // Min 50ms, default 500ms
      dry_run: body.dry_run || false,
    };

    const totalMessages = config.total_leads * config.messages_per_lead;
    
    if (totalMessages > 10000) {
      return new Response(
        JSON.stringify({ error: 'Máximo de 10.000 mensagens por teste' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[stress-test] Iniciando teste: ${config.total_leads} leads, ${config.messages_per_lead} msgs cada, total: ${totalMessages}`);

    // Criar API key temporária para o teste
    const tempApiKey = generateTempApiKey();
    const tempKeyHash = await hashApiKey(tempApiKey);
    
    console.log(`[stress-test] Criando API key temporária para o teste...`);
    
    const { data: tempKeyData, error: tempKeyError } = await supabase
      .from('api_keys')
      .insert({
        name: 'Stress Test Temp Key',
        key_hash: tempKeyHash,
        key_prefix: tempApiKey.substring(0, 12) + '...',
        is_active: true,
        rate_limit: 100000, // Sem limite para teste
        created_by: user.id
      })
      .select('id')
      .single();

    if (tempKeyError || !tempKeyData) {
      console.error('[stress-test] Erro ao criar API key temporária:', tempKeyError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar API key temporária para o teste' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const testApiKey = tempApiKey;
    const tempKeyId = tempKeyData.id;
    console.log(`[stress-test] API key temporária criada: ${tempKeyData.id}`);

    // Gerar lista de leads
    const leads: Array<{ phone: string; name: string; cpf: string }> = [];
    for (let i = 0; i < config.total_leads; i++) {
      leads.push({
        phone: generateRandomPhone(i),
        name: generateRandomName(),
        cpf: generateRandomCPF(),
      });
    }

    // Gerar todas as mensagens
    const allMessages: Array<{ phone: string; name: string; message: string }> = [];
    for (const lead of leads) {
      for (let m = 0; m < config.messages_per_lead; m++) {
        allMessages.push({
          phone: lead.phone,
          name: lead.name,
          message: generateRandomMessage(),
        });
      }
    }

    // Embaralhar mensagens para simular ordem realista
    for (let i = allMessages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allMessages[i], allMessages[j]] = [allMessages[j], allMessages[i]];
    }

    // Métricas
    const metrics: StressTestMetrics = {
      total_messages: totalMessages,
      successful: 0,
      failed: 0,
      avg_response_ms: 0,
      min_response_ms: Infinity,
      max_response_ms: 0,
      leads_created: 0,
      conversations_created: 0,
      duration_ms: 0,
      errors: [],
    };

    const responseTimes: number[] = [];
    const startTime = Date.now();

    if (config.dry_run) {
      console.log(`[stress-test] DRY RUN - simulando ${totalMessages} mensagens`);
      
      // Simular delays
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      metrics.successful = totalMessages;
      metrics.avg_response_ms = 150;
      metrics.min_response_ms = 80;
      metrics.max_response_ms = 450;
      metrics.leads_created = config.total_leads;
      metrics.conversations_created = config.total_leads;
      metrics.duration_ms = 1000;
      
    } else {
      // Enviar mensagens em batches
      for (let i = 0; i < allMessages.length; i += config.batch_size) {
        const batch = allMessages.slice(i, i + config.batch_size);
        
        console.log(`[stress-test] Enviando batch ${Math.floor(i / config.batch_size) + 1}/${Math.ceil(allMessages.length / config.batch_size)}`);
        
        // Enviar batch em paralelo
        const results = await Promise.all(
          batch.map(msg => sendTestMessage(supabaseUrl, testApiKey, msg.phone, msg.name, msg.message))
        );

        // Processar resultados
        for (const result of results) {
          if (result.success) {
            metrics.successful++;
            if (result.lead_created) metrics.leads_created++;
            if (result.conversation_created) metrics.conversations_created++;
          } else {
            metrics.failed++;
            if (result.error && metrics.errors.length < 10) {
              metrics.errors.push(result.error);
            }
          }

          responseTimes.push(result.duration_ms);
          if (result.duration_ms < metrics.min_response_ms) {
            metrics.min_response_ms = result.duration_ms;
          }
          if (result.duration_ms > metrics.max_response_ms) {
            metrics.max_response_ms = result.duration_ms;
          }
        }

        // Delay entre batches
        if (i + config.batch_size < allMessages.length) {
          await new Promise(resolve => setTimeout(resolve, config.delay_between_batches_ms));
        }
      }

      metrics.duration_ms = Date.now() - startTime;
      metrics.avg_response_ms = responseTimes.length > 0 
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;
    }

    // Ajustar min/max se não houve mensagens
    if (metrics.min_response_ms === Infinity) {
      metrics.min_response_ms = 0;
    }

    // Deletar API key temporária
    console.log(`[stress-test] Removendo API key temporária: ${tempKeyId}`);
    const { error: deleteKeyError } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', tempKeyId);
    
    if (deleteKeyError) {
      console.error('[stress-test] Erro ao deletar API key temporária:', deleteKeyError);
    }

    console.log(`[stress-test] Teste concluído:`, JSON.stringify(metrics, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        config,
        metrics,
        summary: {
          success_rate: `${((metrics.successful / metrics.total_messages) * 100).toFixed(1)}%`,
          messages_per_second: (metrics.total_messages / (metrics.duration_ms / 1000)).toFixed(2),
          avg_response: `${metrics.avg_response_ms}ms`,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[stress-test] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
