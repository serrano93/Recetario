import type { AppData, PersonId, PlanEntry, PlanEvent, Slot } from '../types';
import { isBetween } from './dates';

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

/** Nombre visible de una comida planificada. */
export function entryLabel(data: AppData, entry: PlanEntry): string {
  if (entry.recipeId) {
    const r = data.recipes.find((x) => x.id === entry.recipeId);
    if (r) return r.name;
  }
  return entry.text ?? 'Sin definir';
}
