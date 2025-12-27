import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileJson, Copy, Check, ArrowLeft, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/useAuth';

export default function ApiDocs() {
  const swaggerContainerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'vnsypopnzwtkmyvxvqpu';
  const baseUrl = `https://${projectId}.supabase.co/functions/v1`;
  const specUrl = '/api-docs/openapi.yaml';

  useEffect(() => {
    // Load Swagger UI CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css';
    document.head.appendChild(link);

    // Load Swagger UI JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js';
    script.onload = () => {
      if (swaggerContainerRef.current && (window as any).SwaggerUIBundle) {
        (window as any).SwaggerUIBundle({
          url: specUrl,
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            (window as any).SwaggerUIBundle.presets.apis,
            (window as any).SwaggerUIBundle.SwaggerUIStandalonePreset
          ],
          layout: 'BaseLayout',
          defaultModelsExpandDepth: 1,
          defaultModelExpandDepth: 1,
          docExpansion: 'list',
          filter: true,
          showExtensions: true,
          showCommonExtensions: true,
          tryItOutEnabled: true,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

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

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">GD</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">GaranteDireito API</h1>
              <p className="text-sm text-muted-foreground">Documentação pública</p>
            </div>
          </div>
          
          {!loading && (
            <Button onClick={handleNavigate} variant="outline">
              {isAuthenticated ? (
                <>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Sistema
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Fazer Login
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Documentação da API</h2>
          <p className="text-muted-foreground mt-1">
            Referência completa dos endpoints disponíveis para integração externa
          </p>
        </div>

      {/* Quick Reference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileJson className="w-4 h-4" />
              Base URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                {baseUrl}
              </code>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={handleCopyBaseUrl}
                aria-label="Copiar URL base"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Autenticação</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-xs bg-muted px-2 py-1 rounded block">
              Authorization: Bearer {'<api_key>'}
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              Obtenha sua API Key em Configurações → API
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Endpoints Disponíveis</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            <Badge variant="secondary">Leads</Badge>
            <Badge variant="secondary">Mensagens</Badge>
            <Badge variant="secondary">Conversas</Badge>
            <Badge variant="secondary">Tags</Badge>
            <Badge variant="secondary">Templates</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Quick Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Exemplos Rápidos</CardTitle>
          <CardDescription>Código pronto para copiar e usar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Enviar mensagem (cURL)</p>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`curl -X POST "${baseUrl}/api-messages-send" \\
  -H "Authorization: Bearer SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "5545999957851", "message": "Olá!"}'`}
            </pre>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Listar leads (JavaScript)</p>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`const response = await fetch("${baseUrl}/api-leads?page=1&page_size=50", {
  headers: {
    "Authorization": "Bearer SUA_API_KEY"
  }
});
const { data, pagination } = await response.json();`}
            </pre>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Criar lead (Python)</p>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`import requests

response = requests.post(
    "${baseUrl}/api-leads",
    headers={"Authorization": "Bearer SUA_API_KEY"},
    json={
        "name": "Maria Silva",
        "phone": "5545999957851",
        "source": "api",
        "temperature": "warm"
    }
)
lead = response.json()`}
            </pre>
          </div>
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
                <ExternalLink className="w-4 h-4 mr-2" />
                OpenAPI Spec
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div 
            id="swagger-ui" 
            ref={swaggerContainerRef}
            className="swagger-ui-container"
            style={{ 
              minHeight: '600px',
              padding: '1rem'
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
        
        @media (prefers-color-scheme: dark) {
          .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
          .swagger-ui img { filter: invert(100%) hue-rotate(180deg); }
        }
      `}</style>
    </div>
  );
}
