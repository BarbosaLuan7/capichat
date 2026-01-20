import { useState, useEffect, forwardRef } from 'react';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/integrations/supabase/types';

type LabelCategory = Database['public']['Enums']['label_category'];
type LabelRow = Database['public']['Tables']['labels']['Row'];

interface LabelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: LabelRow | null;
  onSave: (data: { name: string; color: string; category: LabelCategory }) => void;
  isLoading?: boolean;
}

const COLORS = [
  { name: 'Vermelho', value: '#EF4444' },
  { name: 'Laranja', value: '#F97316' },
  { name: 'Amarelo', value: '#EAB308' },
  { name: 'Verde', value: '#22C55E' },
  { name: 'Azul', value: '#3B82F6' },
  { name: 'Roxo', value: '#8B5CF6' },
  { name: 'Rosa', value: '#EC4899' },
  { name: 'Cinza', value: '#6B7280' },
  { name: 'Ciano', value: '#06B6D4' },
  { name: 'Índigo', value: '#6366F1' },
];

const CATEGORIES: { value: LabelCategory; label: string }[] = [
  { value: 'origem', label: 'Origem/Campanha' },
  { value: 'beneficio', label: 'Tipo de Benefício' },
  { value: 'condicao_saude', label: 'Condição de Saúde' },
  { value: 'prioridade', label: 'Prioridade' },
  { value: 'status', label: 'Status' },
  { value: 'interesse', label: 'Interesse' },
  { value: 'desqualificacao', label: 'Desqualificação' },
];

// Zod schema para validação
const labelSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(50, 'Nome muito longo (máx. 50 caracteres)')
    .regex(/^[a-zA-Z0-9À-ÿ\s\-_/]+$/, 'Nome contém caracteres inválidos'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida'),
  category: z.enum([
    'origem',
    'beneficio',
    'condicao_saude',
    'prioridade',
    'status',
    'interesse',
    'desqualificacao',
  ]),
});

export const LabelModal = forwardRef<HTMLDivElement, LabelModalProps>(function LabelModal(
  { open, onOpenChange, label, onSave, isLoading = false },
  _ref
) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [category, setCategory] = useState<LabelCategory>('status');

  useEffect(() => {
    if (label) {
      setName(label.name);
      setColor(label.color);
      setCategory(label.category);
    } else {
      setName('');
      setColor('#3B82F6');
      setCategory('status');
    }
  }, [label, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = labelSchema.safeParse({ name: name.trim(), color, category });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    onSave({ name: name.trim(), color, category });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label ? 'Editar Etiqueta' : 'Nova Etiqueta'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Preview */}
          <div className="flex items-center justify-center rounded-lg bg-muted/30 p-4">
            <Badge style={{ backgroundColor: color }} className="px-3 py-1 text-sm text-white">
              {name || 'Preview da Etiqueta'}
            </Badge>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Etiqueta</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Facebook Ads, BPC Idoso..."
              autoFocus
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as LabelCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seletor de Cor */}
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="grid grid-cols-5 gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`h-10 w-10 rounded-lg transition-all hover:scale-110 ${
                    color === c.value ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="gradient-primary text-primary-foreground"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {label ? 'Salvar' : 'Criar Etiqueta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

LabelModal.displayName = 'LabelModal';
