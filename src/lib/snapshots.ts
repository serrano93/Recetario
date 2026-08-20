import type { AppData } from '../types';

/**
 * Red de seguridad para "Sobrescribir todo".
 *
 * Pegar JSON que ha escrito una IA es una funcion central de la app y es
 * inherentemente arriesgado: si el chat devuelve el documento a medias, el
 * recetario anterior desaparecia sin vuelta atras. Antes de cada sustitucion se
 * guarda la version previa aqui.
 *
 * Vive solo en este navegador: no se sincroniza ni ensucia el documento
 * compartido.
 */

const KEY = 'recetario:snapshots';
const MAXIMO = 10;

export interface Snapshot {
  at: string;
  /** Por que se guardo: "antes de sobrescribir", "antes de fusionar"... */
  motivo: string;
  data: AppData;
}

export function listSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Snapshot[]) : [];
  } catch {
    return [];
  }
}

/** Guarda una copia y tira la mas vieja si nos pasamos de MAXIMO. */
export function pushSnapshot(data: AppData, motivo: string): void {
  const nueva: Snapshot = { at: new Date().toISOString(), motivo, data };
  const todas = [nueva, ...listSnapshots()].slice(0, MAXIMO);
  try {
    localStorage.setItem(KEY, JSON.stringify(todas));
  } catch {
    // Si no cabe, probamos guardando solo la ultima antes de rendirnos:
    // mas vale una copia que ninguna.
    try {
      localStorage.setItem(KEY, JSON.stringify([nueva]));
    } catch {
      // Sin espacio. La app sigue, simplemente sin poder deshacer.
    }
  }
}

export function clearSnapshots(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Da igual: si no se puede borrar, se sobrescribiran solas.
  }
}

/** Resumen legible para el listado: "13 recetas · 14 comidas". */
export function describeSnapshot(s: Snapshot): string {
  const { recipes, plan, events } = s.data;
  const partes = [
    `${recipes.length} ${recipes.length === 1 ? 'receta' : 'recetas'}`,
    `${plan.length} ${plan.length === 1 ? 'comida' : 'comidas'}`,
  ];
  if (events.length) partes.push(`${events.length} ${events.length === 1 ? 'plan' : 'planes'}`);
  return partes.join(' · ');
}

/** "hace 5 min", "hace 2 h", "ayer"... para el listado de copias. */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}
