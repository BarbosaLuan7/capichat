import { describe, it, expect } from 'vitest';
import { getReadableErrorMessage, getErrorWithFallback } from './errorMessages';

describe('getReadableErrorMessage', () => {
  it('deve retornar mensagem amigável para erro de rede (Failed to fetch)', () => {
    const error = new Error('Failed to fetch');
    expect(getReadableErrorMessage(error)).toBe(
      'Não foi possível conectar ao servidor. Tente novamente.'
    );
  });

  it('deve retornar mensagem amigável para Network Error', () => {
    const error = new Error('Network Error');
    expect(getReadableErrorMessage(error)).toBe(
      'Erro de conexão. Verifique sua internet e tente novamente.'
    );
  });

  it('deve retornar mensagem amigável para timeout', () => {
    const error = new Error('timeout of 5000ms exceeded');
    expect(getReadableErrorMessage(error)).toBe('A operação demorou muito. Tente novamente.');
  });

  it('deve retornar mensagem amigável para JWT expired', () => {
    const error = new Error('JWT expired');
    expect(getReadableErrorMessage(error)).toBe('Sua sessão expirou. Faça login novamente.');
  });

  it('deve retornar mensagem amigável para credenciais inválidas', () => {
    const error = new Error('Invalid login credentials');
    expect(getReadableErrorMessage(error)).toBe('Email ou senha incorretos.');
  });

  it('deve retornar mensagem para erro HTTP 401 via status', () => {
    const error = { status: 401 };
    expect(getReadableErrorMessage(error)).toBe('Você precisa fazer login para continuar.');
  });

  it('deve retornar mensagem para erro HTTP 403 via status', () => {
    const error = { status: 403 };
    expect(getReadableErrorMessage(error)).toBe('Você não tem permissão para realizar esta ação.');
  });

  it('deve retornar mensagem para erro HTTP 404 via status', () => {
    const error = { status: 404 };
    expect(getReadableErrorMessage(error)).toBe('Registro não encontrado.');
  });

  it('deve retornar mensagem para erro HTTP 500 via status', () => {
    const error = { status: 500 };
    expect(getReadableErrorMessage(error)).toBe('Erro interno do servidor. Tente novamente.');
  });

  it('deve retornar a própria mensagem para erro desconhecido', () => {
    const error = new Error('Algo aleatório');
    expect(getReadableErrorMessage(error)).toBe('Algo aleatório');
  });

  it('deve retornar mensagem genérica quando erro não tem mensagem', () => {
    const error = {};
    expect(getReadableErrorMessage(error)).toBe('Ocorreu um erro inesperado. Tente novamente.');
  });

  it('deve extrair mensagem de código PostgreSQL', () => {
    const error = { code: '23505' };
    expect(getReadableErrorMessage(error)).toBe('Este registro já existe.');
  });

  it('deve extrair mensagem de código PGRST', () => {
    const error = { code: 'PGRST116' };
    expect(getReadableErrorMessage(error)).toBe('Registro não encontrado.');
  });
});

describe('getErrorWithFallback', () => {
  it('deve retornar mensagem amigável quando disponível', () => {
    const error = new Error('Failed to fetch');
    expect(getErrorWithFallback(error, 'Fallback')).toBe(
      'Não foi possível conectar ao servidor. Tente novamente.'
    );
  });

  it('deve retornar fallback quando erro não tem mensagem útil', () => {
    const error = {};
    expect(getErrorWithFallback(error, 'Fallback padrão')).toBe('Fallback padrão');
  });

  it('deve retornar a mensagem do erro quando não é genérica', () => {
    const error = new Error('Erro específico do sistema');
    expect(getErrorWithFallback(error, 'Fallback')).toBe('Erro específico do sistema');
  });

  it('deve lidar com erro string diretamente', () => {
    expect(getErrorWithFallback('string error', 'Fallback')).toBe('string error');
  });

  it('deve usar fallback para null/undefined', () => {
    expect(getErrorWithFallback(null, 'Fallback')).toBe('Fallback');
    expect(getErrorWithFallback(undefined, 'Fallback')).toBe('Fallback');
  });
});
