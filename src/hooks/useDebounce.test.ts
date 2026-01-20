import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedCallback } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve retornar o valor inicial imediatamente', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('deve debounce o valor após o delay', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 500 },
    });

    expect(result.current).toBe('initial');

    // Atualizar o valor
    rerender({ value: 'updated', delay: 500 });

    // Valor ainda não deve ter mudado
    expect(result.current).toBe('initial');

    // Avançar o tempo
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Agora deve ter atualizado
    expect(result.current).toBe('updated');
  });

  it('deve cancelar o debounce anterior se o valor mudar', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'first', delay: 500 },
    });

    // Primeira atualização
    rerender({ value: 'second', delay: 500 });

    // Avançar parcialmente
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Segunda atualização antes do debounce completar
    rerender({ value: 'third', delay: 500 });

    // Avançar mais 300ms (total 600ms desde a segunda atualização, mas só 300ms desde a terceira)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Ainda deve ser 'first' porque o novo timer ainda não completou
    expect(result.current).toBe('first');

    // Avançar mais 200ms para completar o debounce da terceira atualização
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Agora deve ser 'third'
    expect(result.current).toBe('third');
  });

  it('deve funcionar com delay diferente', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 1000 },
    });

    rerender({ value: 'updated', delay: 1000 });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve debounce chamadas do callback', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    act(() => {
      result.current('arg1');
    });

    // Callback não deve ter sido chamado ainda
    expect(callback).not.toHaveBeenCalled();

    // Avançar o tempo
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Agora deve ter sido chamado
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg1');
  });

  it('deve cancelar chamada anterior e usar a última', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    act(() => {
      result.current('first');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      result.current('second');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      result.current('third');
    });

    // Ainda não foi chamado
    expect(callback).not.toHaveBeenCalled();

    // Avançar o tempo completo
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Deve ter sido chamado apenas uma vez com o último argumento
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('third');
  });

  it('deve manter referência estável do callback', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useDebouncedCallback(cb, 500), {
      initialProps: { cb: callback1 },
    });

    const firstCallback = result.current;

    rerender({ cb: callback2 });

    // Callback retornado deve ser o mesmo (referência estável)
    expect(result.current).toBe(firstCallback);
  });
});
