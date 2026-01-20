import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThrottle, useThrottledCallback } from './useThrottle';

describe('useThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve retornar o valor inicial imediatamente', () => {
    const { result } = renderHook(() => useThrottle('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('deve throttle atualizações dentro do limite', () => {
    const { result, rerender } = renderHook(({ value, limit }) => useThrottle(value, limit), {
      initialProps: { value: 'first', limit: 500 },
    });

    expect(result.current).toBe('first');

    // Atualizar valor
    rerender({ value: 'second', limit: 500 });

    // Avançar menos que o limite
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Ainda deve ser o valor inicial
    expect(result.current).toBe('first');
  });

  it('deve atualizar após o limite', () => {
    const { result, rerender } = renderHook(({ value, limit }) => useThrottle(value, limit), {
      initialProps: { value: 'first', limit: 500 },
    });

    rerender({ value: 'second', limit: 500 });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('second');
  });
});

describe('useThrottledCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve executar callback imediatamente na primeira chamada', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 500));

    act(() => {
      result.current('arg1');
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg1');
  });

  it('deve throttle chamadas subsequentes', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 500));

    // Primeira chamada - executa imediatamente
    act(() => {
      result.current('first');
    });

    expect(callback).toHaveBeenCalledTimes(1);

    // Segunda chamada - deve ser throttled
    act(() => {
      result.current('second');
    });

    // Ainda só uma chamada
    expect(callback).toHaveBeenCalledTimes(1);

    // Avançar o tempo
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Agora deve ter executado a segunda
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('second');
  });

  it('deve usar os últimos argumentos após throttle', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 500));

    act(() => {
      result.current('first');
      result.current('second');
      result.current('third');
    });

    // Só a primeira foi executada imediatamente
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('first');

    // Avançar o tempo
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Deve executar com os últimos argumentos
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('third');
  });
});
