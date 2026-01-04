import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Users, Building2, CheckCircle2, XCircle, AlertTriangle, Database } from "lucide-react";
import { toast } from "sonner";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";

const TEAMS_PREVIEW = [
  { name: "GD | Previdenciário 👴", isDefault: true, autoDistribution: true },
  { name: "📁 Resolvoo | Andamento Processual", isDefault: false, autoDistribution: false },
  { name: "💜 Resolvoo | Atendimento Inicial", isDefault: false, autoDistribution: false },
  { name: "GD | Andamento - Prev ⚖️", isDefault: false, autoDistribution: false },
  { name: "IA - CAPI", isDefault: false, autoDistribution: false },
];

const USERS_PREVIEW = [
  { name: "Thaw", email: "thawanrmichels@gmail.com", role: "admin" },
  { name: "Natalia Müller", email: "najosoraal@gmail.com", role: "admin" },
  { name: "Luana Maestrelo", email: "maestreloluana@gmail.com", role: "admin" },
  { name: "Marina Barbosa", email: "matorresprado@hotmail.com", role: "agent" },
  { name: "Lunny Sander", email: "adv.lunnysander@gmail.com", role: "agent" },
  { name: "Jorge Moreira", email: "m.jorgex@gmail.com", role: "agent" },
  { name: "Anna Luiza", email: "anna.albc2@gmail.com", role: "agent" },
  { name: "Ali Kanso", email: "ali.kanso.br222@gmail.com", role: "agent" },
  { name: "Adv | Resolvoo", email: "barbosaluan.adv@gmail.com", role: "agent" },
];

interface SeedResult {
  success: boolean;
  results: {
    teams: { created: number; updated: number; errors: string[] };
    users: { created: number; updated: number; errors: string[] };
    roles: { created: number; updated: number; errors: string[] };
    tenants: { created: number; updated: number; errors: string[] };
    teamMembers: { created: number; updated: number; errors: string[] };
  };
  summary: string;
}

export default function SeedPage() {
  const { role, loading: authLoading, user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Wait for auth to fully load (session + user data including role)
  if (authLoading) {
    return (
      <div className="container max-w-4xl py-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If user exists but role is still null, something went wrong - show error
  if (user && role === null) {
    return (
      <div className="container max-w-4xl py-6">
        <div className="text-center text-destructive">
          Erro ao carregar permissões. Tente recarregar a página.
        </div>
      </div>
    );
  }

  // Only admins can access this page
  if (role !== "admin") {
    return <Navigate to="/inbox" replace />;
  }

  const executeSeed = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("seed-teams-users");

      if (fnError) {
        setError(fnError.message || "Erro ao executar seed");
        toast.error("Erro ao executar seed");
        return;
      }

      setResult(data as SeedResult);
      if (data?.success) {
        toast.success("Seed executado com sucesso!");
      } else {
        toast.warning("Seed executado com alguns erros");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
      toast.error("Erro ao executar seed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <PageBreadcrumb items={[{ label: "Admin" }, { label: "Seed de Dados" }]} />

      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" />
          Seed de Equipes e Usuários
        </h1>
        <p className="text-muted-foreground">
          Configure a estrutura inicial de equipes e usuários da GaranteDireito.
        </p>
      </div>

      {/* Preview Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {TEAMS_PREVIEW.length} Equipes
            </CardTitle>
            <CardDescription>Serão criadas ou atualizadas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {TEAMS_PREVIEW.map((team) => (
              <div key={team.name} className="flex items-center justify-between text-sm">
                <span>{team.name}</span>
                <div className="flex gap-1">
                  {team.isDefault && (
                    <Badge variant="default" className="text-xs">Padrão</Badge>
                  )}
                  {team.autoDistribution && (
                    <Badge variant="secondary" className="text-xs">Auto</Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              {USERS_PREVIEW.length} Usuários
            </CardTitle>
            <CardDescription>Serão criados ou atualizados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {USERS_PREVIEW.map((user) => (
              <div key={user.email} className="flex items-center justify-between text-sm">
                <span>{user.name}</span>
                <Badge variant={user.role === "admin" ? "default" : "outline"} className="text-xs">
                  {user.role}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Warning */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Atenção</AlertTitle>
        <AlertDescription>
          Todos os usuários serão criados com a senha padrão: <code className="bg-muted px-1 rounded">GaranteDireito@2026</code>
          <br />
          Recomende que troquem a senha no primeiro acesso.
        </AlertDescription>
      </Alert>

      {/* Execute Button */}
      <div className="flex justify-center">
        <Button 
          size="lg" 
          onClick={executeSeed} 
          disabled={loading}
          className="min-w-[200px]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executando...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Executar Seed
            </>
          )}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Display */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              Resultado
            </CardTitle>
            <CardDescription>{result.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {result.results.teams.created + result.results.teams.updated}
                </div>
                <div className="text-xs text-muted-foreground">Equipes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {result.results.users.created + result.results.users.updated}
                </div>
                <div className="text-xs text-muted-foreground">Usuários</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {result.results.roles.created + result.results.roles.updated}
                </div>
                <div className="text-xs text-muted-foreground">Roles</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {result.results.tenants.created + result.results.tenants.updated}
                </div>
                <div className="text-xs text-muted-foreground">Tenants</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {result.results.teamMembers.created + result.results.teamMembers.updated}
                </div>
                <div className="text-xs text-muted-foreground">Membros</div>
              </div>
            </div>

            {/* Show errors if any */}
            {Object.entries(result.results).some(([_, v]) => v.errors?.length > 0) && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium text-destructive">Erros:</h4>
                {Object.entries(result.results).map(([key, value]) => 
                  value.errors?.map((err, i) => (
                    <p key={`${key}-${i}`} className="text-sm text-destructive">
                      [{key}] {err}
                    </p>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
