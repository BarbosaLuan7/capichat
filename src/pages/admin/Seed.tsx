import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Building2, CheckCircle2, XCircle, AlertTriangle, Database, Crown, Bot, Plane, Scale, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { cn } from "@/lib/utils";

// ====== ESTRUTURA LB ADV ======

const TENANT = {
  id: '8aa3e1e6-d96a-4efe-bb0b-7e49df710d25',
  name: 'LB ADV',
  slug: 'lb-adv',
  fullName: 'Luan Barbosa | Advocacia Especializada',
  description: 'Escritório de advocacia especializado em direito previdenciário e do consumidor',
};

// Equipe extra a ser removida
const EXTRA_TEAM_ID = '6aebcfb2-561e-49c9-997f-3c263c26e3a6';

interface TeamConfig {
  id: string;
  name: string;
  area: 'previdenciario' | 'consumidor' | 'automacao';
  accessLevel: 'all' | 'team' | 'attendant';
  autoDistribution: boolean;
  isDefault: boolean;
  description: string;
}

const TEAMS: TeamConfig[] = [
  // ÁREA PREVIDENCIÁRIA (GaranteDireito)
  {
    id: '19eac12b-a427-452d-9ab5-be18eb529045',
    name: 'GD | Previdenciário 👴',
    area: 'previdenciario',
    accessLevel: 'team',
    autoDistribution: true,
    isDefault: true,
    description: 'Atendimento inicial de casos INSS/BPC',
  },
  {
    id: '66292225-4ced-456a-acc4-9d475b5e2fb4',
    name: 'GD | Andamento - Prev ⚖️',
    area: 'previdenciario',
    accessLevel: 'team',
    autoDistribution: false,
    isDefault: false,
    description: 'Acompanhamento de processos em andamento',
  },
  // ÁREA CONSUMIDOR (Resolvoo)
  {
    id: '9f32e277-aa4a-4bf3-ad5a-d072aa59d04a',
    name: '💜 Resolvoo | Atendimento Inicial',
    area: 'consumidor',
    accessLevel: 'team',
    autoDistribution: false,
    isDefault: false,
    description: 'Atendimento inicial de casos aéreos/consumidor',
  },
  {
    id: 'bf98ceb1-4271-4da6-9398-889be5fa5461',
    name: '📁 Resolvoo | Andamento Processual',
    area: 'consumidor',
    accessLevel: 'team',
    autoDistribution: false,
    isDefault: false,
    description: 'Acompanhamento de processos Resolvoo',
  },
  // AUTOMAÇÃO
  {
    id: '0c21f025-21b5-423d-be16-663eb9c2138b',
    name: 'IA - CAPI',
    area: 'automacao',
    accessLevel: 'attendant',
    autoDistribution: false,
    isDefault: false,
    description: 'Atendimento automatizado via IA',
  },
];

interface UserConfig {
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'agent';
  isAvailable: boolean;
  teams: Array<{ teamId: string; isSupervisor: boolean }>;
}

