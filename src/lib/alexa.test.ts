import { describe, expect, it } from 'vitest';
import type { AppData, PlanEntry, Recipe } from '../types.js';
import {
  buscarReceta,
  fraseComeFuera,
  fraseIngredientes,
  frasePaso,
  fraseQueComemos,
  hoyEnCasa,
  horaEnCasa,
  resolverFecha,
  resolverMomento,
  resolverPersona,
} from './alexa.js';

const RECETAS: Recipe[] = [
  {
    id: 'r_lentejas',
    name: 'Lentejas con chorizo',
    tags: [],
    servings: 4,
    minutes: 50,
    fits: [],
    steps: 'Pochar la cebolla\nAñadir las lentejas\nCocer 35 minutos',
    ingredients: [
      { name: 'lentejas', qty: 400, unit: 'g' },
      { name: 'chorizo', qty: 150, unit: 'g' },
      { name: 'pimentón', basico: true },
    ],
  },
  { id: 'r_tortilla', name: 'Tortilla de patatas', tags: [], servings: 3, fits: [], steps: '', ingredients: [] },
];

function datos(plan: PlanEntry[] = []): AppData {
  return {
    version: 1,
    people: [
      { id: 'javi', name: 'Javi', color: '#e07a5f' },
      { id: 'andrea', name: 'Andrea', color: '#3d8f8f' },
    ],
    recipes: RECETAS,
    plan,
    events: [],
    compra: [],
    compradosIds: [],
    despensa: [],
    updatedAt: '2026-08-25T10:00:00.000Z',
  };
}

const HOY = '2026-08-25';

describe('la hora de casa, no la del servidor', () => {
  it('a las 00:30 de Madrid ya es el dia siguiente, aunque en UTC no', () => {
    // Vercel corre en UTC: sin esto, "que cenamos hoy" contestaria lo de ayer.
    const medianoche = new Date('2026-08-24T22:30:00Z'); // 00:30 del 25 en Madrid
    expect(hoyEnCasa(medianoche)).toBe('2026-08-25');
  });

  it('la hora tambien es la de casa', () => {
    expect(horaEnCasa(new Date('2026-08-25T19:00:00Z'))).toBe(21);
  });
});

describe('resolverFecha', () => {
  it('un dia suelto pasa tal cual', () => {
    expect(resolverFecha('2026-08-27', HOY)).toBe('2026-08-27');
  });

  it('sin fecha, hoy', () => {
    expect(resolverFecha(undefined, HOY)).toBe(HOY);
  });

  it('una semana se convierte en su lunes', () => {
    // Alexa manda "2026-W35" si dices "esta semana".
    expect(resolverFecha('2026-W35', HOY)).toBe('2026-08-24');
  });

  it('algo que no se entiende no rompe: se queda en hoy', () => {
    expect(resolverFecha('PRESENT_REF', HOY)).toBe(HOY);
  });
});

describe('resolverMomento', () => {
  it('lo que se diga manda', () => {
    expect(resolverMomento('cena', 10)).toBe('cena');
    expect(resolverMomento('comida', 22)).toBe('comida');
  });

  it('sin decirlo, se deduce de la hora', () => {
    // Preguntar "¿comida o cena?" a las nueve de la noche seria de robot.
    expect(resolverMomento(undefined, 11)).toBe('comida');
    expect(resolverMomento(undefined, 21)).toBe('cena');
  });
});

describe('buscarReceta', () => {
  it('encuentra por nombre exacto y por trozo', () => {
    expect(buscarReceta('Lentejas con chorizo', RECETAS)?.id).toBe('r_lentejas');
    expect(buscarReceta('lentejas', RECETAS)?.id).toBe('r_lentejas');
  });

  it('aguanta que Alexa entienda solo parte', () => {
    expect(buscarReceta('la tortilla esa de patatas', RECETAS)?.id).toBe('r_tortilla');
  });

  it('devuelve null si no se parece a nada', () => {
    expect(buscarReceta('paella valenciana', RECETAS)).toBeNull();
  });
});

