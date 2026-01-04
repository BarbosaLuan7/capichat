import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChangePasswordResult {
  success: boolean;
  error: string | null;
}

export function useChangePassword() {
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'A senha deve ter pelo menos 8 caracteres';
    }
    return null;
  };

  const changePassword = async (newPassword: string): Promise<ChangePasswordResult> => {
    const validationError = validatePassword(newPassword);
    if (validationError) {
      return { success: false, error: validationError };
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      toast.success('Senha alterada com sucesso!');
      return { success: true, error: null };
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao alterar senha';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  return { changePassword, isLoading, validatePassword };
}
