import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadProgress {
  progress: number;
  uploading: boolean;
}

export function useFileUpload() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    progress: 0,
    uploading: false,
  });

  const uploadFile = async (file: File, folder: string = 'attachments'): Promise<string | null> => {
    try {
      setUploadProgress({ progress: 0, uploading: true });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar logado para enviar arquivos');
        return null;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${folder}/${Date.now()}.${fileExt}`;

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }));
      }, 100);

      const { data, error } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      clearInterval(progressInterval);

      if (error) {
        console.error('Upload error:', error);
        toast.error('Erro ao enviar arquivo');
        setUploadProgress({ progress: 0, uploading: false });
        return null;
      }

      setUploadProgress({ progress: 100, uploading: false });

      // Retornar storage ref em vez de publicUrl (bucket é privado)
      // Frontend vai gerar signed URL quando precisar exibir
      const storageRef = `storage://message-attachments/${data.path}`;
      return storageRef;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar arquivo');
      setUploadProgress({ progress: 0, uploading: false });
      return null;
    }
  };

  const getFileType = (file: File): 'image' | 'video' | 'audio' | 'document' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  return {
    uploadFile,
    uploadProgress,
    getFileType,
  };
}
