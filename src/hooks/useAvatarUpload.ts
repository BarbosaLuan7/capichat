import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface UploadResult {
  url: string | null;
  error: string | null;
}

export function useAvatarUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Tipo de arquivo não permitido. Use JPG, PNG, GIF ou WebP.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Arquivo muito grande. Máximo 5MB.';
    }
    return null;
  };

  const uploadAvatar = async (file: File, userId: string): Promise<UploadResult> => {
    const validationError = validateFile(file);
    if (validationError) {
      return { url: null, error: validationError };
    }

    setUploading(true);
    setProgress(0);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      // Delete old avatars for this user
      const { data: existingFiles } = await supabase.storage
        .from('avatars')
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${userId}/${f.name}`);
        await supabase.storage.from('avatars').remove(filesToDelete);
      }

      setProgress(30);

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      setProgress(70);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar: urlData.publicUrl })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      setProgress(100);
      toast.success('Foto de perfil atualizada!');
      
      return { url: urlData.publicUrl, error: null };
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao fazer upload da foto';
      toast.error(errorMessage);
      return { url: null, error: errorMessage };
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const removeAvatar = async (userId: string): Promise<boolean> => {
    setUploading(true);
    try {
      // Delete all avatars for this user
      const { data: existingFiles } = await supabase.storage
        .from('avatars')
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${userId}/${f.name}`);
        await supabase.storage.from('avatars').remove(filesToDelete);
      }

      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar: null })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      toast.success('Foto de perfil removida!');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Erro ao remover foto');
      return false;
    } finally {
      setUploading(false);
    }
  };

  return { uploadAvatar, removeAvatar, uploading, progress };
}
