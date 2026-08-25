import { CURRENT_VERSION, SLOTS } from '../types.js';
import type {
  AjustesGoogle,
  AppData,
  Ingredient,
  ManualItem,
  Person,
  PlanEntry,
  PlanEvent,
  Recipe,
  Slot,
  Tombstone,
} from '../types.js';
import { DESPENSA_POR_DEFECTO } from './ingredients.js';
import { today } from './dates.js';

/**
 * Saneado de datos que vienen de fuera (import de JSON, respuesta de una IA,
 * fila de Supabase). Nunca lanza por un campo suelto: descarta lo que no
 * entiende y rellena lo que falta, para que un JSON imperfecto siga cargando.
 */

export interface ValidationResult {
  data: AppData;
  /** Avisos legibles sobre lo que se ha corregido o descartado. */
  warnings: string[];
}

let contador = 0;
export function newId(prefix = 'id'): string {
  contador += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${contador.toString(36)}${rand}`;
}

function asString(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asStringArray(v: unknown): string[] {
  return asArray(v).map((x) => asString(x)).filter(Boolean);
}

function asSlots(v: unknown): Slot[] {
  return asStringArray(v)
    .map((s) => s.toLowerCase().trim())
    .filter((s): s is Slot => (SLOTS as string[]).includes(s));
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function asDate(v: unknown, fallback: string): string {
  const s = asString(v).trim();
  return ISO_RE.test(s) ? s : fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseIngredient(v: unknown): Ingredient | null {
  if (typeof v === 'string') {
    const name = v.trim();
    return name ? { name } : null;
  }
  if (!isRecord(v)) return null;
  const name = asString(v.name ?? v.nombre).trim();
  if (!name) return null;
  const qty = asNumber(v.qty ?? v.cantidad);
  const unit = asString(v.unit ?? v.unidad).trim() || undefined;
  const ing: Ingredient = { name };
  if (qty !== undefined && qty > 0) ing.qty = qty;
  if (unit) ing.unit = unit;
  if (v.basico === true) ing.basico = true;
  return ing;
}

function parsePerson(v: unknown, i: number): Person | null {
  if (!isRecord(v)) return null;
  const name = asString(v.name ?? v.nombre).trim();
  if (!name) return null;
  return {
    id: asString(v.id).trim() || newId('p'),
    name,
    color: asString(v.color).trim() || (i === 0 ? '#e07a5f' : '#3d8f8f'),
  };
}

function parseRecipe(v: unknown): Recipe | null {
  if (!isRecord(v)) return null;
  const name = asString(v.name ?? v.nombre).trim();
  if (!name) return null;
  const servings = asNumber(v.servings ?? v.raciones);
  const minutes = asNumber(v.minutes ?? v.minutos);
  return {
    id: asString(v.id).trim() || newId('r'),
    name,
    tags: asStringArray(v.tags ?? v.etiquetas),
    servings: servings && servings > 0 ? servings : 2,
    minutes: minutes && minutes > 0 ? minutes : undefined,
    ingredients: asArray(v.ingredients ?? v.ingredientes)
      .map(parseIngredient)
      .filter((x): x is Ingredient => x !== null),
    steps: asString(v.steps ?? v.pasos),
    notes: asString(v.notes ?? v.notas) || undefined,
    fits: asSlots(v.fits ?? v.encaja),
    favorite: v.favorite === true || v.favorita === true ? true : undefined,
    updatedAt: asString(v.updatedAt) || undefined,
  };
}

function parseEntry(v: unknown, peopleIds: Set<string>): PlanEntry | null {
  if (!isRecord(v)) return null;
  const date = asString(v.date ?? v.fecha).trim();
  if (!ISO_RE.test(date)) return null;
  const slot = asSlots([v.slot ?? v.momento])[0];
  if (!slot) return null;

  const people = asStringArray(v.people ?? v.personas).filter((id) => peopleIds.has(id));
  const recipeId = asString(v.recipeId ?? v.receta).trim() || undefined;
  const text = asString(v.text ?? v.texto).trim() || undefined;
  if (!recipeId && !text) return null;

  return {
    id: asString(v.id).trim() || newId('e'),
    date,
    slot,
    people: people.length ? people : [...peopleIds],
    recipeId,
    text,
    done: v.done === true || v.hecho === true ? true : undefined,
    batch: v.batch === true || v.tanda === true ? true : undefined,
    leftoverOf: asString(v.leftoverOf ?? v.sobrasDe).trim() || undefined,
    updatedAt: asString(v.updatedAt) || undefined,
  };
}

function parseEvent(v: unknown, peopleIds: Set<string>): PlanEvent | null {
  if (!isRecord(v)) return null;
  const title = asString(v.title ?? v.titulo).trim();
  if (!title) return null;
  const from = asDate(v.from ?? v.desde, today());
  const to = asDate(v.to ?? v.hasta, from);
  return {
    id: asString(v.id).trim() || newId('ev'),
    title,
    people: asStringArray(v.people ?? v.personas).filter((id) => peopleIds.has(id)),
    from,
    to: to < from ? from : to,
    blocks: asSlots(v.blocks ?? v.bloquea),
    notes: asString(v.notes ?? v.notas) || undefined,
    origen: v.origen === 'google' ? 'google' : undefined,
    externalId: asString(v.externalId).trim() || undefined,
    importadoPor: asString(v.importadoPor).trim() || undefined,
    updatedAt: asString(v.updatedAt) || undefined,
  };
}

/** Ajustes de Google. Nunca lleva secretos: los tokens viven en el servidor. */
function parseGoogle(v: unknown): AjustesGoogle | undefined {
  if (!isRecord(v)) return undefined;
  const reglas = isRecord(v.reglas) ? v.reglas : {};
  const hora = (x: unknown, porDefecto: string) => {
    const s = asString(x).trim();
    return /^\d{2}:\d{2}$/.test(s) ? s : porDefecto;
  };
  return {
    leer: v.leer !== false,
    escribir: v.escribir === true,
    horaComida: hora(v.horaComida, '14:00'),
    horaCena: hora(v.horaCena, '21:00'),
    reglas: {
      todoElDia: asStringArray(reglas.todoElDia),
      bloqueaComida: asStringArray(reglas.bloqueaComida),
      bloqueaCena: asStringArray(reglas.bloqueaCena),
    },
    ignorados: asStringArray(v.ignorados),
    calendarios: isRecord(v.calendarios)
      ? Object.fromEntries(
          Object.entries(v.calendarios).map(([k, x]) => [
            k,
            x === 'ignorar' ? ('ignorar' as const) : asStringArray(x),
          ]),
        )
      : undefined,
    vistos: asArray(v.vistos)
      .map((x) =>
        isRecord(x) && asString(x.id)
          ? { id: asString(x.id), nombre: asString(x.nombre), cuenta: asString(x.cuenta) }
          : null,
      )
      .filter((x): x is { id: string; nombre: string; cuenta: string } => x !== null),
    ultimaSync: asString(v.ultimaSync) || undefined,
  };
}

function parseManual(v: unknown): ManualItem | null {
  if (typeof v === 'string') {
    const name = v.trim();
    return name ? { id: newId('c'), name } : null;
  }
  if (!isRecord(v)) return null;
  const name = asString(v.name ?? v.nombre).trim();
  if (!name) return null;
  const qty = asNumber(v.qty ?? v.cantidad);
  return {
    id: asString(v.id).trim() || newId('c'),
    name,
    qty: qty && qty > 0 ? qty : undefined,
    unit: asString(v.unit ?? v.unidad).trim() || undefined,
    updatedAt: asString(v.updatedAt) || undefined,
  };
}

function parseTombstones(v: unknown): Tombstone[] {
  return asArray(v)
    .map((x) => {
      if (!isRecord(x)) return null;
      const id = asString(x.id).trim();
      const at = asString(x.at).trim();
      return id && at ? { id, at } : null;
    })
    .filter((x): x is Tombstone => x !== null);
}

/** Convierte cualquier cosa en un `AppData` valido, contando lo que se descarto. */
export function sanitize(input: unknown): ValidationResult {
  const warnings: string[] = [];
  const raw = isRecord(input) ? input : {};
  if (!isRecord(input)) warnings.push('El JSON no era un objeto; se ha cargado un recetario vacío.');

  let people = asArray(raw.people ?? raw.personas)
    .map(parsePerson)
    .filter((x): x is Person => x !== null);

  if (people.length === 0) {
    people = defaultPeople();
    warnings.push('No había personas válidas; se han restaurado Javi y Andrea.');
  }
  const peopleIds = new Set(people.map((p) => p.id));

  const recipesRaw = asArray(raw.recipes ?? raw.recetas);
  const recipes = recipesRaw.map(parseRecipe).filter((x): x is Recipe => x !== null);
  if (recipes.length < recipesRaw.length) {
    warnings.push(`Se descartaron ${recipesRaw.length - recipes.length} recetas sin nombre.`);
  }
  const recipeIds = new Set(recipes.map((r) => r.id));

  const planRaw = asArray(raw.plan);
  let plan = planRaw.map((v) => parseEntry(v, peopleIds)).filter((x): x is PlanEntry => x !== null);
  const huerfanas = plan.filter((e) => e.recipeId && !recipeIds.has(e.recipeId));
  if (huerfanas.length) {
    // La receta ya no existe: se conserva la comida como texto libre en vez de perderla.
    plan = plan.map((e) =>
      e.recipeId && !recipeIds.has(e.recipeId)
        ? { ...e, recipeId: undefined, text: e.text ?? 'receta eliminada' }
        : e,
    );
    warnings.push(`${huerfanas.length} comidas apuntaban a recetas inexistentes; se dejaron como texto.`);
  }
  if (plan.length < planRaw.length) {
    warnings.push(`Se descartaron ${planRaw.length - plan.length} comidas mal formadas.`);
  }

  const eventsRaw = asArray(raw.events ?? raw.eventos ?? raw.planes);
  const events = eventsRaw.map((v) => parseEvent(v, peopleIds)).filter((x): x is PlanEvent => x !== null);
  if (events.length < eventsRaw.length) {
    warnings.push(`Se descartaron ${eventsRaw.length - events.length} planes sin título.`);
  }

  const compra = asArray(raw.compra ?? raw.shopping)
    .map(parseManual)
    .filter((x): x is ManualItem => x !== null);

  const despensaRaw = raw.despensa ?? raw.pantry;
  const despensa = despensaRaw === undefined ? [...DESPENSA_POR_DEFECTO] : asStringArray(despensaRaw);

  return {
    warnings,
    data: {
      version: CURRENT_VERSION,
      people,
      recipes,
      plan,
      events,
      compra,
      deleted: parseTombstones(raw.deleted),
      integraciones: isRecord(raw.integraciones)
        ? { google: parseGoogle(raw.integraciones.google) }
        : undefined,
      compradosIds: asStringArray(raw.compradosIds ?? raw.comprados),
      despensa,
      updatedAt: asString(raw.updatedAt) || new Date().toISOString(),
    },
  };
}

/**
 * Saneado de un documento PARCIAL, para el modo fusionar del import.
 *
 * Pedirle a una IA que devuelva el documento entero se rompe en cuanto el
 * recetario crece: trunca, se inventa ids o pierde recetas. Con esto puede
 * devolver solo lo que cambia, por ejemplo `{"recipes": [...]}`.
 *
 * Solo se miran las claves presentes: lo que no venga, no se toca.
 */
export function sanitizePartial(
  input: unknown,
  peopleIds: Set<string>,
): { patch: Partial<AppData>; warnings: string[]; counts: Record<string, number> } {
  const warnings: string[] = [];
  const counts: Record<string, number> = {};
  const patch: Partial<AppData> = {};
  if (!isRecord(input)) {
    return { patch, warnings: ['El JSON no era un objeto.'], counts };
  }

  const recipesRaw = input.recipes ?? input.recetas;
  if (recipesRaw !== undefined) {
    const recipes = asArray(recipesRaw).map(parseRecipe).filter((x): x is Recipe => x !== null);
    if (recipes.length < asArray(recipesRaw).length) {
      warnings.push(`Se descartaron ${asArray(recipesRaw).length - recipes.length} recetas sin nombre.`);
    }
    patch.recipes = recipes;
    counts.recetas = recipes.length;
  }

  const planRaw = input.plan;
  if (planRaw !== undefined) {
    const plan = asArray(planRaw)
      .map((v) => parseEntry(v, peopleIds))
      .filter((x): x is PlanEntry => x !== null);
    if (plan.length < asArray(planRaw).length) {
      warnings.push(`Se descartaron ${asArray(planRaw).length - plan.length} comidas mal formadas.`);
    }
    patch.plan = plan;
    counts.comidas = plan.length;
  }

  const eventsRaw = input.events ?? input.eventos ?? input.planes;
  if (eventsRaw !== undefined) {
    const events = asArray(eventsRaw)
      .map((v) => parseEvent(v, peopleIds))
      .filter((x): x is PlanEvent => x !== null);
    patch.events = events;
    counts.planes = events.length;
  }

  const compraRaw = input.compra ?? input.shopping;
  if (compraRaw !== undefined) {
    const compra = asArray(compraRaw).map(parseManual).filter((x): x is ManualItem => x !== null);
    patch.compra = compra;
    counts['items de compra'] = compra.length;
  }

  const despensaRaw = input.despensa ?? input.pantry;
  if (despensaRaw !== undefined) patch.despensa = asStringArray(despensaRaw);

  if (Object.keys(patch).length === 0) {
    warnings.push('El JSON no traía ninguna sección reconocible (recipes, plan, events, compra).');
  }

  return { patch, warnings, counts };
}

export function defaultPeople(): Person[] {
  return [
    { id: 'javi', name: 'Javi', color: '#e07a5f' },
    { id: 'andrea', name: 'Andrea', color: '#3d8f8f' },
  ];
}

/** Parsea texto JSON tolerando bloques ```json que suelen devolver las IAs. */
export function parseJsonLoose(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  if (!t) return { ok: false, error: 'No has pegado nada.' };
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'JSON inválido.' };
  }
}