const USERS: UserConfig[] = [
  // ADMINS
  {
    name: 'Thaw',
    email: 'thawanrmichels@gmail.com',
    phone: '5541984406340',
    role: 'admin',
    isAvailable: false,
    teams: [{ teamId: '0c21f025-21b5-423d-be16-663eb9c2138b', isSupervisor: false }],
  },
  {
    name: 'Natalia Müller',
    email: 'najosoraal@gmail.com',
    phone: '5545999937713',
    role: 'admin',
    isAvailable: false,
    teams: [{ teamId: 'bf98ceb1-4271-4da6-9398-889be5fa5461', isSupervisor: false }],
  },
  {
    name: 'Luana Maestrelo',
    email: 'maestreloluana@gmail.com',
    phone: '5545999215298',
    role: 'admin',
    isAvailable: false,
    teams: [
      { teamId: '66292225-4ced-456a-acc4-9d475b5e2fb4', isSupervisor: false },
      { teamId: '19eac12b-a427-452d-9ab5-be18eb529045', isSupervisor: false },
    ],
  },
  {
    name: 'Luan',
    email: 'luan@luan.com',
    phone: '',
    role: 'admin',
    isAvailable: false,
    teams: [],
  },
  // AGENTS
  {
    name: 'Marina Barbosa',
    email: 'matorresprado@hotmail.com',
    phone: '5545991159994',
    role: 'agent',
    isAvailable: false,
    teams: [
      { teamId: 'bf98ceb1-4271-4da6-9398-889be5fa5461', isSupervisor: false },
      { teamId: '66292225-4ced-456a-acc4-9d475b5e2fb4', isSupervisor: false },
      { teamId: '19eac12b-a427-452d-9ab5-be18eb529045', isSupervisor: false },
    ],
  },
  {
    name: 'Lunny Sander',
    email: 'adv.lunnysander@gmail.com',
    phone: '5545988300704',
    role: 'agent',
    isAvailable: false,
    teams: [{ teamId: '19eac12b-a427-452d-9ab5-be18eb529045', isSupervisor: false }],
  },
  {
    name: 'Jorge Moreira',
    email: 'm.jorgex@gmail.com',
    phone: '5542998274330',
    role: 'agent',
    isAvailable: true,
    teams: [{ teamId: '9f32e277-aa4a-4bf3-ad5a-d072aa59d04a', isSupervisor: true }],
  },
  {
    name: 'Anna Luiza',
    email: 'anna.albc2@gmail.com',
    phone: '5545984280988',
    role: 'agent',
    isAvailable: true,
    teams: [{ teamId: '19eac12b-a427-452d-9ab5-be18eb529045', isSupervisor: true }],
  },
  {
    name: 'Ali Kanso',
    email: 'ali.kanso.br222@gmail.com',
    phone: '5545998476100',
    role: 'agent',
    isAvailable: true,
    teams: [{ teamId: '19eac12b-a427-452d-9ab5-be18eb529045', isSupervisor: true }],
  },
  {
    name: 'Adv | Resolvoo',
    email: 'barbosaluan.adv@gmail.com',
    phone: '5545988419964',
    role: 'agent',
    isAvailable: false,
    teams: [{ teamId: 'bf98ceb1-4271-4da6-9398-889be5fa5461', isSupervisor: false }],
  },
];

// Helper functions
const getTeamById = (id: string) => TEAMS.find(t => t.id === id);
const getTeamsByArea = (area: TeamConfig['area']) => TEAMS.filter(t => t.area === area);
const getUsersByTeam = (teamId: string) => USERS.filter(u => u.teams.some(t => t.teamId === teamId));
const getSupervisorsByTeam = (teamId: string) => 
  USERS.filter(u => u.teams.some(t => t.teamId === teamId && t.isSupervisor));

interface SeedResult {
  success: boolean;
  results: {
    tenant: { updated: boolean; error?: string };
    cleanupTeam: { deleted: boolean; whatsappMoved: number; error?: string };
    teams: { created: number; updated: number; errors: string[] };
    users: { created: number; updated: number; errors: string[] };
    roles: { created: number; updated: number; errors: string[] };
    teamMembers: { created: number; deleted: number; errors: string[] };
  };
  summary: string;
}

interface SeedOptions {
  updateTenant: boolean;
  cleanupExtraTeam: boolean;
  updateTeams: boolean;
  updateUsers: boolean;
}

// Component for rendering team tree item
function TeamTreeItem({ team, isLast }: { team: TeamConfig; isLast: boolean }) {
  const members = getUsersByTeam(team.id);
  const supervisors = getSupervisorsByTeam(team.id);
  
  return (
    <div className="ml-4">
      <div className="flex items-center gap-2 py-1">
        <span className="text-muted-foreground">{isLast ? '└──' : '├──'}</span>
        <span className="font-medium">{team.name}</span>
        <div className="flex gap-1">
          {team.isDefault && <Badge variant="default" className="text-xs">Padrão</Badge>}
          {team.autoDistribution && <Badge variant="secondary" className="text-xs">Auto</Badge>}
          {team.accessLevel === 'attendant' && <Badge variant="outline" className="text-xs">attendant</Badge>}
        </div>
      </div>
      <div className="ml-8 text-sm text-muted-foreground flex items-center gap-1">
        <span>{isLast ? ' ' : '│'}</span>
        <span className="ml-3">└── 👥 {members.length} membros: </span>
        <span>
          {members.map((m, i) => {
            const isSupervisor = m.teams.find(t => t.teamId === team.id)?.isSupervisor;
            return (
              <span key={m.email}>
                {m.name.split(' ')[0]}{isSupervisor ? ' (S)' : ''}
                {i < members.length - 1 ? ', ' : ''}
              </span>
            );
          })}
        </span>
      </div>
    </div>
  );
}

