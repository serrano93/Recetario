import { describe, expect, it } from 'vitest';
import type { Recipe } from '../types.js';
import { ALIMENTOS } from './alimentos.js';
import { aporteDeIngrediente, buscarAlimento, macrosDeReceta } from './nutricion.js';

const receta = (ingredients: Recipe['ingredients'], servings = 2): Recipe => ({
  id: 'r1',
  name: 'prueba',
  tags: [],
  servings,
  ingredients,
  steps: '',
  fits: [],
});

describe('buscarAlimento', () => {
  it('encuentra por nombre exacto y por sinonimo', () => {
    expect(buscarAlimento('salmón')?.nombre).toBe('salmón');
    expect(buscarAlimento('macarrones')?.nombre).toBe('pasta');
  });

  it('aguanta plurales y acentos perdidos', () => {
    expect(buscarAlimento('tomates')?.nombre).toBe('tomate');
    expect(buscarAlimento('brocoli')?.nombre).toBe('brócoli');
    expect(buscarAlimento('CEBOLLAS')?.nombre).toBe('cebolla');
  });

  it('gana la coincidencia mas larga', () => {
    // "pollo" a secas es pechuga, pero aqui dice mas el contramuslo.
    expect(buscarAlimento('contramuslo de pollo deshuesado')?.nombre).toBe('contramuslo de pollo');
  });

  it('no confunde pimienta con pimiento', () => {
    expect(buscarAlimento('pimienta negra')).toBeNull();
  });

  it('no casa por trozos de palabra', () => {
    // "pan" esta dentro de "panceta", pero no es lo mismo.
    expect(buscarAlimento('panceta')).toBeNull();
  });

  it('devuelve null con lo que no conoce', () => {
    expect(buscarAlimento('kimchi')).toBeNull();
    expect(buscarAlimento('')).toBeNull();
  });
});

describe('aporteDeIngrediente', () => {
  it('calcula sobre 100 g', () => {
    const a = aporteDeIngrediente({ name: 'pechuga de pollo', qty: 200, unit: 'g' });
    expect(a.gramos).toBe(200);
    expect(a.aporte?.kcal).toBeCloseTo(220, 0);
    expect(a.aporte?.prot).toBeCloseTo(46, 0);
  });

  it('convierte kilos y mililitros', () => {
    expect(aporteDeIngrediente({ name: 'patata', qty: 1, unit: 'kg' }).gramos).toBe(1000);
    expect(aporteDeIngrediente({ name: 'leche de coco', qty: 20, unit: 'cl' }).gramos).toBe(200);
  });

  it('sabe lo que pesa un huevo', () => {
    const a = aporteDeIngrediente({ name: 'huevos', qty: 2, unit: 'ud' });
    expect(a.gramos).toBe(110);
    expect(a.aporte?.kcal).toBeCloseTo(157, 0);
  });

  it('sin cantidad usa la racion tipica de la salsa', () => {
    expect(aporteDeIngrediente({ name: 'pesto' }).gramos).toBe(25);
  });

  it('no inventa nada cuando no hay cantidad ni racion', () => {
    const a = aporteDeIngrediente({ name: 'cebolla' });
    expect(a.alimento?.nombre).toBe('cebolla');
    expect(a.aporte).toBeNull();
  });
});

describe('macrosDeReceta', () => {
  it('suma y divide entre raciones', () => {
    const r = receta(
      [
        { name: 'pechuga de pollo', qty: 400, unit: 'g' },
        { name: 'arroz blanco', qty: 140, unit: 'g' },
      ],
      2,
    );
    const n = macrosDeReceta(r);
    expect(n.total.kcal).toBeCloseTo(440 + 497, 0);
    expect(n.porRacion.kcal).toBeCloseTo(n.total.kcal / 2, 5);
    expect(n.cobertura).toBe(1);
  });

  it('avisa de lo que no ha sabido leer en vez de contarlo como cero', () => {
    const n = macrosDeReceta(receta([
      { name: 'pechuga de pollo', qty: 200, unit: 'g' },
      { name: 'kimchi', qty: 50, unit: 'g' },
    ]));
    expect(n.sinDatos).toEqual(['kimchi']);
    expect(n.cobertura).toBe(0.5);
  });

  it('una receta vacia no revienta', () => {
    const n = macrosDeReceta(receta([]));
    expect(n.total.kcal).toBe(0);
    expect(n.cobertura).toBe(0);
  });

  it('las raciones a cero no dividen entre cero', () => {
    const n = macrosDeReceta(receta([{ name: 'huevos', qty: 2, unit: 'ud' }], 0));
    expect(Number.isFinite(n.porRacion.kcal)).toBe(true);
  });
});

describe('catalogo', () => {
  it('no tiene nombres repetidos', () => {
    const nombres = ALIMENTOS.map((a) => a.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('todo lo que se mide en unidades dice cuanto pesa una', () => {
    for (const a of ALIMENTOS) {
      if (a.unidad === 'ud') expect(a.gramosPorUnidad, a.nombre).toBeGreaterThan(0);
    }
  });

  it('los rendimientos son creibles', () => {
    for (const a of ALIMENTOS) {
      expect(a.rinde, a.nombre).toBeGreaterThan(0);
      expect(a.rinde, a.nombre).toBeLessThanOrEqual(6);
    }
  });

  it('cada alimento se encuentra a si mismo por su nombre', () => {
    for (const a of ALIMENTOS) {
      expect(buscarAlimento(a.nombre)?.nombre, a.nombre).toBe(a.nombre);
    }
  });
});
