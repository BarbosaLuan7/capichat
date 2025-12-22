import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCreateTemplate, useUpdateTemplate } from '@/hooks/useTemplates';
import { toast } from 'sonner';
import { Zap, Copy, Eye } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Template = Database['public']['Tables']['templates']['Row'];

interface TemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template | null;
}

const AVAILABLE_VARIABLES = [
  { key: '{{nome}}', label: 'Nome do Lead', description: 'Nome do lead' },
  { key: '{{telefone}}', label: 'Telefone', description: 'Telefone do lead' },
  { key: '{{beneficio}}', label: 'Benefício', description: 'Tipo de benefício' },
  { key: '{{data}}', label: 'Data', description: 'Data atual' },
  { key: '{{atendente}}', label: 'Atendente', description: 'Nome do atendente' },
];

export function TemplateModal({ open, onOpenChange, template }: TemplateModalProps) {
  const [name, setName] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [content, setContent] = useState('');

  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const isEditing = !!template;

  useEffect(() => {
    if (template) {
      setName(template.name);
      setShortcut(template.shortcut);
      setContent(template.content);
    } else {
      setName('');
      setShortcut('');
      setContent('');
    }
  }, [template, open]);

  const handleInsertVariable = (variable: string) => {
    setContent((prev) => prev + variable);
  };

  const handleCopyShortcut = () => {
    navigator.clipboard.writeText(`/${shortcut}`);
    toast.success('Atalho copiado!');
  };

  const getPreviewContent = () => {
    return content
      .replace(/\{\{nome\}\}/g, 'Maria Silva')
      .replace(/\{\{telefone\}\}/g, '(11) 99999-9999')
      .replace(/\{\{beneficio\}\}/g, 'BPC/LOAS')
      .replace(/\{\{data\}\}/g, new Date().toLocaleDateString('pt-BR'))
      .replace(/\{\{atendente\}\}/g, 'Dra. Ana');
  };

  const handleSubmit = async () => {
    if (!name.trim() || !shortcut.trim() || !content.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validate shortcut format (no spaces, lowercase)
    const cleanShortcut = shortcut.toLowerCase().replace(/\s+/g, '-');

    try {
      if (isEditing && template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          name: name.trim(),
          shortcut: cleanShortcut,
          content: content.trim(),
        });
        toast.success('Template atualizado com sucesso!');
      } else {
        await createTemplate.mutateAsync({
          name: name.trim(),
          shortcut: cleanShortcut,
          content: content.trim(),
        });
        toast.success('Template criado com sucesso!');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao salvar template');
    }
  };

  const isLoading = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {isEditing ? 'Editar Template' : 'Novo Template'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Edite as informações do template de mensagem'
              : 'Crie um novo template para mensagens rápidas'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Nome e Atalho */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Template *</Label>
              <Input
                id="name"
                placeholder="Ex: Boas-vindas BPC"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortcut">Atalho *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    /
                  </span>
                  <Input
                    id="shortcut"
                    placeholder="boas-vindas"
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    className="pl-7"
                  />
                </div>
                {shortcut && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyShortcut}
                    title="Copiar atalho"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Digite /{shortcut || 'atalho'} no chat para usar
              </p>
            </div>
          </div>

          {/* Variáveis Disponíveis */}
          <div className="space-y-2">
            <Label>Variáveis Disponíveis</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VARIABLES.map((variable) => (
                <Badge
                  key={variable.key}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
                  onClick={() => handleInsertVariable(variable.key)}
                  title={variable.description}
                >
                  {variable.key}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Clique nas variáveis para inserir no conteúdo
            </p>
          </div>

          {/* Conteúdo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Conteúdo da Mensagem *</Label>
              <span className="text-xs text-muted-foreground">
                {content.length} caracteres
              </span>
            </div>
            <Textarea
              id="content"
              placeholder="Olá {{nome}}! Seja bem-vindo(a) à GaranteDireito..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          {/* Preview */}
          {content && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview da Mensagem
              </Label>
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm whitespace-pre-wrap">{getPreviewContent()}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !name.trim() || !shortcut.trim() || !content.trim()}
            className="bg-gradient-to-r from-primary to-primary/80"
          >
            {isLoading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
