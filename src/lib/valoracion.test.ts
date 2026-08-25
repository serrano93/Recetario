import { describe, expect, it } from 'vitest';
import type { AppData, Recipe } from '../types.js';
import { ajustar, conValoracion, estaValorada, mediaDe, valorDe } from './valoracion.js';
import { merge } from './merge.js';
import { sanitize } from './validate.js';

const receta = (ratings?: Recipe['ratings']): Recipe => ({
  id: 'r1',
  name: 'Lentejas',
  tags: [],
  servings: 2,
  ingredients: [],
  steps: '',
  fits: [],
  ratings,
});

describe('valorDe / mediaDe', () => {
  it('lee lo que ha puesto cada uno', () => {
    const r = receta({ javi: 4.5, andrea: 3 });
    expect(valorDe(r, 'javi')).toBe(4.5);
    expect(valorDe(r, 'andrea')).toBe(3);
    expect(valorDe(r, 'nadie')).toBe(0);
  });

  it('la media es solo de quien la ha valorado', () => {
    expect(mediaDe(receta({ javi: 5, andrea: 4 }))).toBe(4.5);
    // Andrea no ha dicho nada: no cuenta como un cero.
    expect(mediaDe(receta({ javi: 5 }))).toBe(5);
  });

  it('sin valorar es null, no cero: no es lo mismo que "es mala"', () => {
    expect(mediaDe(receta())).toBeNull();
    expect(mediaDe(receta({}))).toBeNull();
    expect(mediaDe(receta({ javi: 0 }))).toBeNull();
    expect(estaValorada(receta({ javi: 0 }))).toBe(false);
  });
});

describe('ajustar', () => {
  it('cuadra a la media estrella mas cercana', () => {
    expect(ajustar(3.3)).toBe(3.5);
    expect(ajustar(3.2)).toBe(3);
    expect(ajustar(4.75)).toBe(5);
  });

  it('no deja salirse de rango', () => {
    expect(ajustar(9)).toBe(5);
    expect(ajustar(-2)).toBe(0);
    expect(ajustar(NaN)).toBe(0);
  });
});

describe('conValoracion', () => {
  it('no pisa la del otro', () => {
    const r = conValoracion(receta({ andrea: 4 }), 'javi', 5);
    expect(r.ratings).toEqual({ andrea: 4, javi: 5 });
  });

  it('quitar la valoracion guarda un 0, no borra la clave', () => {
    // Si borrase la clave, al fusionar con el otro movil volveria sola.
    const r = conValoracion(receta({ javi: 5 }), 'javi', 0);
    expect(r.ratings).toEqual({ javi: 0 });
  });
});

/* --- Lo que de verdad importa: que no se pierdan al sincronizar ---------- */

const doc = (recipes: Recipe[], updatedAt: string): AppData => ({
  version: 1,
  people: [
    { id: 'javi', name: 'Javi', color: '#a' },
    { id: 'andrea', name: 'Andrea', color: '#b' },
  ],
  recipes,
  plan: [],
  events: [],
  compra: [],
  compradosIds: [],
  despensa: [],
  updatedAt,
});

describe('fusion de valoraciones', () => {
  it('los dos valoran a la vez y se conservan las dos', () => {
    const suyo = doc([{ ...receta({ javi: 5 }), updatedAt: '2026-01-01T10:00:00Z' }], '2026-01-01T10:00:00Z');
    const deElla = doc([{ ...receta({ andrea: 4 }), updatedAt: '2026-01-01T10:00:05Z' }], '2026-01-01T10:00:05Z');
    expect(merge(suyo, deElla).recipes[0].ratings).toEqual({ javi: 5, andrea: 4 });
  });

  it('da igual quien guarde el ultimo', () => {
    const suyo = doc([{ ...receta({ javi: 5 }), updatedAt: '2026-01-01T10:00:09Z' }], '2026-01-01T10:00:09Z');
    const deElla = doc([{ ...receta({ andrea: 4 }), updatedAt: '2026-01-01T10:00:01Z' }], '2026-01-01T10:00:01Z');
    expect(merge(suyo, deElla).recipes[0].ratings).toEqual({ javi: 5, andrea: 4 });
  });

  it('cambiar la propia valoracion gana sobre la version vieja', () => {
    const nuevo = doc([{ ...receta({ javi: 2, andrea: 4 }), updatedAt: '2026-01-02T00:00:00Z' }], '2026-01-02T00:00:00Z');
    const viejo = doc([{ ...receta({ javi: 5, andrea: 4 }), updatedAt: '2026-01-01T00:00:00Z' }], '2026-01-01T00:00:00Z');
    expect(merge(nuevo, viejo).recipes[0].ratings).toEqual({ javi: 2, andrea: 4 });
  });

  it('quitar la propia valoracion no se deshace al sincronizar', () => {
    const quitada = doc([{ ...receta({ javi: 0 }), updatedAt: '2026-01-02T00:00:00Z' }], '2026-01-02T00:00:00Z');
    const vieja = doc([{ ...receta({ javi: 5 }), updatedAt: '2026-01-01T00:00:00Z' }], '2026-01-01T00:00:00Z');
    expect(merge(quitada, vieja).recipes[0].ratings).toEqual({ javi: 0 });
  });

  it('editar la receta en un movil no borra la valoracion del otro', () => {
    const editada = doc(
      [{ ...receta(), name: 'Lentejas con chorizo', updatedAt: '2026-01-02T00:00:00Z' }],
      '2026-01-02T00:00:00Z',
    );
    const valorada = doc([{ ...receta({ andrea: 5 }), updatedAt: '2026-01-01T00:00:00Z' }], '2026-01-01T00:00:00Z');
    const salida = merge(editada, valorada).recipes[0];
    expect(salida.name).toBe('Lentejas con chorizo');
    expect(salida.ratings).toEqual({ andrea: 5 });
  });
});

describe('valoraciones que vienen de fuera', () => {
  const limpiar = (ratings: unknown) =>
    sanitize({ version: 1, recipes: [{ id: 'r1', name: 'X', ratings }] }).data.recipes[0].ratings;

  it('cuadra a medias estrellas y recorta a 5', () => {
    expect(limpiar({ javi: 7, andrea: 3.3 })).toEqual({ javi: 5, andrea: 3.5 });
  });

  it('descarta a quien no existe y lo que no es un numero', () => {
    expect(limpiar({ javi: 4, marta: 5, andrea: 'muy buena' })).toEqual({ javi: 4 });
  });

  it('aguanta basura sin reventar', () => {
    expect(limpiar('cinco estrellas')).toBeUndefined();
    expect(limpiar(null)).toBeUndefined();
    expect(limpiar({})).toBeUndefined();
  });
});
