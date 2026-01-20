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
    <div className="group relative">
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">{title}</p>
          {language && <span className="text-xs uppercase text-muted-foreground">{language}</span>}
        </div>
      )}
      <div className="relative">
        <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs">{code}</pre>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 bg-background/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          onClick={handleCopy}
          aria-label="Copiar código"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
