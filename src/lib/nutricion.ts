import type { Ingredient, Recipe } from '../types.js';
import type { Alimento, Macros } from './alimentos.js';
import { ALIMENTOS } from './alimentos.js';
import { normalize } from './ingredients.js';

/**
 * Calorias y macros aproximados de una receta.
 *
 * No se guarda nada en el documento: se deduce del nombre de cada ingrediente
 * contra el catalogo. Asi funciona igual con las recetas escritas a mano, con
 * las que traiga una IA y con las del constructor, y si manana se corrige un
 * numero del catalogo todas las recetas se corrigen solas.
 */

/** Cantidades absolutas (no por 100 g). */
export interface Aporte {
  kcal: number;
  prot: number;
  hc: number;
  grasa: number;
}

export const APORTE_CERO: Aporte = { kcal: 0, prot: 0, hc: 0, grasa: 0 };

export function sumarAportes(a: Aporte, b: Aporte): Aporte {
  return {
    kcal: a.kcal + b.kcal,
    prot: a.prot + b.prot,
    hc: a.hc + b.hc,
    grasa: a.grasa + b.grasa,
  };
}

function escalarMacros(macros: Macros, gramos: number): Aporte {
  const f = gramos / 100;
  return {
    kcal: macros.kcal * f,
    prot: macros.prot * f,
    hc: macros.hc * f,
    grasa: macros.grasa * f,
  };
}

/* --- Emparejar un nombre con el catalogo --------------------------------- */

let indice: Map<string, Alimento> | null = null;

function getIndice(): Map<string, Alimento> {
  if (indice) return indice;
  const m = new Map<string, Alimento>();
  for (const a of ALIMENTOS) {
    for (const clave of [a.nombre, ...(a.sinonimos ?? [])]) {
      const k = normalize(clave);
      // El primero gana: los sinonimos genericos ("pollo") no pisan a quien
      // se llama asi de verdad.
      if (!m.has(k)) m.set(k, a);
    }
  }
  indice = m;
  return m;
}

/** Quita la plural mas comun para que "tomates" encuentre "tomate". */
function singular(s: string): string {
  if (s.endsWith('es') && s.length > 4) return s.slice(0, -2);
  if (s.endsWith('s') && s.length > 3) return s.slice(0, -1);
  return s;
}

/** ¿Aparece `aguja` como palabra entera dentro de `pajar`? */
function contienePalabra(pajar: string, aguja: string): boolean {
  const i = pajar.indexOf(aguja);
  if (i === -1) return false;
  const antes = i === 0 ? ' ' : pajar[i - 1];
  const despues = i + aguja.length >= pajar.length ? ' ' : pajar[i + aguja.length];
  return !/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(despues);
}

/** Palabras que describen el corte, no el alimento. */
const ADJETIVOS =
  /\b(al gusto|troceado|troceada|troceados|troceadas|en tiras|en dados|en rodajas|fresco|fresca|frescos|frescas|congelado|congelada|deshuesado|deshuesada|sin piel|natural)\b/g;

/** Un intento de emparejamiento sobre un nombre ya normalizado. */
function intentar(n: string, exacto: boolean): Alimento | null {
  if (!n) return null;
  const idx = getIndice();
  if (exacto) return idx.get(n) ?? idx.get(singular(n)) ?? null;

  // Gana la coincidencia mas larga: "contramuslo de pollo" tiene que ganar a
  // "pollo", que tambien encaja pero dice menos.
  let mejor: { alimento: Alimento; largo: number } | null = null;
  for (const [clave, alimento] of idx) {
    if (!contienePalabra(n, clave) && !contienePalabra(singular(n), clave)) continue;
    if (!mejor || clave.length > mejor.largo) mejor = { alimento, largo: clave.length };
  }
  return mejor?.alimento ?? null;
}

/**
 * Encuentra el alimento al que se refiere un nombre escrito a mano.
 *
 * Va de lo mas estricto a lo mas laxo. El nombre tal cual se prueba SIEMPRE
 * antes que el nombre limpio de adjetivos, porque hay alimentos que se llaman
 * como un adjetivo: quitando "picada" de "carne picada" solo queda "carne".
 */
export function buscarAlimento(nombre: string): Alimento | null {
  const n = normalize(nombre);
  if (!n) return null;
  const limpio = n.replace(ADJETIVOS, '').replace(/\s+/g, ' ').trim();

  return (
    intentar(n, true) ??
    intentar(limpio, true) ??
    intentar(n, false) ??
    intentar(limpio, false)
  );
}

