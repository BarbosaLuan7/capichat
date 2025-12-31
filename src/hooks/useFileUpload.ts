import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface UploadProgress {
  progress: number;
  uploading: boolean;
}

// BUG-04 FIX: File validation constants
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'],
  video: ['mp4', 'mov', 'avi', 'webm'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'opus', 'mpeg'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'],
};

const BLOCKED_EXTENSIONS = ['exe', 'sh', 'bat', 'cmd', 'msi', 'js', 'jsx', 'ts', 'tsx', 'php', 'py', 'rb', 'pl', 'ps1', 'vbs', 'dll', 'so', 'dylib'];

const MAX_FILE_SIZE_MB = 25;

// Get all allowed extensions flat
const ALL_ALLOWED_EXTENSIONS = Object.values(ALLOWED_EXTENSIONS).flat();

interface FileValidationResult {
  valid: boolean;
  error?: string;
}

function validateFile(file: File): FileValidationResult {
  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    return { valid: false, error: `Arquivo muito grande. Máximo ${MAX_FILE_SIZE_MB}MB` };
  }

  // Get extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  if (!ext) {
    return { valid: false, error: 'Arquivo sem extensão' };
  }

  // Check blocked extensions
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Tipo de arquivo não permitido: .${ext}` };
  }

  // Check allowed extensions
  if (!ALL_ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Extensão não suportada: .${ext}` };
  }

  return { valid: true };
}

export function useFileUpload() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    progress: 0,
    uploading: false,
  });

  const uploadFile = async (file: File, folder: string = 'attachments'): Promise<string | null> => {
    const UPLOAD_TIMEOUT_MS = 60000; // 60 seconds timeout

    try {
      // BUG-04 FIX: Validate file before uploading
      const validation = validateFile(file);
      if (!validation.valid) {
        toast.error(validation.error || 'Arquivo inválido');
        return null;
      }

      setUploadProgress({ progress: 0, uploading: true });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar logado para enviar arquivos');
        setUploadProgress({ progress: 0, uploading: false });
        return null;
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${user.id}/${folder}/${Date.now()}.${fileExt}`;

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }));
      }, 100);

      // Create promise with timeout
      const uploadPromise = supabase.storage
        .from('message-attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('UPLOAD_TIMEOUT'));
        }, UPLOAD_TIMEOUT_MS);
      });

      const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);

      clearInterval(progressInterval);

      if (error) {
        logger.error('Upload error:', error);
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
      logger.error('Upload error:', error);
      
      if (error instanceof Error && error.message === 'UPLOAD_TIMEOUT') {
        toast.error('Upload demorou demais. Verifique sua conexão e tente novamente.');
      } else {
        toast.error('Erro ao enviar arquivo');
      }
      
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
    validateFile, // Export for external use
  };
}
