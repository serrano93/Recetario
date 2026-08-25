import type { PersonId, Recipe } from '../types.js';

/**
 * Valoraciones de las recetas.
 *
 * Cada uno pone la suya y se guardan por separado: la media es solo para
 * ordenar y para verlo de un vistazo en la lista. Que a Javi le encanten las
 * lentejas y a Andrea no es informacion util, y promediarla a 3 la perderia.
 */

export const MAXIMO = 5;
/** Medias estrellas: el paso mas fino que se puede tocar con el dedo. */
export const PASO = 0.5;

/** Lo que ha puesto esa persona. 0 = la quito; sin entrada = no la ha valorado. */
export function valorDe(recipe: Recipe, persona: PersonId): number {
  const v = recipe.ratings?.[persona];
  return typeof v === 'number' && v > 0 ? v : 0;
}

export function estaValorada(recipe: Recipe): boolean {
  return Object.values(recipe.ratings ?? {}).some((v) => v > 0);
}

/**
 * Media de quienes la han valorado. Devuelve null si no la ha valorado nadie:
 * un 0 se leeria como "es mala", y no es lo mismo que "nadie ha dicho nada".
 */
export function mediaDe(recipe: Recipe): number | null {
  const valores = Object.values(recipe.ratings ?? {}).filter((v) => v > 0);
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

/** Redondea a la media estrella mas cercana y lo deja dentro de rango. */
export function ajustar(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  return Math.min(MAXIMO, Math.round(valor / PASO) * PASO);
}

/**
 * Devuelve la receta con la valoracion de esa persona puesta.
 *
 * Quitar una valoracion guarda un 0 en vez de borrar la clave: al fusionar con
 * el otro movil, una clave que falta se rellena con lo que tuviera el otro lado,
 * y la valoracion volveria sola.
 */
export function conValoracion(recipe: Recipe, persona: PersonId, valor: number): Recipe {
  return { ...recipe, ratings: { ...recipe.ratings, [persona]: ajustar(valor) } };
}

/** Texto para leer en voz alta o mostrar: "4,5". */
export function textoValor(valor: number): string {
  return valor.toLocaleString('es-ES', { maximumFractionDigits: 1 });
}
