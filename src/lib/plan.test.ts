import { describe, expect, it } from 'vitest';
import { comidasPendientes, reubicar } from './plan.js';
import type { PlanEntry } from '../types.js';

function entrada(
  id: string,
  date: string,
  slot: 'comida' | 'cena',
  extra: Partial<PlanEntry> = {},
): PlanEntry {
  return { id, date, slot, people: ['javi'], text: id, ...extra };
}

describe('reubicar', () => {
  const plan = [
    entrada('a', '2026-08-25', 'comida'),
    entrada('b', '2026-08-25', 'cena'),
    entrada('c', '2026-08-26', 'comida'),
  ];

  it('mueve a otra fecha y hueco, al final', () => {
    const out = reubicar(plan, 'a', '2026-08-26', 'cena');
    expect(out.map((e) => e.id)).toEqual(['b', 'c', 'a']);
    expect(out.find((e) => e.id === 'a')).toMatchObject({ date: '2026-08-26', slot: 'cena' });
  });

  it('inserta antes de otra entrada para reordenar', () => {
    const out = reubicar(plan, 'c', '2026-08-25', 'comida', 'a');
    expect(out.map((e) => e.id)).toEqual(['c', 'a', 'b']);
    expect(out.find((e) => e.id === 'c')).toMatchObject({ date: '2026-08-25', slot: 'comida' });
  });

  it('no muta el array original', () => {
    reubicar(plan, 'a', '2026-08-26', 'cena');
    expect(plan.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('devuelve el mismo array si la entrada no existe', () => {
    expect(reubicar(plan, 'zz', '2026-08-26', 'comida')).toBe(plan);
  });
});

describe('comidasPendientes', () => {
  it('solo trae las pasadas sin hacer, de mas antigua a mas reciente', () => {
    const plan = [
      entrada('hoy', '2026-08-27', 'comida'),
      entrada('vieja', '2026-08-24', 'cena'),
      entrada('hecha', '2026-08-25', 'comida', { done: true }),
      entrada('media', '2026-08-26', 'comida'),
    ];
    const out = comidasPendientes(plan, '2026-08-27');
    expect(out.map((e) => e.id)).toEqual(['vieja', 'media']);
  });

  it('ignora las sobras marcadas como hechas y las de hoy', () => {
    const plan = [
      entrada('hoy', '2026-08-27', 'cena'),
      entrada('viejaHecha', '2026-08-24', 'cena', { done: true }),
    ];
    expect(comidasPendientes(plan, '2026-08-27')).toEqual([]);
  });
});