describe('fraseQueComemos', () => {
  it('lo dice sin rodeos cuando es compartido', () => {
    const plan: PlanEntry[] = [
      { id: 'e1', date: HOY, slot: 'cena', people: ['javi', 'andrea'], recipeId: 'r_lentejas' },
    ];
    expect(fraseQueComemos(datos(plan), HOY, 'cena', HOY)).toBe(
      'Hoy toca Lentejas con chorizo. Son 50 minutos.',
    );
  });

  it('distingue cuando cada uno come algo', () => {
    const plan: PlanEntry[] = [
      { id: 'e1', date: HOY, slot: 'cena', people: ['javi'], recipeId: 'r_tortilla' },
      { id: 'e2', date: HOY, slot: 'cena', people: ['andrea'], text: 'ensalada' },
    ];
    expect(fraseQueComemos(datos(plan), HOY, 'cena', HOY)).toBe(
      'Para cenar hoy: Javi, Tortilla de patatas. Y Andrea, ensalada.',
    );
  });

  it('avisa de que son sobras', () => {
    const plan: PlanEntry[] = [
      { id: 'e1', date: HOY, slot: 'comida', people: ['javi', 'andrea'], recipeId: 'r_tortilla', leftoverOf: 'e0' },
    ];
    expect(fraseQueComemos(datos(plan), HOY, 'comida', HOY)).toContain('Son las sobras.');
  });

  it('no se inventa nada si no hay plan', () => {
    expect(fraseQueComemos(datos(), HOY, 'cena', HOY)).toBe('No hay nada planificado para cenar hoy.');
  });

  it('dice manana cuando es manana', () => {
    const plan: PlanEntry[] = [
      { id: 'e1', date: '2026-08-26', slot: 'comida', people: ['javi', 'andrea'], text: 'sobras' },
    ];
    expect(fraseQueComemos(datos(plan), '2026-08-26', 'comida', HOY)).toContain('Mañana toca sobras');
  });
});

describe('fraseIngredientes', () => {
  it('enumera en castellano y se salta los basicos', () => {
    // El pimenton esta marcado como basico: no se dice.
    expect(fraseIngredientes(RECETAS[0])).toBe('Lentejas con chorizo lleva lentejas y chorizo.');
  });

  it('lo dice si no hay ingredientes', () => {
    expect(fraseIngredientes(RECETAS[1])).toContain('no tiene ingredientes apuntados');
  });
});

describe('frasePaso', () => {
  it('va uno a uno e invita a seguir', () => {
    const p = frasePaso(RECETAS[0], 0);
    expect(p.texto).toBe('Paso 1. Pochar la cebolla. Di siguiente cuando quieras.');
    expect(p.hayMas).toBe(true);
  });

  it('el ultimo paso cierra', () => {
    const p = frasePaso(RECETAS[0], 2);
    expect(p.texto).toContain('Y con eso ya está.');
    expect(p.hayMas).toBe(false);
  });

  it('pasarse de pasos no rompe', () => {
    expect(frasePaso(RECETAS[0], 9).texto).toBe('Ya está, no hay más pasos.');
  });
});

describe('fraseComeFuera', () => {
  it('dice para quien queda cocinar', () => {
    expect(fraseComeFuera(datos(), 'javi', HOY, 'cena', HOY)).toBe(
      'Hecho, Javi no cena en casa hoy. Solo cocinas para Andrea.',
    );
  });

  it('sin persona, es para los dos', () => {
    expect(fraseComeFuera(datos(), null, HOY, 'comida', HOY)).toBe('Hecho, hoy no hay que comer en casa.');
  });
});

describe('resolverPersona', () => {
  it('reconoce a quien vive en la casa', () => {
    expect(resolverPersona('Andrea', datos().people)).toBe('andrea');
    expect(resolverPersona('el vecino', datos().people)).toBeNull();
  });
});
