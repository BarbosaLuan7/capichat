import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ExternalLink,
  FileJson,
  Copy,
  Check,
  ArrowLeft,
  LogIn,
  Book,
  Code,
  Terminal,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/useAuth';
import { CodeExample } from '@/components/docs/CodeExample';
import { ApiStatusBadge } from '@/components/docs/ApiStatusBadge';
import { SwaggerUISkeleton } from '@/components/docs/SwaggerUISkeleton';

import 'swagger-ui/dist/swagger-ui.css';

export default function ApiDocs() {
  const [copied, setCopied] = useState(false);
  const [swaggerLoading, setSwaggerLoading] = useState(true);
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'vnsypopnzwtkmyvxvqpu';
  const baseUrl = `https://${projectId}.supabase.co/functions/v1`;
  const specUrl = '/api-docs/openapi.yaml';

  useEffect(() => {
    let cancelled = false;
    let swaggerUi: any;

    const init = async () => {
      try {
        const mod: any = await import('swagger-ui');
        const SwaggerUI = mod?.default ?? mod;

        swaggerUi = SwaggerUI({
          url: specUrl,
          dom_id: '#swagger-ui',
          deepLinking: true,
          layout: 'BaseLayout',
          defaultModelsExpandDepth: 1,
          defaultModelExpandDepth: 1,
          docExpansion: 'list',
          filter: true,
          showExtensions: true,
          showCommonExtensions: true,
          tryItOutEnabled: true,
          onComplete: () => {
            if (!cancelled) setSwaggerLoading(false);
          },
        });

        // Fallback timeout (ex.: spec inválida ou onComplete não dispara)
        setTimeout(() => {
          if (!cancelled) setSwaggerLoading(false);
        }, 3000);
      } catch (err) {
        if (!cancelled) {
          setSwaggerLoading(false);
          toast.error('Falha ao carregar a documentação interativa.');

          console.error('Swagger UI load error', err);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      try {
        swaggerUi?.destroy?.();
      } catch {
        // ignore
      }
    };
  }, [specUrl]);

  const handleCopyBaseUrl = () => {
    navigator.clipboard.writeText(baseUrl);
    setCopied(true);
    toast.success('URL base copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNavigate = () => {
    if (isAuthenticated) {
      navigate('/settings/api');
    } else {
      navigate('/auth');
    }
  };

  // Code examples organized by language
  const codeExamples = {
    curl: [
      {
        title: 'Enviar mensagem avulsa',
        code: `curl -X POST "${baseUrl}/chat-v2-mensagem" \\
  -H "Authorization: Bearer SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "telefone": "5521967200464",
    "tipo": "texto",
    "conteudo": "Olá! Como posso ajudar?"
  }'`,
      },
      {
        title: 'Listar conversas abertas',
        code: `curl -X GET "${baseUrl}/api-conversations?status=open&page=1" \\
  -H "Authorization: Bearer SUA_API_KEY"`,
      },
      {
        title: 'Buscar contato por telefone',
        code: `curl -X GET "${baseUrl}/api-leads?phone=5545999957851" \\
  -H "Authorization: Bearer SUA_API_KEY"`,
      },
      {
        title: 'Mover lead para etapa do funil',
        code: `curl -X PUT "${baseUrl}/api-leads/5545999957851" \\
  -H "Authorization: Bearer SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"stage_id": "uuid-da-etapa"}'`,
      },
    ],
    javascript: [
      {
        title: 'Listar usuários',
        code: `const response = await fetch("${baseUrl}/api-users?page=1&page_size=50", {
  headers: { "Authorization": "Bearer SUA_API_KEY" }
});
const { data, total } = await response.json();
console.log(\`Total: \${total} usuários\`);`,
      },
      {
        title: 'Criar tarefa',
        code: `const response = await fetch("${baseUrl}/api-tasks", {
  method: "POST",
  headers: {
    "Authorization": "Bearer SUA_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    title: "Ligar para cliente",
    assigned_to: "usr_abc123",
    lead_id: "lead_xyz789",
    priority: "high",
    due_date: "2026-01-10"
  })
});
const task = await response.json();`,
      },
      {
        title: 'Buscar conversa por ID ou telefone',
        code: `// Por UUID
const byId = await fetch("${baseUrl}/api-conversations?id=uuid-da-conversa", {
  headers: { "Authorization": "Bearer SUA_API_KEY" }
});

// Por telefone do lead
const byPhone = await fetch("${baseUrl}/api-conversations?lead_id=5545999957851", {
  headers: { "Authorization": "Bearer SUA_API_KEY" }
});`,
      },
      {
        title: 'Enviar template com variáveis',
        code: `const response = await fetch("${baseUrl}/api-messages-send", {
  method: "POST",
  headers: {
    "Authorization": "Bearer SUA_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    lead_id: "5545999957851", // UUID ou telefone
    template_id: "uuid-do-template",
    variables: {
      nome: "Maria",
      data_reuniao: "10/01/2026"
    }
  })
});`,
      },
    ],
    python: [
      {
        title: 'Criar contato com etiquetas',
        code: `import requests

response = requests.post(
    "${baseUrl}/api-leads",
    headers={"Authorization": "Bearer SUA_API_KEY"},
    json={
        "name": "Maria Silva",
        "phone": "5545999957851",
        "source": "api",
        "temperature": "warm",
        "benefit_type": "BPC/LOAS"
    }
)
lead = response.json()
print(f"Lead criado: {lead['lead']['id']}")`,
      },
      {
        title: 'Listar etiquetas',
        code: `import requests

response = requests.get(
    "${baseUrl}/api-tags",
    headers={"Authorization": "Bearer SUA_API_KEY"}
)
tags = response.json()
for tag in tags["data"]:
    print(f"{tag['name']} ({tag['category']})")`,
      },
      {
        title: 'Receber webhook de mensagem',
        code: `from flask import Flask, request
import hmac
import hashlib

app = Flask(__name__)
WEBHOOK_SECRET = "seu_webhook_secret"

@app.route("/webhook", methods=["POST"])
def handle_webhook():
    signature = request.headers.get("X-Webhook-Signature")
    payload = request.data
    
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(signature, expected):
        return "Invalid signature", 401
    
    data = request.json
    print(f"Evento: {data['event']}")
    print(f"Lead: {data['payload']['lead']['name']}")
    return "OK", 200`,
      },
      {
        title: 'Atualizar temperatura do lead',
        code: `import requests

# Aceita UUID ou telefone como identificador
lead_id = "5545999957851"

response = requests.put(
    f"${baseUrl}/api-leads/{lead_id}",
    headers={"Authorization": "Bearer SUA_API_KEY"},
    json={"temperature": "hot"}
)
result = response.json()
print(f"Temperatura atualizada: {result['lead']['temperature']}")`,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">LB</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">LB ADV API</h1>
              <p className="text-sm text-muted-foreground">Documentação pública</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ApiStatusBadge baseUrl={baseUrl} />

            {!loading && (
              <Button onClick={handleNavigate} variant="outline">
                {isAuthenticated ? (
                  <>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao Sistema
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Fazer Login
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto space-y-6 px-4 py-6">
        {/* Hero Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Documentação da API</h2>
            <p className="mt-1 text-muted-foreground">
              Referência completa dos endpoints disponíveis para integração externa
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Zap className="h-3 w-3" />
              REST API v2.0
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Book className="h-3 w-3" />
              OpenAPI 3.0
            </Badge>
          </div>
        </div>

        {/* Quick Reference Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <FileJson className="h-4 w-4" />
                Base URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                  {baseUrl}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCopyBaseUrl}
                  aria-label="Copiar URL base"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Autenticação</CardTitle>
            </CardHeader>
            <CardContent>
              <code className="block rounded bg-muted px-2 py-1 font-mono text-xs">
                Authorization: Bearer {'<api_key>'}
              </code>
              <p className="mt-2 text-xs text-muted-foreground">
                Obtenha sua API Key em Configurações → API
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Identificadores Flexíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Use <strong>UUID</strong> ou <strong>telefone</strong> para identificar leads e
                conversas. O sistema detecta automaticamente o formato.
              </p>
              <div className="mt-2 flex gap-1">
                <Badge variant="secondary" className="text-xs">
                  lead_id
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  contato_id
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  telefone
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Endpoints Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Endpoints Disponíveis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold">
                CORE
              </Badge>
              <Badge variant="secondary">api-users</Badge>
              <Badge variant="secondary">api-teams</Badge>
              <Badge variant="secondary">api-leads</Badge>
              <Badge variant="secondary">api-tags</Badge>
              <Badge variant="secondary">api-webhooks</Badge>
              <Badge variant="secondary">api-whatsapp-instances</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold">
                CHAT
              </Badge>
              <Badge variant="secondary">api-conversations</Badge>
              <Badge variant="secondary">api-messages-send</Badge>
              <Badge variant="secondary">api-messages-receive</Badge>
              <Badge variant="secondary">chat-v2-mensagem</Badge>
              <Badge variant="secondary">api-templates</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs font-semibold">
                CRM
              </Badge>
              <Badge variant="secondary">api-funnels</Badge>
              <Badge variant="secondary">api-tasks</Badge>
              <Badge variant="secondary">api-oportunidades</Badge>
              <Badge variant="secondary">api-carteiras</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quick Examples with Tabs */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              <div>
                <CardTitle className="text-lg">Exemplos de Código</CardTitle>
                <CardDescription>
                  Código pronto para copiar e usar em sua integração
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="curl" className="w-full">
              <TabsList className="mb-4 grid w-full grid-cols-3">
                <TabsTrigger value="curl" className="gap-2">
                  <Terminal className="h-4 w-4" />
                  cURL
                </TabsTrigger>
                <TabsTrigger value="javascript" className="gap-2">
                  <Code className="h-4 w-4" />
                  JavaScript
                </TabsTrigger>
                <TabsTrigger value="python" className="gap-2">
                  <Code className="h-4 w-4" />
                  Python
                </TabsTrigger>
              </TabsList>

              <TabsContent value="curl" className="mt-0 space-y-4">
                {codeExamples.curl.map((example, index) => (
                  <CodeExample
                    key={index}
                    title={example.title}
                    code={example.code}
                    language="bash"
                  />
                ))}
              </TabsContent>

              <TabsContent value="javascript" className="mt-0 space-y-4">
                {codeExamples.javascript.map((example, index) => (
                  <CodeExample
                    key={index}
                    title={example.title}
                    code={example.code}
                    language="javascript"
                  />
                ))}
              </TabsContent>

              <TabsContent value="python" className="mt-0 space-y-4">
                {codeExamples.python.map((example, index) => (
                  <CodeExample
                    key={index}
                    title={example.title}
                    code={example.code}
                    language="python"
                  />
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Swagger UI Container */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Referência Interativa</CardTitle>
                <CardDescription>Explore e teste os endpoints diretamente</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={specUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  OpenAPI Spec
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {swaggerLoading && <SwaggerUISkeleton />}
            <div
              id="swagger-ui"
              className={swaggerLoading ? 'hidden' : 'swagger-ui-container'}
              style={{
                minHeight: '600px',
                padding: '1rem',
              }}
            />
          </CardContent>
        </Card>
      </main>

      {/* Custom Swagger UI Styles */}
      <style>{`
        .swagger-ui .topbar { display: none !important; }
        .swagger-ui .info { margin: 0 !important; }
        .swagger-ui .info hgroup.main { margin: 0 0 1rem 0 !important; }
        .swagger-ui .scheme-container { padding: 1rem 0 !important; background: transparent !important; }
        .swagger-ui .opblock { border-radius: 0.5rem !important; }
        .swagger-ui .opblock-summary { border-radius: 0.5rem !important; }
        .swagger-ui .btn { border-radius: 0.375rem !important; }
        .swagger-ui input[type=text], .swagger-ui textarea { border-radius: 0.375rem !important; }
        .swagger-ui select { border-radius: 0.375rem !important; }
        .swagger-ui .model-box { border-radius: 0.5rem !important; }
        .swagger-ui section.models { border-radius: 0.5rem !important; }
        .swagger-ui .filter-container { margin-bottom: 1rem !important; }
        .swagger-ui .filter-container input { 
          border-radius: 0.375rem !important; 
          padding: 0.5rem 1rem !important;
        }
         /* Dark mode styles */
         .dark .swagger-ui { 
           filter: invert(88%) hue-rotate(180deg); 
         }
         .dark .swagger-ui img { 
           filter: invert(100%) hue-rotate(180deg); 
         }
         .dark .swagger-ui .opblock-body pre.microlight {
           filter: invert(100%) hue-rotate(180deg);
         }

         @media (prefers-color-scheme: dark) {
           .swagger-ui { 
             filter: invert(88%) hue-rotate(180deg); 
           }
           .swagger-ui img { 
             filter: invert(100%) hue-rotate(180deg); 
           }
           .swagger-ui .opblock-body pre.microlight {
             filter: invert(100%) hue-rotate(180deg);
           }
         }
      `}</style>
    </div>
  );
}
