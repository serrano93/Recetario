import { describe, expect, it } from 'vitest';
import type { AppData, PlanEntry, Recipe } from '../types';
import { conLapidas, merge, sellar } from './merge';

/** Recetario minimo sobre el que montar cada caso. */
function base(over: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    people: [
      { id: 'javi', name: 'Javi', color: '#e07a5f' },
      { id: 'andrea', name: 'Andrea', color: '#3d8f8f' },
    ],
    recipes: [],
    plan: [],
    events: [],
    compra: [],
    deleted: [],
    compradosIds: [],
    despensa: ['sal'],
    updatedAt: '2026-08-18T10:00:00.000Z',
    ...over,
  };
}

function receta(id: string, name: string, updatedAt?: string): Recipe {
  return { id, name, tags: [], servings: 2, ingredients: [], steps: '', fits: [], updatedAt };
}

function comida(id: string, date: string, updatedAt?: string): PlanEntry {
  return { id, date, slot: 'comida', people: ['javi', 'andrea'], text: 'algo', updatedAt };
}

describe('merge', () => {
  it('conserva lo que ha hecho cada uno por separado', () => {
    // El caso que motivo todo esto: Andrea tacha la compra en el super
    // mientras Javi edita una receta en casa.
    const local = base({
      recipes: [receta('r1', 'Lentejas editadas', '2026-08-18T12:00:00.000Z')],
      updatedAt: '2026-08-18T12:00:00.000Z',
    });
    const remoto = base({
      recipes: [receta('r1', 'Lentejas', '2026-08-18T10:00:00.000Z')],
      compradosIds: ['tomate', 'cebolla'],
      updatedAt: '2026-08-18T13:00:00.000Z',
    });

    const out = merge(local, remoto);

    // La edicion de Javi sobrevive aunque Andrea guardase despues...
    expect(out.recipes[0].name).toBe('Lentejas editadas');
    // ...y los tachados de Andrea tambien.
    expect(out.compradosIds).toEqual(['tomate', 'cebolla']);
  });

  it('une elementos que solo tiene uno de los dos lados', () => {
    const local = base({ recipes: [receta('r1', 'Una')] });
    const remoto = base({ recipes: [receta('r2', 'Otra')] });

    const out = merge(local, remoto);

    expect(out.recipes.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
  });

  it('de cada elemento se queda la version con sello mas alto', () => {
    const local = base({ plan: [comida('e1', '2026-08-20', '2026-08-18T15:00:00.000Z')] });
    const remoto = base({ plan: [comida('e1', '2026-08-21', '2026-08-18T09:00:00.000Z')] });

    expect(merge(local, remoto).plan[0].date).toBe('2026-08-20');
    // Y da igual el orden en que se fusione.
    expect(merge(remoto, local).plan[0].date).toBe('2026-08-20');
  });

  it('no resucita lo borrado', () => {
    const conReceta = base({ recipes: [receta('r1', 'Lentejas', '2026-08-18T10:00:00.000Z')] });
    // Un lado la borra dejando lapida; el otro todavia la tiene.
    const borrado = base({
      recipes: [],
      deleted: conLapidas(conReceta, ['r1']),
      updatedAt: '2026-08-18T14:00:00.000Z',
    });

    expect(merge(borrado, conReceta).recipes).toHaveLength(0);
    expect(merge(conReceta, borrado).recipes).toHaveLength(0);
  });

  it('revive lo borrado si se vuelve a editar despues', () => {
    const viejo = base({ recipes: [receta('r1', 'Lentejas', '2026-08-18T10:00:00.000Z')] });
    const borrado = base({ recipes: [], deleted: conLapidas(viejo, ['r1']) });
    // Reedicion posterior al borrado: la intencion mas reciente manda.
    const reeditado = base({
      recipes: [receta('r1', 'Lentejas otra vez', new Date(Date.now() + 60_000).toISOString())],
    });

    const out = merge(borrado, reeditado);

    expect(out.recipes).toHaveLength(1);
    expect(out.recipes[0].name).toBe('Lentejas otra vez');
  });

  it('permite desmarcar un tachado de la compra', () => {
    // Union simple aqui seria un bug: lo desmarcado volveria a marcarse.
    const antes = base({ compradosIds: ['tomate'], updatedAt: '2026-08-18T10:00:00.000Z' });
    const despues = base({ compradosIds: [], updatedAt: '2026-08-18T11:00:00.000Z' });

    expect(merge(antes, despues).compradosIds).toEqual([]);
  });

  it('es idempotente: fusionar dos veces no cambia nada', () => {
    const local = base({
      recipes: [receta('r1', 'Una', '2026-08-18T10:00:00.000Z')],
      plan: [comida('e1', '2026-08-20', '2026-08-18T10:00:00.000Z')],
    });
    const remoto = base({ recipes: [receta('r2', 'Otra', '2026-08-18T11:00:00.000Z')] });

    const una = merge(local, remoto);
    const dos = merge(una, remoto);

    expect(dos).toEqual(una);
  });

  it('sellar marca el elemento para que gane al fusionar', () => {
    const viejo = receta('r1', 'Vieja', '2026-08-18T10:00:00.000Z');
    const nuevo = sellar(receta('r1', 'Nueva'));

    const out = merge(base({ recipes: [nuevo] }), base({ recipes: [viejo] }));

    expect(out.recipes[0].name).toBe('Nueva');
  });

  it('aguanta datos antiguos sin ningun sello', () => {
    // Lo que ya hay en Supabase no tiene `updatedAt` por elemento.
    const local = base({ recipes: [receta('r1', 'Sin sello')] });
    const remoto = base({ recipes: [receta('r2', 'Tampoco')] });

    const out = merge(local, remoto);

    expect(out.recipes).toHaveLength(2);
  });
});
