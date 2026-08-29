import type { AppData, PersonId, PlanEntry, PlanEvent, Slot } from '../types.js';
import { SLOTS } from '../types.js';
import { addDays, isBetween } from './dates.js';

/** Planes activos en una fecha concreta. */
export function eventsOn(events: PlanEvent[], date: string): PlanEvent[] {
  return events.filter((e) => isBetween(date, e.from, e.to));
}

/** Un plan sin personas afecta a todo el mundo. */
export function eventAffects(event: PlanEvent, personId: PersonId): boolean {
  return event.people.length === 0 || event.people.includes(personId);
}

/**
 * Personas que ese dia y en ese momento no comen en casa, con el plan que lo
 * explica ("Andrea de viaje"). Sirve para no pedirte que cocines de mas.
 */
export function blockedIn(
  events: PlanEvent[],
  date: string,
  slot: Slot,
): Map<PersonId, PlanEvent> {
  const out = new Map<PersonId, PlanEvent>();
  for (const e of eventsOn(events, date)) {
    if (!e.blocks.includes(slot)) continue;
    for (const p of e.people) out.set(p, e);
  }
  return out;
}

/** Ids de las personas que sí necesitan comida ese dia y momento. */
export function dinersFor(data: AppData, date: string, slot: Slot): PersonId[] {
  const all = data.people.map((p) => p.id);
  const blocked = blockedIn(data.events, date, slot);
  // Un plan sin personas indicadas bloquea a todos.
  const globalBlock = eventsOn(data.events, date).some(
    (e) => e.blocks.includes(slot) && e.people.length === 0,
  );
  if (globalBlock) return [];
  return all.filter((id) => !blocked.has(id));
}

export function entriesFor(plan: PlanEntry[], date: string, slot: Slot): PlanEntry[] {
  return plan.filter((e) => e.date === date && e.slot === slot);
}

/** Personas que ya tienen algo asignado en ese hueco. */
export function coveredIn(entries: PlanEntry[]): Set<PersonId> {
  const s = new Set<PersonId>();
  for (const e of entries) for (const p of e.people) s.add(p);
  return s;
}

/**
 * Los siguientes huecos libres a partir de (date, slot), sin contarlo a el.
 * Se usa para colocar las sobras de una tanda en los dias que vienen.
 */
export function nextFreeSlots(
  plan: PlanEntry[],
  date: string,
  slot: Slot,
  count: number,
  maxDias = 7,
): { date: string; slot: Slot }[] {
  const ocupado = new Set(plan.map((e) => `${e.date}|${e.slot}`));
  const salida: { date: string; slot: Slot }[] = [];

  // Los huecos del propio dia posteriores al slot actual, y luego dias enteros.
  const candidatos: { date: string; slot: Slot }[] = [];
  for (let d = 0; d <= maxDias; d += 1) {
    const fecha = addDays(date, d);
    for (const s of SLOTS) {
      if (d === 0 && (s === slot || SLOTS.indexOf(s) < SLOTS.indexOf(slot))) continue;
      candidatos.push({ date: fecha, slot: s });
    }
  }

  for (const c of candidatos) {
    if (salida.length >= count) break;
    if (!ocupado.has(`${c.date}|${c.slot}`)) salida.push(c);
  }
  return salida;
}

/** Nombre visible de una comida planificada. */
export function entryLabel(data: AppData, entry: PlanEntry): string {
  if (entry.recipeId) {
    const r = data.recipes.find((x) => x.id === entry.recipeId);
    if (r) return r.name;
  }
  return entry.text ?? 'Sin definir';
}

/**
 * Mueve una entrada del plan a otra fecha y hueco.
 *
 * Sin `beforeId` va al final de su hueco destino; con `beforeId` se inserta
 * justo antes de esa otra entrada, lo que permite reordenar dentro del hueco.
 * Es pura: no toca el array original.
 */
export function reubicar(
  plan: PlanEntry[],
  entryId: string,
  date: string,
  slot: Slot,
  beforeId?: string,
): PlanEntry[] {
  const entrada = plan.find((e) => e.id === entryId);
  if (!entrada) return plan;
  const resto = plan.filter((e) => e.id !== entryId);
  const movida: PlanEntry = { ...entrada, date, slot };
  if (beforeId) {
    const idx = resto.findIndex((e) => e.id === beforeId);
    if (idx >= 0) return [...resto.slice(0, idx), movida, ...resto.slice(idx)];
  }
  return [...resto, movida];
}

/**
 * Comidas de dias pasados que nunca se marcaron como hechas: se planificaron
 * (y se compraron) pero siguen sin cocinar. Son candidatas a recolocarse en un
 * hueco libre o a descartarse. Ordenadas de mas antigua a mas reciente.
 */
export function comidasPendientes(plan: PlanEntry[], hoy: string): PlanEntry[] {
  return plan
    .filter((e) => e.date < hoy && !e.done)
    .sort((a, b) => a.date.localeCompare(b.date));
}