/* --- Aporte de un ingrediente -------------------------------------------- */

const A_GRAMOS: Record<string, number> = {
  g: 1,
  gr: 1,
  gramo: 1,
  gramos: 1,
  kg: 1000,
  kilo: 1000,
  kilos: 1000,
  // A esta escala 1 ml de salsa o de caldo pesa 1 g. El aceite pesa un 8 %
  // menos, y ese error es mucho mas pequeno que el del propio catalogo.
  ml: 1,
  cl: 10,
  l: 1000,
  litro: 1000,
  litros: 1000,
};

/**
 * Cuantos gramos hay en la linea del ingrediente.
 * Devuelve null cuando no hay forma de saberlo ("perejil al gusto").
 */
export function gramosDe(ing: Ingredient, alimento: Alimento): number | null {
  const unidad = normalize(ing.unit ?? '');
  if (ing.qty && ing.qty > 0) {
    const factor = Object.hasOwn(A_GRAMOS, unidad) ? A_GRAMOS[unidad] : undefined;
    if (factor !== undefined) return ing.qty * factor;
    // Unidades: hacen falta los gramos por pieza para poder decir algo.
    const porPieza = alimento.gramosPorUnidad;
    if (porPieza) return ing.qty * porPieza;
    // De una salsa nadie compra "una pieza": "1 ud pesto" es una racion.
    if (alimento.racion) return ing.qty * alimento.racion;
    return null;
  }
  // Sin cantidad, una racion tipica es mejor estimacion que cero.
  return alimento.racion && alimento.racion > 0 ? alimento.racion : null;
}

export interface AporteIngrediente {
  ingrediente: Ingredient;
  alimento: Alimento | null;
  gramos: number | null;
  aporte: Aporte | null;
}

export function aporteDeIngrediente(ing: Ingredient): AporteIngrediente {
  const alimento = buscarAlimento(ing.name);
  if (!alimento) return { ingrediente: ing, alimento: null, gramos: null, aporte: null };
  // Las especias se conocen de sobra y aportan cero: contarlas como
  // "no se ha sabido leer" hundiria la cobertura de recetas perfectamente sanas.
  if (alimento.racion === 0) {
    return { ingrediente: ing, alimento, gramos: 0, aporte: APORTE_CERO };
  }
  const gramos = gramosDe(ing, alimento);
  if (gramos === null) return { ingrediente: ing, alimento, gramos: null, aporte: null };
  return { ingrediente: ing, alimento, gramos, aporte: escalarMacros(alimento.macros, gramos) };
}

export interface NutricionReceta {
  /** Suma de toda la receta, para las raciones que declara. */
  total: Aporte;
  /** Lo mismo dividido entre las raciones. Es el numero que interesa mirar. */
  porRacion: Aporte;
  detalle: AporteIngrediente[];
  /** Ingredientes que no se han sabido interpretar. */
  sinDatos: string[];
  /** Fraccion de ingredientes con datos, de 0 a 1. Debajo de 0,6 no se ensena. */
  cobertura: number;
}

export function macrosDeReceta(recipe: Recipe): NutricionReceta {
  const detalle = recipe.ingredients.map(aporteDeIngrediente);
  const total = detalle.reduce(
    (acc, d) => (d.aporte ? sumarAportes(acc, d.aporte) : acc),
    APORTE_CERO,
  );
  const sinDatos = detalle.filter((d) => !d.aporte).map((d) => d.ingrediente.name);
  const raciones = recipe.servings > 0 ? recipe.servings : 1;
  return {
    total,
    porRacion: {
      kcal: total.kcal / raciones,
      prot: total.prot / raciones,
      hc: total.hc / raciones,
      grasa: total.grasa / raciones,
    },
    detalle,
    sinDatos,
    cobertura: detalle.length === 0 ? 0 : (detalle.length - sinDatos.length) / detalle.length,
  };
}

/* --- Presentacion -------------------------------------------------------- */

export function redondearAporte(a: Aporte): Aporte {
  return {
    kcal: Math.round(a.kcal),
    prot: Math.round(a.prot),
    hc: Math.round(a.hc),
    grasa: Math.round(a.grasa),
  };
}

/** "620 kcal · 45 P · 48 HC · 22 G" */
export function textoAporte(a: Aporte): string {
  const r = redondearAporte(a);
  return `${r.kcal} kcal · ${r.prot} P · ${r.hc} HC · ${r.grasa} G`;
}
