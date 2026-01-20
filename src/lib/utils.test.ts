import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn (classnames utility)', () => {
  it('deve combinar classes simples', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('deve ignorar valores falsy', () => {
    expect(cn('foo', null, undefined, false, 'bar')).toBe('foo bar');
  });

  it('deve lidar com condicionais', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('deve fazer merge de classes Tailwind conflitantes', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('deve retornar string vazia para entrada vazia', () => {
    expect(cn()).toBe('');
  });
});
