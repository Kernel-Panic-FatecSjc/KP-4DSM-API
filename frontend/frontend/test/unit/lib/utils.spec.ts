import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('junta as classes ignorando as condições falsas', () => {
    const ativo = false;

    expect(cn('px-4', ativo && 'bg-lime', null, undefined, 'text-sm')).toBe('px-4 text-sm');
  });
});
