import type { PersonId, PlanEvent, Slot } from '../types';

/**
 * Traduccion entre Google Calendar y el Recetario.
 *
 * Todo lo de aqui es funcion pura: no habla con la red. La parte que si llama a
 * Google vive en `api/google/`, para poder probar estas reglas sin credenciales
 * y sin tocar el calendario de nadie.
 */

/** El trozo de un evento de Google que nos interesa. */
export interface GoogleEvent {
  id: string;
  summary?: string;
  status?: string;
  /** "transparent" = marcado como libre; no cuenta como que no estas. */
  transparency?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export interface ReglasCalendario {
  /** Franja de la comida en horas locales, fin excluido. */
  franjaComida: [number, number];
  franjaCena: [number, number];
  /** Palabras que bloquean el dia entero (viaje, vuelo...). */
  todoElDia: string[];
  bloqueaComida: string[];
  bloqueaCena: string[];
}

export const REGLAS_POR_DEFECTO: ReglasCalendario = {
  franjaComida: [13, 16],
  franjaCena: [20.5, 23],
  // Ojo con meter aqui palabras vagas: "fuera" parece buena idea hasta que
  // "comer fuera" te borra el dia entero en vez de solo la comida.
  todoElDia: ['viaje', 'vuelo', 'congreso', 'vacaciones'],
  bloqueaComida: ['comida con', 'comer fuera', 'almuerzo', 'comida de'],
  bloqueaCena: ['cena', 'cenar'],
};

/** Marca que la app pone en los eventos que crea, para reconocerlos luego. */
export const MARCA_PROPIA = 'recetarioId';

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Hora local del evento, leida del propio texto ISO.
 *
 * Deliberadamente NO se usa `new Date(...).getHours()`: eso da la hora del
 * servidor, y en Vercel el servidor va en UTC. Una comida a las 14:00 en Madrid
 * se leeria como las 12 y no bloquearia nada. Google devuelve la fecha ya en la
 * zona que se le pide, asi que el reloj de pared esta en la propia cadena.
 */
export function horaLocal(dateTime: string): number {
  const m = dateTime.match(/T(\d{2}):(\d{2})/);
  if (!m) return NaN;
  return Number(m[1]) + Number(m[2]) / 60;
}

/** Fecha (YYYY-MM-DD) de un extremo del evento, sea de todo el dia o con hora. */
export function fechaDe(extremo: { date?: string; dateTime?: string } | undefined): string | null {
  if (!extremo) return null;
  if (extremo.date) return extremo.date;
  if (extremo.dateTime) return extremo.dateTime.slice(0, 10);
  return null;
}

function solapa(inicio: number, fin: number, franja: [number, number]): boolean {
  return inicio < franja[1] && fin > franja[0];
}

function contieneAlguna(texto: string, palabras: string[]): boolean {
  const t = normalizar(texto);
  return palabras.some((p) => p && t.includes(normalizar(p)));
}

/** Un dia menos: en Google el fin de un evento de todo el dia es exclusivo. */
function diaAnterior(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d - 1));
  return fecha.toISOString().slice(0, 10);
}

/** ¿Lo creo la propia app? Entonces al leer se ignora, o entramos en bucle. */
export function esNuestro(ev: GoogleEvent): boolean {
  return Boolean(ev.extendedProperties?.private?.[MARCA_PROPIA]);
}

/**
 * Convierte un evento de Google en un plan del Recetario.
 *
 * Devuelve null cuando el evento no afecta a ninguna comida: la mayoria de lo
 * que hay en un calendario (reuniones de las 10, cumpleanos, recordatorios) no
 * tiene nada que ver con si esa noche hay que cocinar, y meterlo todo llenaria
 * la semana de ruido.
 */
export function googleAPlan(
  ev: GoogleEvent,
  personId: PersonId,
  reglas: ReglasCalendario = REGLAS_POR_DEFECTO,
): PlanEvent | null {
  if (ev.status === 'cancelled') return null;
  if (esNuestro(ev)) return null;

  const desde = fechaDe(ev.start);
  if (!desde) return null;

  const titulo = ev.summary?.trim() || 'Ocupado';
  const esTodoElDia = Boolean(ev.start?.date);

  const blocks: Slot[] = [];

  // 1) Palabras clave: mandan sobre el horario, tanto en eventos de todo el dia
  //    como en los que tienen hora.
  if (contieneAlguna(titulo, reglas.todoElDia)) {
    blocks.push('comida', 'cena');
  } else {
    if (contieneAlguna(titulo, reglas.bloqueaComida)) blocks.push('comida');
    if (contieneAlguna(titulo, reglas.bloqueaCena)) blocks.push('cena');

    // 2) Solapamiento horario, solo si el evento ocupa de verdad.
    const libre = ev.transparency === 'transparent';
    if (!libre && !esTodoElDia && ev.start?.dateTime && ev.end?.dateTime) {
      const ini = horaLocal(ev.start.dateTime);
      const fin = horaLocal(ev.end.dateTime);
      if (!Number.isNaN(ini) && !Number.isNaN(fin)) {
        if (!blocks.includes('comida') && solapa(ini, fin, reglas.franjaComida)) blocks.push('comida');
        if (!blocks.includes('cena') && solapa(ini, fin, reglas.franjaCena)) blocks.push('cena');
      }
    }
  }

  if (blocks.length === 0) return null;

  let hasta = fechaDe(ev.end) ?? desde;
  // El fin de un evento de todo el dia es exclusivo: "hasta el 30" llega el 29.
  if (esTodoElDia && hasta > desde) hasta = diaAnterior(hasta);
  if (hasta < desde) hasta = desde;

  return {
    id: `g_${ev.id}`,
    title: titulo,
    people: [personId],
    from: desde,
    to: hasta,
    blocks: blocks.sort(),
    origen: 'google',
    externalId: ev.id,
  };
}

/**
 * Convierte todos los eventos de una persona, descartando los ignorados a mano.
 * Devuelve solo los que afectan a alguna comida.
 */
export function importarEventos(
  eventos: GoogleEvent[],
  personId: PersonId,
  reglas: ReglasCalendario = REGLAS_POR_DEFECTO,
  ignorados: string[] = [],
): PlanEvent[] {
  const fuera = new Set(ignorados);
  return eventos
    .filter((ev) => !fuera.has(ev.id))
    .map((ev) => googleAPlan(ev, personId, reglas))
    .filter((x): x is PlanEvent => x !== null);
}
