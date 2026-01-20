import { describe, it, expect } from 'vitest';
import { getReadableErrorMessage, getErrorWithFallback } from './errorMessages';

describe('getReadableErrorMessage', () => {
  it('deve retornar mensagem amigável para erro de rede', () => {
    const error = new Error('Failed to fetch');
    expect(getReadableErrorMessage(error)).toBe('Erro de conexão. Verifique sua internet.');
  });

  it('deve retornar mensagem amigável para timeout', () => {
    const error = new Error('timeout of 5000ms exceeded');
    expect(getReadableErrorMessage(error)).toBe('A operação demorou muito. Tente novamente.');
  });

  it('deve retornar mensagem amigável para 401', () => {
    const error = new Error('401 Unauthorized');
    expect(getReadableErrorMessage(error)).toBe('Sessão expirada. Faça login novamente.');
  });

  it('deve retornar mensagem amigável para 403', () => {
    const error = new Error('403 Forbidden');
    expect(getReadableErrorMessage(error)).toBe('Você não tem permissão para esta ação.');
  });

  it('deve retornar mensagem amigável para 404', () => {
    const error = new Error('404 Not Found');
    expect(getReadableErrorMessage(error)).toBe('Recurso não encontrado.');
  });

  it('deve retornar mensagem amigável para 500', () => {
    const error = new Error('500 Internal Server Error');
    expect(getReadableErrorMessage(error)).toBe('Erro no servidor. Tente novamente mais tarde.');
  });

  it('deve retornar null para erro desconhecido', () => {
    const error = new Error('Algo aleatório');
    expect(getReadableErrorMessage(error)).toBeNull();
  });
});

describe('getErrorWithFallback', () => {
  it('deve retornar mensagem amigável quando disponível', () => {
    const error = new Error('Failed to fetch');
    expect(getErrorWithFallback(error, 'Fallback')).toBe('Erro de conexão. Verifique sua internet.');
  });

  it('deve retornar fallback quando não há mensagem amigável', () => {
    const error = new Error('Erro desconhecido xyz');
    expect(getErrorWithFallback(error, 'Fallback padrão')).toBe('Fallback padrão');
  });

  it('deve lidar com erro não-Error', () => {
    expect(getErrorWithFallback('string error', 'Fallback')).toBe('Fallback');
    expect(getErrorWithFallback(null, 'Fallback')).toBe('Fallback');
    expect(getErrorWithFallback(undefined, 'Fallback')).toBe('Fallback');
  });
});