// Component for rendering area section
function AreaSection({ 
  title, 
  icon: Icon, 
  area, 
  className 
}: { 
  title: string; 
  icon: React.ElementType; 
  area: TeamConfig['area'];
  className?: string;
}) {
  const teams = getTeamsByArea(area);
  
  return (
    <div className={cn("border-l-2 pl-4 ml-2", className)}>
      <div className="flex items-center gap-2 font-semibold py-1">
        <Icon className="h-4 w-4" />
        <span>{title}</span>
      </div>
      {teams.map((team, i) => (
        <TeamTreeItem key={team.id} team={team} isLast={i === teams.length - 1} />
      ))}
    </div>
  );
}

export default function SeedPage() {
  const { role, loading: authLoading, user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<SeedOptions>({
    updateTenant: true,
    cleanupExtraTeam: true,
    updateTeams: true,
    updateUsers: true,
  });

  // Wait for auth to fully load
  if (authLoading) {
    return (
      <div className="container max-w-5xl py-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error handling
  if (user && role === null) {
    return (
      <div className="container max-w-5xl py-6">
        <div className="text-center text-destructive">
          Erro ao carregar permissões. Tente recarregar a página.
        </div>
      </div>
    );
  }

  // Only admins can access
  if (role !== "admin") {
    return <Navigate to="/inbox" replace />;
  }

  const executeSeed = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("seed-teams-users", {
        body: { options },
      });

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

  // Stats
  const totalTeams = TEAMS.length;
  const totalUsers = USERS.length;
  const totalAdmins = USERS.filter(u => u.role === 'admin').length;
  const totalAgents = USERS.filter(u => u.role === 'agent').length;
  const totalSupervisors = USERS.filter(u => u.teams.some(t => t.isSupervisor)).length;

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <PageBreadcrumb items={[{ label: "Admin" }, { label: "Configuração Inicial" }]} />

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" />
          Configuração Inicial - {TENANT.name}
        </h1>
        <p className="text-muted-foreground">
          {TENANT.fullName}
        </p>
        <p className="text-sm text-muted-foreground">
          {TENANT.description}
        </p>
      </div>

      {/* Tree Structure */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Estrutura Organizacional
          </CardTitle>
          <CardDescription>Visualização da estrutura de equipes e membros</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-sm space-y-1 bg-muted/30 p-4 rounded-lg overflow-x-auto">
            {/* Root */}
            <div className="font-bold text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {TENANT.name}
            </div>
            
            {/* Areas */}
            <AreaSection 
              title="ÁREA PREVIDENCIÁRIA (GaranteDireito)" 
              icon={Scale} 
              area="previdenciario"
              className="border-l-amber-500"
            />
            
            <AreaSection 
              title="ÁREA CONSUMIDOR (Resolvoo)" 
              icon={Plane} 
              area="consumidor"
              className="border-l-purple-500"
            />
            
            <AreaSection 
              title="AUTOMAÇÃO" 
              icon={Bot} 
              area="automacao"
              className="border-l-cyan-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-primary">{totalTeams}</div>
            <div className="text-sm text-muted-foreground">Equipes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-primary">{totalUsers}</div>
            <div className="text-sm text-muted-foreground">Usuários</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-amber-500">{totalAdmins}</div>
            <div className="text-sm text-muted-foreground">Admins</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-blue-500">{totalAgents}</div>
            <div className="text-sm text-muted-foreground">Agents</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-green-500">{totalSupervisors}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Crown className="h-3 w-3" /> Supervisores
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Opções de Execução</CardTitle>
          <CardDescription>Selecione o que deseja atualizar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="updateTenant" 
                checked={options.updateTenant}
                onCheckedChange={(checked) => setOptions(prev => ({ ...prev, updateTenant: !!checked }))}
              />
              <Label htmlFor="updateTenant" className="flex-1">
                <span className="font-medium">Atualizar Tenant</span>
                <span className="text-muted-foreground ml-2">→ Mudar nome para "{TENANT.name}"</span>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cleanupExtraTeam" 
                checked={options.cleanupExtraTeam}
                onCheckedChange={(checked) => setOptions(prev => ({ ...prev, cleanupExtraTeam: !!checked }))}
              />
              <Label htmlFor="cleanupExtraTeam" className="flex-1">
                <span className="font-medium">Limpar equipe extra "GaranteDireito"</span>
                <span className="text-muted-foreground ml-2">→ Mover WhatsApp configs e deletar</span>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="updateTeams" 
                checked={options.updateTeams}
                onCheckedChange={(checked) => setOptions(prev => ({ ...prev, updateTeams: !!checked }))}
              />
              <Label htmlFor="updateTeams" className="flex-1">
                <span className="font-medium">Atualizar Equipes</span>
                <span className="text-muted-foreground ml-2">→ Sincronizar as {TEAMS.length} equipes definidas</span>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="updateUsers" 
                checked={options.updateUsers}
                onCheckedChange={(checked) => setOptions(prev => ({ ...prev, updateUsers: !!checked }))}
              />
              <Label htmlFor="updateUsers" className="flex-1">
                <span className="font-medium">Atualizar Usuários</span>
                <span className="text-muted-foreground ml-2">→ Sincronizar {USERS.length} usuários e suas associações</span>
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Atenção</AlertTitle>
        <AlertDescription>
          Todos os novos usuários serão criados com a senha padrão: <code className="bg-muted px-1 rounded">GaranteDireito@2026</code>
          <br />
          Recomende que troquem a senha no primeiro acesso.
        </AlertDescription>
      </Alert>

      {/* Execute Button */}
      <div className="flex justify-center">
        <Button 
          size="lg" 
          onClick={executeSeed} 
          disabled={loading || !Object.values(options).some(Boolean)}
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
          <CardContent className="space-y-4">
            {/* Tenant */}
            {result.results.tenant && (
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium">Tenant:</span>
                {result.results.tenant.updated ? (
                  <Badge variant="default">Atualizado</Badge>
                ) : result.results.tenant.error ? (
                  <Badge variant="destructive">{result.results.tenant.error}</Badge>
                ) : (
                  <Badge variant="secondary">Não alterado</Badge>
                )}
              </div>
            )}

            {/* Cleanup */}
            {result.results.cleanupTeam && (
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium">Limpeza equipe extra:</span>
                {result.results.cleanupTeam.deleted ? (
                  <Badge variant="default">Deletada ({result.results.cleanupTeam.whatsappMoved} WhatsApp configs movidos)</Badge>
                ) : result.results.cleanupTeam.error ? (
                  <Badge variant="destructive">{result.results.cleanupTeam.error}</Badge>
                ) : (
                  <Badge variant="secondary">Não encontrada</Badge>
                )}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center pt-4">
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
                  {result.results.teamMembers.created}
                </div>
                <div className="text-xs text-muted-foreground">Membros de Equipe</div>
              </div>
            </div>

            {/* Show errors if any */}
            {[
              ...result.results.teams.errors,
              ...result.results.users.errors,
              ...result.results.roles.errors,
              ...result.results.teamMembers.errors,
            ].length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium text-destructive">Erros:</h4>
                {result.results.teams.errors.map((err, i) => (
                  <p key={`teams-${i}`} className="text-sm text-destructive">[teams] {err}</p>
                ))}
                {result.results.users.errors.map((err, i) => (
                  <p key={`users-${i}`} className="text-sm text-destructive">[users] {err}</p>
                ))}
                {result.results.roles.errors.map((err, i) => (
                  <p key={`roles-${i}`} className="text-sm text-destructive">[roles] {err}</p>
                ))}
                {result.results.teamMembers.errors.map((err, i) => (
                  <p key={`members-${i}`} className="text-sm text-destructive">[teamMembers] {err}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
