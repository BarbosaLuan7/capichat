import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface CodeExampleProps {
  code: string;
  language?: string;
  title?: string;
}

export function CodeExample({ code, language, title }: CodeExampleProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      {title && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">{title}</p>
          {language && (
            <span className="text-xs text-muted-foreground uppercase">{language}</span>
          )}
        </div>
      )}
      <div className="relative">
        <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto font-mono">
          {code}
        </pre>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
          onClick={handleCopy}
          aria-label="Copiar código"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
