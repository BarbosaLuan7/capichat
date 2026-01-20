import { useState, useEffect, memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useLeadAvatarFetch } from '@/hooks/useLeadAvatarFetch';

interface LeadData {
  id: string;
  name: string;
  phone?: string | null;
  avatar_url?: string | null;
}

interface LeadAvatarProps {
  lead: LeadData;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-16 h-16',
};

function LeadAvatarComponent({ lead, className, size = 'md' }: LeadAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(lead.avatar_url || null);
  const [imageError, setImageError] = useState(false);
  const { fetchAvatar, clearAttemptCache } = useLeadAvatarFetch();

  // Sincronizar com props quando lead muda
  useEffect(() => {
    if (lead.avatar_url) {
      setAvatarUrl(lead.avatar_url);
      setImageError(false);
    }
  }, [lead.avatar_url]);

  // Tentar buscar avatar em background se não tem
  useEffect(() => {
    if (!avatarUrl && lead.phone && lead.id) {
      fetchAvatar(lead.id, lead.phone).then((url) => {
        if (url) setAvatarUrl(url);
      });
    }
  }, [lead.id, lead.phone, avatarUrl, fetchAvatar]);

  // Handler para quando a imagem falha ao carregar
  const handleImageError = () => {
    if (avatarUrl && !imageError) {
      setImageError(true);
      // Limpar cache para permitir nova tentativa na próxima vez
      clearAttemptCache(lead.id);
      // Usar fallback (DiceBear)
      setAvatarUrl(null);
    }
  };

  const displayUrl = avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.name}`;
  const initial = lead.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={displayUrl} alt={lead.name} onError={handleImageError} />
      <AvatarFallback>{initial}</AvatarFallback>
    </Avatar>
  );
}

export const LeadAvatar = memo(LeadAvatarComponent, (prev, next) => {
  return (
    prev.lead.id === next.lead.id &&
    prev.lead.avatar_url === next.lead.avatar_url &&
    prev.lead.name === next.lead.name &&
    prev.size === next.size &&
    prev.className === next.className
  );
});
