import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Phone,
  Mail,
  Calendar,
  Eye,
  Pencil,
  Trash2,
  MessageSquare,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LeadAvatar } from '@/components/ui/lead-avatar';
import { TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, getContrastColor } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type Label = { id: string; name: string; color: string };
type Stage = { id: string; name: string; color: string } | null;

interface LeadTableRowProps {
  lead: Lead & { lead_labels?: any[] };
  index: number;
  isSelected: boolean;
  stage: Stage;
  labels: Label[];
  onSelect: (id: string) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenConversation: (id: string) => void;
}

function LeadTableRowComponent({
  lead,
  index,
  isSelected,
  stage,
  labels,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onOpenConversation,
}: LeadTableRowProps) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.15) }}
      className="group"
    >
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(lead.id)}
          aria-label={`Selecionar lead ${lead.name}`}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <LeadAvatar lead={lead} size="md" />
          <div>
            <p className="font-medium text-foreground">{lead.name}</p>
            <div className="mt-1 flex items-center gap-1">
              {labels.slice(0, 2).map((label) => (
                <Badge
                  key={label.id}
                  className="h-5 border-0 text-xs"
                  style={{ backgroundColor: label.color, color: getContrastColor(label.color) }}
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            {lead.phone}
          </div>
          {lead.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              <span className="max-w-[150px] truncate">{lead.email}</span>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="font-medium"
          style={{ borderColor: stage?.color, color: stage?.color }}
        >
          {stage?.name}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          className={cn(
            lead.temperature === 'hot' && 'bg-destructive/10 text-destructive',
            lead.temperature === 'warm' && 'bg-warning/10 text-warning',
            lead.temperature === 'cold' && 'bg-primary/10 text-primary'
          )}
        >
          {lead.temperature === 'hot'
            ? '🔥 Quente'
            : lead.temperature === 'warm'
              ? '🌡️ Morno'
              : '❄️ Frio'}
        </Badge>
      </TableCell>
      <TableCell>
        {lead.estimated_value ? (
          <span className="font-semibold text-success">
            R$ {lead.estimated_value.toLocaleString('pt-BR')}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground">{lead.source}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {format(new Date(lead.created_at), 'dd/MM/yyyy', { locale: ptBR })}
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100"
              aria-label="Mais opções"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2" onClick={() => onView(lead.id)}>
              <Eye className="h-4 w-4" />
              Ver detalhes
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={() => onOpenConversation(lead.id)}>
              <MessageSquare className="h-4 w-4" />
              Abrir conversa
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={() => onEdit(lead.id)}>
              <Pencil className="h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => onDelete(lead.id)}>
              <Trash2 className="h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </motion.tr>
  );
}

export const LeadTableRow = memo(LeadTableRowComponent, (prev, next) => {
  return (
    prev.lead.id === next.lead.id &&
    prev.lead.updated_at === next.lead.updated_at &&
    prev.isSelected === next.isSelected &&
    prev.stage?.id === next.stage?.id &&
    prev.labels.length === next.labels.length
  );
});
