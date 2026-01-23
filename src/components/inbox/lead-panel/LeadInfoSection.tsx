import { memo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, Mail, Copy, MessageSquare, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { formatPhoneNumber, toWhatsAppFormat, maskCPF } from '@/lib/masks';
import type { LeadWithRelations } from './types';

interface LeadInfoSectionProps {
  lead: LeadWithRelations;
}

function LeadInfoSectionComponent({ lead }: LeadInfoSectionProps) {
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const openWhatsApp = () => {
    window.open(`https://wa.me/${toWhatsAppFormat(lead.phone)}`, '_blank');
  };

  const qualification = lead.qualification || {};
  const caseSummary = lead.custom_fields?.case_summary;

  // Render formatted text (markdown-like)
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');

    return lines.map((line, lineIndex) => {
      let result = line;
      result = result.replace(
        /\*\*(.+?)\*\*/g,
        '\u27e8\u27e8BOLD\u27e9\u27e9$1\u27e8\u27e8/BOLD\u27e9\u27e9'
      );
      result = result.replace(
        /\*([^*\n]+)\*/g,
        '\u27e8\u27e8BOLD\u27e9\u27e9$1\u27e8\u27e8/BOLD\u27e9\u27e9'
      );
      result = result.replace(
        /_([^_\n]+)_/g,
        '\u27e8\u27e8ITALIC\u27e9\u27e9$1\u27e8\u27e8/ITALIC\u27e9\u27e9'
      );

      const parts = result.split(
        /(\u27e8\u27e8BOLD\u27e9\u27e9|\u27e8\u27e8\/BOLD\u27e9\u27e9|\u27e8\u27e8ITALIC\u27e9\u27e9|\u27e8\u27e8\/ITALIC\u27e9\u27e9)/
      );
      let inBold = false;
      let inItalic = false;

      const renderedParts = parts
        .map((part, partIndex) => {
          if (part === '\u27e8\u27e8BOLD\u27e9\u27e9') {
            inBold = true;
            return null;
          }
          if (part === '\u27e8\u27e8/BOLD\u27e9\u27e9') {
            inBold = false;
            return null;
          }
          if (part === '\u27e8\u27e8ITALIC\u27e9\u27e9') {
            inItalic = true;
            return null;
          }
          if (part === '\u27e8\u27e8/ITALIC\u27e9\u27e9') {
            inItalic = false;
            return null;
          }

          if (!part) return null;

          const linkRegex = /\(?(https?:\/\/[^\s\)]+)\)?/g;
          const linkParts = part.split(linkRegex);

          const content = linkParts.map((lp, lpIndex) => {
            if (lp?.match(/^https?:\/\//)) {
              return (
                <a
                  key={`link-${lineIndex}-${partIndex}-${lpIndex}`}
                  href={lp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Link
                </a>
              );
            }
            return lp;
          });

          if (inBold) {
            return (
              <strong key={`b-${lineIndex}-${partIndex}`} className="font-semibold">
                {content}
              </strong>
            );
          }
          if (inItalic) {
            return <em key={`i-${lineIndex}-${partIndex}`}>{content}</em>;
          }
          return <span key={`s-${lineIndex}-${partIndex}`}>{content}</span>;
        })
        .filter(Boolean);

      return (
        <span key={lineIndex} className="block">
          {renderedParts.length > 0 ? renderedParts : line}
        </span>
      );
    });
  };

  return (
    <div className="box-border min-w-0 max-w-full space-y-4 overflow-hidden p-4 pb-8">
      {/* Facebook LID Warning */}
      {lead.is_facebook_lid && (
        <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning/20">
              <span className="text-xs text-warning">!</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-warning">Numero Privado</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Contato veio de anuncio Facebook. O numero real ainda nao foi resolvido por
                privacidade.
              </p>
            </div>
          </div>
          {lead.original_lid && (
            <div className="rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
              LID: {lead.original_lid}
            </div>
          )}
        </div>
      )}

      {/* Contact Info */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium uppercase text-muted-foreground">Contato</h4>
        <div className="space-y-1.5">
          {/* Phone - with special handling for LID leads */}
          {lead.is_facebook_lid ? (
            <div className="group flex items-center gap-2 rounded-md border border-warning/20 bg-warning/5 p-2">
              <Phone className="h-3.5 w-3.5 text-warning" />
              <span className="flex-1 text-sm italic text-muted-foreground">
                Aguardando resolucao...
              </span>
              <Badge variant="outline" className="text-2xs border-warning/30 text-warning">
                Facebook
              </Badge>
            </div>
          ) : (
            <div className="group flex items-center gap-2 rounded-md bg-muted/50 p-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 text-sm">{formatPhoneNumber(lead.phone)}</span>
              <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleCopy(lead.phone, 'Telefone')}
                        aria-label="Copiar telefone"
                      >
                        <Copy className="h-2.5 w-2.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copiar telefone</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-success"
                        onClick={openWhatsApp}
                        aria-label="Abrir no WhatsApp"
                      >
                        <MessageSquare className="h-2.5 w-2.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Abrir no WhatsApp</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          )}
          {lead.email && (
            <div className="group flex items-center gap-2 rounded-md bg-muted/50 p-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate text-sm" title={lead.email}>
                {lead.email}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => handleCopy(lead.email!, 'Email')}
                      aria-label="Copiar email"
                    >
                      <Copy className="h-2.5 w-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copiar email</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {lead.cpf && (
            <div className="group flex items-center gap-2 rounded-md bg-muted/50 p-2">
              <span className="w-4 text-xs font-medium text-muted-foreground">CPF</span>
              <span className="flex-1 text-sm">{maskCPF(lead.cpf)}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => handleCopy(lead.cpf!, 'CPF')}
                      aria-label="Copiar CPF"
                    >
                      <Copy className="h-2.5 w-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copiar CPF completo</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>

      {/* Qualification */}
      {Object.keys(qualification).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase text-muted-foreground">Qualificacao</h4>
          <div className="space-y-1.5 text-sm">
            {qualification.situacao && (
              <div className="flex justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Situacao:</span>
                <span className="min-w-0 break-words text-right">{qualification.situacao}</span>
              </div>
            )}
            {qualification.condicao_saude && (
              <div className="flex justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Condicao:</span>
                <span className="min-w-0 break-words text-right">
                  {qualification.condicao_saude}
                </span>
              </div>
            )}
            {qualification.renda && (
              <div className="flex justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Renda:</span>
                <span className="min-w-0 break-words text-right">{qualification.renda}</span>
              </div>
            )}
            {qualification.idade && (
              <div className="flex justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Idade:</span>
                <span className="min-w-0 break-words text-right">{qualification.idade} anos</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Case Summary - AI */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          Resumo do Caso - IA
        </h4>
        <div className="relative overflow-hidden rounded-lg border-l-4 border-primary bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3">
          {caseSummary && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-6 w-6 opacity-50 transition-opacity hover:opacity-100"
                    onClick={() => handleCopy(caseSummary, 'Resumo')}
                    aria-label="Copiar resumo"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copiar resumo</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {caseSummary ? (
            <div className="max-h-[300px] overflow-y-auto pr-6">
              <div className="whitespace-pre-wrap break-words text-sm text-foreground [overflow-wrap:anywhere]">
                {renderFormattedText(caseSummary)}
              </div>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">Nenhum resumo disponivel</p>
          )}
        </div>
      </div>

      {/* Stage & Source */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium uppercase text-muted-foreground">Informacoes</h4>
        <div className="space-y-1.5 text-sm">
          {lead.funnel_stages && (
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-muted-foreground">Etapa:</span>
              <Badge
                variant="outline"
                className="max-w-[60%] truncate text-xs"
                style={{
                  borderColor: lead.funnel_stages.color,
                  color: lead.funnel_stages.color,
                }}
                title={lead.funnel_stages.name}
              >
                {lead.funnel_stages.name}
              </Badge>
            </div>
          )}
          {lead.funnel_stages?.grupo && (
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-muted-foreground">Grupo:</span>
              <span className="min-w-0 break-words text-right">{lead.funnel_stages.grupo}</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">Origem:</span>
            <span className="min-w-0 break-words text-right">{lead.source || 'Nao informada'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">Criado:</span>
            <span>
              {lead.created_at
                ? format(new Date(lead.created_at), 'dd/MM/yyyy', {
                    locale: ptBR,
                  })
                : 'Nao informado'}
            </span>
          </div>
          {lead.estimated_value && (
            <div className="flex justify-between gap-2">
              <span className="shrink-0 text-muted-foreground">Valor:</span>
              <span className="font-medium text-success">
                R$ {lead.estimated_value.toLocaleString('pt-BR')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const LeadInfoSection = memo(LeadInfoSectionComponent);
