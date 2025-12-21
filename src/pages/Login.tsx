import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const [email, setEmail] = useState('carlos@leadflow.com');
  const [password, setPassword] = useState('demo123');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        toast({
          title: 'Bem-vindo ao LeadFlow!',
          description: 'Login realizado com sucesso.',
        });
        navigate('/dashboard');
      } else {
        toast({
          title: 'Erro no login',
          description: 'Email ou senha incorretos.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-primary-foreground">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 backdrop-blur flex items-center justify-center">
                <MessageSquare className="w-7 h-7" />
              </div>
              <span className="text-3xl font-bold">LeadFlow</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
              Gerencie seus leads e conversas em um só lugar
            </h1>

            <p className="text-lg xl:text-xl text-primary-foreground/80 mb-12 max-w-lg">
              CRM inteligente integrado com WhatsApp para transformar conversas em vendas.
            </p>

            <div className="space-y-4">
              {[
                'Atendimento unificado via WhatsApp',
                'Funil de vendas visual e intuitivo',
                'Automações para aumentar produtividade',
              ].map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-6 h-6 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <span className="text-primary-foreground/90">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute top-20 -right-20 w-72 h-72 bg-accent/20 rounded-full blur-3xl" />
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">LeadFlow</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Acesse sua conta
            </h2>
            <p className="text-muted-foreground">
              Entre com suas credenciais para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-border" />
                <span className="text-muted-foreground">Lembrar de mim</span>
              </label>
              <a href="#" className="text-primary hover:underline font-medium">
                Esqueci a senha
              </a>
            </div>

            <Button
              type="submit"
              className="w-full h-12 gradient-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground text-center mb-3">
              <strong>Demo:</strong> Use as credenciais abaixo para testar
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Admin:</p>
                <p className="font-mono text-foreground">carlos@leadflow.com</p>
              </div>
              <div>
                <p className="text-muted-foreground">Atendente:</p>
                <p className="font-mono text-foreground">pedro@leadflow.com</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
