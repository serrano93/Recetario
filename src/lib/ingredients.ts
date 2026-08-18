import type { AppData, Ingredient, PersonId, Recipe } from '../types';
import { blockedIn } from './plan';

/** Minusculas, sin acentos y sin espacios de sobra. Sirve como clave de agrupacion. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Basicos que nunca van a la compra salvo que se quiten de `data.despensa`.
 * La idea es no ensuciar la lista con sal, aceite y especias.
 */
export const DESPENSA_POR_DEFECTO = [
  'sal',
  'pimienta',
  'aceite',
  'aceite de oliva',
  'vinagre',
  'azúcar',
  'agua',
  'especias',
  'orégano',
  'comino',
  'pimentón',
  'laurel',
  'canela',
  'curry',
  'harina',
  'levadura',
];

/** Equivalencias para poder sumar cantidades escritas en unidades distintas. */
const UNIDAD_BASE: Record<string, { base: string; factor: number }> = {
  g: { base: 'g', factor: 1 },
  gr: { base: 'g', factor: 1 },
  gramo: { base: 'g', factor: 1 },
  gramos: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  kilo: { base: 'g', factor: 1000 },
  kilos: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  cl: { base: 'ml', factor: 10 },
  l: { base: 'ml', factor: 1000 },
  litro: { base: 'ml', factor: 1000 },
  litros: { base: 'ml', factor: 1000 },
  ud: { base: 'ud', factor: 1 },
  uds: { base: 'ud', factor: 1 },
  unidad: { base: 'ud', factor: 1 },
  unidades: { base: 'ud', factor: 1 },
};

function lookupUnidad(key: string) {
  return Object.hasOwn(UNIDAD_BASE, key) ? UNIDAD_BASE[key] : undefined;
}

function toBase(qty: number, unit?: string): { qty: number; unit: string } {
  const key = normalize(unit ?? 'ud');
  const conv = lookupUnidad(key);
  if (!conv) return { qty, unit: key || 'ud' };
  return { qty: qty * conv.factor, unit: conv.base };
}

/** Devuelve la cantidad en la unidad mas legible (1200 g -> "1,2 kg"). */
export function formatQty(qty: number, unit: string): string {
  let q = qty;
  let u = unit;
  if (u === 'g' && q >= 1000) {
    q = q / 1000;
    u = 'kg';
  } else if (u === 'ml' && q >= 1000) {
    q = q / 1000;
    u = 'l';
  }
  const rounded = Math.round(q * 100) / 100;
  const text = rounded.toLocaleString('es-ES', { maximumFractionDigits: 2 });
  return u === 'ud' ? `${text} ud` : `${text} ${u}`;
}

export interface ShoppingLine {
  /** Clave estable del ingrediente, usada para marcarlo como comprado. */
  key: string;
  name: string;
  /** Cantidades agrupadas por unidad (una receta en g y otra en ud no se suman). */
  amounts: { qty: number; unit: string }[];
  /** Nombres de las recetas que piden este ingrediente. */
  from: string[];
  manual: boolean;
}

/** ¿Este ingrediente se ignora para la compra? */
export function esBasico(ing: Ingredient, despensa: string[]): boolean {
  if (ing.basico) return true;
  const n = normalize(ing.name);
  return despensa.some((d) => normalize(d) === n);
}

/**
 * Escala los ingredientes de una receta al numero real de comensales.
 * Una receta para 4 que comen 2 personas lleva la mitad de todo.
 */
export function scaleFactor(recipe: Recipe, comensales: number): number {
  const base = recipe.servings > 0 ? recipe.servings : 1;
  return Math.max(comensales, 0) / base;
}

/**
 * Construye la lista de la compra a partir de las comidas planificadas en `dates`.
 *
 * Se ignoran las entradas ya marcadas como hechas, las de texto libre (no tienen
 * ingredientes) y los ingredientes de despensa.
 */
export function buildShoppingList(data: AppData, dates: string[]): ShoppingLine[] {
  const enRango = new Set(dates);
  const porClave = new Map<string, ShoppingLine>();

  const recetaPorId = new Map(data.recipes.map((r) => [r.id, r]));
  /** Cache de "quien no come en casa" por dia y momento. */
  const bloqueos = new Map<string, Map<PersonId, unknown>>();

  for (const entry of data.plan) {
    if (!enRango.has(entry.date) || entry.done || !entry.recipeId) continue;
    const receta = recetaPorId.get(entry.recipeId);
    if (!receta) continue;

    const clave = `${entry.date}|${entry.slot}`;
    let fuera = bloqueos.get(clave);
    if (!fuera) {
      fuera = blockedIn(data.events, entry.date, entry.slot);
      bloqueos.set(clave, fuera);
    }

    // Si ese dia uno de los dos come fuera, no se compra su parte.
    const comensales = entry.people.filter((p) => !fuera.has(p)).length;
    if (comensales === 0) continue;

    const factor = scaleFactor(receta, comensales);

    for (const ing of receta.ingredients) {
      if (esBasico(ing, data.despensa)) continue;
      const key = normalize(ing.name);
      if (!key) continue;

      let linea = porClave.get(key);
      if (!linea) {
        linea = { key, name: ing.name.trim(), amounts: [], from: [], manual: false };
        porClave.set(key, linea);
      }
      if (!linea.from.includes(receta.name)) linea.from.push(receta.name);

      if (ing.qty && ing.qty > 0) {
        const { qty, unit } = toBase(ing.qty * factor, ing.unit);
        const existente = linea.amounts.find((a) => a.unit === unit);
        if (existente) existente.qty += qty;
        else linea.amounts.push({ qty, unit });
      }
    }
  }

  for (const item of data.compra) {
    const key = normalize(item.name);
    if (!key) continue;
    let linea = porClave.get(key);
    if (!linea) {
      linea = { key, name: item.name.trim(), amounts: [], from: [], manual: true };
      porClave.set(key, linea);
    }
    linea.manual = true;
    if (item.qty && item.qty > 0) {
      const { qty, unit } = toBase(item.qty, item.unit);
      const existente = linea.amounts.find((a) => a.unit === unit);
      if (existente) existente.qty += qty;
      else linea.amounts.push({ qty, unit });
    }
  }

  for (const linea of porClave.values()) {
    for (const a of linea.amounts) {
      // En el super no se compra un cuarto de cebolla: las piezas se redondean
      // hacia arriba. Los pesos y volumenes se dejan tal cual.
      if (a.unit === 'ud') a.qty = Math.ceil(a.qty);
    }
  }

  return [...porClave.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * Parsea una linea de ingrediente escrita a mano.
 * Acepta "500 g pechuga de pollo", "2 cebollas", "aceite" o "tomate: 3 ud".
 */
export function parseIngredient(line: string): Ingredient | null {
  const raw = line.trim().replace(/^[-*•]\s*/, '');
  if (!raw) return null;

  const m = raw.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Zñáéíóú]+)?\s+(.*)$/);
  if (m) {
    const qty = Number(m[1].replace(',', '.'));
    const posibleUnidad = m[2] ? normalize(m[2]) : '';
    const esUnidad = lookupUnidad(posibleUnidad) !== undefined;
    return {
      qty,
      unit: esUnidad ? posibleUnidad : 'ud',
      name: (esUnidad ? m[3] : `${m[2] ?? ''} ${m[3]}`).trim(),
    };
  }
  return { name: raw };
}

export function ingredientToLine(ing: Ingredient): string {
  if (ing.qty) return `${ing.qty} ${ing.unit ?? 'ud'} ${ing.name}`.trim();
  return ing.name;
}
