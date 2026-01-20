/**
 * Utilitário para traduzir erros técnicos em mensagens amigáveis
 */

// Mapeamento de mensagens de erro comuns para português
const ERROR_MESSAGES: Record<string, string> = {
  'Network Error': 'Erro de conexão. Verifique sua internet e tente novamente.',
  'Failed to fetch': 'Não foi possível conectar ao servidor. Tente novamente.',
  PGRST116: 'Registro não encontrado.',
  '23505': 'Este registro já existe.',
  '23503': 'Não é possível excluir pois existem dados relacionados.',
  '42501': 'Você não tem permissão para realizar esta ação.',
  'JWT expired': 'Sua sessão expirou. Faça login novamente.',
  'Invalid login credentials': 'Email ou senha incorretos.',
  'Email not confirmed': 'Confirme seu email antes de fazer login.',
  'User already registered': 'Este email já está cadastrado.',
  'Password should be at least 6 characters': 'A senha deve ter no mínimo 6 caracteres.',
  'Rate limit exceeded': 'Muitas tentativas. Aguarde um momento.',
  timeout: 'A operação demorou muito. Tente novamente.',
  'Payload too large': 'O arquivo é muito grande.',
  'Unsupported Media Type': 'Tipo de arquivo não suportado.',
};

/**
 * Extrai uma mensagem de erro amigável a partir de um erro técnico
 */
export function getReadableErrorMessage(error: unknown): string {
  // Se for string simples
  if (typeof error === 'string') {
    return findMatchingMessage(error) || error;
  }

  // Se for objeto de erro
  if (error && typeof error === 'object') {
    const err = error as any;

    // Supabase / PostgrestError
    if (err.code && ERROR_MESSAGES[err.code]) {
      return ERROR_MESSAGES[err.code];
    }

    // Mensagem do erro
    if (err.message) {
      const matched = findMatchingMessage(err.message);
      if (matched) return matched;

      // Tentar extrair JSON de edge functions
      const jsonMatch = err.message.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.error) {
            return findMatchingMessage(parsed.error) || parsed.error;
          }
        } catch {
          // ignore
        }
      }

      return err.message;
    }

    // Erro HTTP
    if (err.status) {
      switch (err.status) {
        case 400:
          return 'Requisição inválida. Verifique os dados informados.';
        case 401:
          return 'Você precisa fazer login para continuar.';
        case 403:
          return 'Você não tem permissão para realizar esta ação.';
        case 404:
          return 'Registro não encontrado.';
        case 409:
          return 'Conflito ao salvar. O registro pode já existir.';
        case 413:
          return 'O arquivo é muito grande.';
        case 429:
          return 'Muitas requisições. Aguarde um momento.';
        case 500:
          return 'Erro interno do servidor. Tente novamente.';
        case 502:
          return 'Servidor temporariamente indisponível.';
        case 503:
          return 'Serviço indisponível. Tente novamente mais tarde.';
        case 504:
          return 'Tempo limite excedido. Tente novamente.';
      }
    }
  }

  return 'Ocorreu um erro inesperado. Tente novamente.';
}

/**
 * Procura uma mensagem de erro conhecida dentro do texto
 */
function findMatchingMessage(text: string): string | null {
  const lowerText = text.toLowerCase();

  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (lowerText.includes(key.toLowerCase())) {
      return value;
    }
  }

  return null;
}

/**
 * Combina mensagem amigável com mensagem padrão de fallback
 */
export function getErrorWithFallback(error: unknown, fallback: string): string {
  const readable = getReadableErrorMessage(error);

  // Se for a mensagem genérica, usar o fallback
  if (readable === 'Ocorreu um erro inesperado. Tente novamente.') {
    return fallback;
  }

  return readable;
}
