import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiStatusBadgeProps {
  baseUrl: string;
}

export function ApiStatusBadge({ baseUrl }: ApiStatusBadgeProps) {
  const [status, setStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${baseUrl}/api-users`, {
          method: 'HEAD',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        // 401 means the API is up (just needs auth)
        setStatus(response.ok || response.status === 401 ? 'online' : 'offline');
      } catch {
        setStatus('offline');
      }
    };

    checkStatus();
    // Recheck every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [baseUrl]);

  if (status === 'checking') {
    return (
      <Badge variant="outline" className="gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        Verificando...
      </Badge>
    );
  }

  return (
    <Badge 
      variant={status === 'online' ? 'default' : 'destructive'}
      className={cn(
        "gap-1.5",
        status === 'online' && "bg-green-600 hover:bg-green-700"
      )}
    >
      <Circle className={cn(
        "w-2 h-2 fill-current",
        status === 'online' && "animate-pulse"
      )} />
      {status === 'online' ? 'API Online' : 'API Offline'}
    </Badge>
  );
}
