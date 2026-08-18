import { CURRENT_VERSION } from '../types';
import type { AppData, Recipe } from '../types';
import { DESPENSA_POR_DEFECTO } from './ingredients';
import { defaultPeople } from './validate';

function receta(r: Omit<Recipe, 'id'> & { id: string }): Recipe {
  return r;
}

/** Recetario inicial: unas cuantas recetas para no empezar con la pantalla vacia. */
const RECETAS_INICIALES: Recipe[] = [
  receta({
    id: 'r_lentejas',
    name: 'Lentejas con chorizo',
    tags: ['batch cooking', 'cuchara'],
    servings: 4,
    minutes: 50,
    fits: ['comida'],
    ingredients: [
      { name: 'lentejas', qty: 400, unit: 'g' },
      { name: 'chorizo', qty: 150, unit: 'g' },
      { name: 'zanahoria', qty: 2, unit: 'ud' },
      { name: 'cebolla', qty: 1, unit: 'ud' },
      { name: 'patata', qty: 2, unit: 'ud' },
      { name: 'pimentón', basico: true },
    ],
    steps:
      'Pochar la cebolla y la zanahoria en la olla.\n' +
      'Añadir el pimentón y enseguida las lentejas y la patata en trozos.\n' +
      'Cubrir con agua, anadir el chorizo y cocer 35 min a fuego suave.',
  }),
  receta({
    id: 'r_pollo_limon',
    name: 'Pollo al limón con arroz',
    tags: ['rápido'],
    servings: 2,
    minutes: 30,
    fits: ['comida', 'cena'],
    ingredients: [
      { name: 'pechuga de pollo', qty: 400, unit: 'g' },
      { name: 'limón', qty: 1, unit: 'ud' },
      { name: 'arroz', qty: 160, unit: 'g' },
      { name: 'ajo', qty: 2, unit: 'ud' },
    ],
    steps:
      'Cocer el arroz.\n' +
      'Dorar el pollo en tiras con el ajo laminado.\n' +
      'Añadir el zumo de limon, dejar reducir 2 min y servir sobre el arroz.',
  }),
  receta({
    id: 'r_tortilla',
    name: 'Tortilla de patatas',
    tags: ['clásico'],
    servings: 3,
    minutes: 40,
    fits: ['cena'],
    ingredients: [
      { name: 'patata', qty: 600, unit: 'g' },
      { name: 'huevo', qty: 5, unit: 'ud' },
      { name: 'cebolla', qty: 1, unit: 'ud' },
    ],
    steps:
      'Freír la patata en láminas con la cebolla a fuego medio hasta que este blanda.\n' +
      'Escurrir, mezclar con el huevo batido y dejar reposar 5 min.\n' +
      'Cuajar en la sartén vuelta y vuelta.',
  }),
  receta({
    id: 'r_ensalada_garbanzos',
    name: 'Ensalada de garbanzos y atún',
    tags: ['rápido', 'sin cocinar', 'tupper'],
    servings: 2,
    minutes: 10,
    fits: ['comida', 'cena'],
    ingredients: [
      { name: 'garbanzos cocidos', qty: 400, unit: 'g' },
      { name: 'atún en lata', qty: 2, unit: 'ud' },
      { name: 'tomate', qty: 2, unit: 'ud' },
      { name: 'cebolla morada', qty: 0.5, unit: 'ud' },
      { name: 'huevo', qty: 2, unit: 'ud' },
    ],
    steps: 'Cocer los huevos 10 min.\nMezclar todo bien escurrido y alinar.',
  }),
  receta({
    id: 'r_salmon_verduras',
    name: 'Salmón al horno con verduras',
    tags: ['sano', 'horno'],
    servings: 2,
    minutes: 35,
    fits: ['cena'],
    ingredients: [
      { name: 'lomo de salmón', qty: 2, unit: 'ud' },
      { name: 'calabacín', qty: 1, unit: 'ud' },
      { name: 'pimiento rojo', qty: 1, unit: 'ud' },
      { name: 'cebolla', qty: 1, unit: 'ud' },
      { name: 'limón', qty: 1, unit: 'ud' },
    ],
    steps:
      'Cortar las verduras en juliana y hornear 20 min a 200 grados.\n' +
      'Añadir el salmón encima y hornear 10 min mas.',
  }),
  receta({
    id: 'r_pasta_pesto',
    name: 'Pasta al pesto con pollo',
    tags: ['rápido'],
    servings: 2,
    minutes: 20,
    fits: ['comida', 'cena'],
    ingredients: [
      { name: 'pasta', qty: 200, unit: 'g' },
      { name: 'pesto', qty: 1, unit: 'ud' },
      { name: 'pechuga de pollo', qty: 250, unit: 'g' },
      { name: 'tomate cherry', qty: 150, unit: 'g' },
    ],
    steps: 'Cocer la pasta.\nDorar el pollo en dados.\nMezclar con el pesto y los cherries partidos.',
  }),
];

export function seedData(): AppData {
  return {
    version: CURRENT_VERSION,
    people: defaultPeople(),
    recipes: RECETAS_INICIALES,
    plan: [],
    events: [],
    compra: [],
    compradosIds: [],
    despensa: [...DESPENSA_POR_DEFECTO],
    updatedAt: new Date().toISOString(),
  };
}

export function emptyData(): AppData {
  return { ...seedData(), recipes: [] };
}
