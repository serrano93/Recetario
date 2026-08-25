import type { AppData, PersonId, Recipe, Slot } from '../types.js';
import { addDays } from './dates.js';
import { entriesFor, entryLabel } from './plan.js';
import { normalize } from './ingredients.js';

/**
 * Lo que la skill de Alexa entiende y contesta, sin nada de red.
 *
 * Vive aparte del endpoint para poder probarlo: las respuestas habladas son
 * justo lo que mas se rompe al tocar cosas, y no se puede estar pidiendole a
 * Alexa que cene todos los dias para comprobarlo.
 */

/** Zona horaria de la casa. El servidor va en UTC y eso enganaria a "hoy". */
export const ZONA_CASA = 'Europe/Madrid';

/**
 * Fecha de hoy en la zona de casa.
 *
 * A las 00:30 en Madrid el servidor (UTC) todavia cree que es ayer, y "que
 * cenamos hoy" contestaria la cena de anoche.
 */
export function hoyEnCasa(ahora = new Date(), zona = ZONA_CASA): string {
  // en-CA da directamente el formato YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(ahora);
}

/** Hora local (0-23) en la zona de casa. */
export function horaEnCasa(ahora = new Date(), zona = ZONA_CASA): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: zona,
    hour: '2-digit',
    hour12: false,
  }).format(ahora);
  return Number(h);
}

/**
 * Convierte el slot AMAZON.DATE en una fecha concreta.
 *
 * Alexa manda "2026-08-27" para un dia suelto, pero tambien cosas como
 * "2026-W35" para "esta semana" o "2026-08" para "agosto". De esas nos
 * quedamos con el primer dia, que es lo mas util al preguntar por comidas.
 */
export function resolverFecha(valor: string | undefined, hoy: string): string {
  if (!valor) return hoy;
  const v = valor.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // Semana ISO: se aproxima al lunes de esa semana.
  const semana = v.match(/^(\d{4})-W(\d{2})$/);
  if (semana) {
    const enero4 = new Date(Date.UTC(Number(semana[1]), 0, 4));
    const lunesDeLa1 = new Date(enero4);
    lunesDeLa1.setUTCDate(enero4.getUTCDate() - ((enero4.getUTCDay() + 6) % 7));
    lunesDeLa1.setUTCDate(lunesDeLa1.getUTCDate() + (Number(semana[2]) - 1) * 7);
    return lunesDeLa1.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`;
  return hoy;
}

/**
 * Que comida quiere saber.
 *
 * Sin decirlo, se deduce de la hora: por la manana interesa la comida, por la
 * tarde ya la cena. Preguntar "¿comida o cena?" a las nueve de la noche seria
 * de robot.
 */
export function resolverMomento(valor: string | undefined, hora: number): Slot {
  const v = normalize(valor ?? '');
  if (v.includes('cena') || v.includes('cenar') || v.includes('noche')) return 'cena';
  if (v.includes('comida') || v.includes('comer') || v.includes('almuerzo')) return 'comida';
  return hora >= 16 ? 'cena' : 'comida';
}

/** A quien se refiere, si nombra a alguien de la casa. */
export function resolverPersona(valor: string | undefined, personas: { id: PersonId; name: string }[]): PersonId | null {
  const v = normalize(valor ?? '');
  if (!v) return null;
  return personas.find((p) => normalize(p.name) === v || v.includes(normalize(p.name)))?.id ?? null;
}

/** Busca una receta por lo que se haya entendido, sin exigir clavarlo. */
export function buscarReceta(texto: string | undefined, recetas: Recipe[]): Recipe | null {
  const q = normalize(texto ?? '');
  if (!q) return null;

  const exacta = recetas.find((r) => normalize(r.name) === q);
  if (exacta) return exacta;

  const contiene = recetas.find((r) => normalize(r.name).includes(q) || q.includes(normalize(r.name)));
  if (contiene) return contiene;

  // Ultimo intento: la que mas palabras comparta. "lentejas" encuentra
  // "Lentejas con chorizo" aunque Alexa entienda solo media frase.
  const palabras = q.split(' ').filter((p) => p.length > 3);
  let mejor: { receta: Recipe; puntos: number } | null = null;
  for (const r of recetas) {
    const n = normalize(r.name);
    const puntos = palabras.filter((p) => n.includes(p)).length;
    if (puntos > 0 && (!mejor || puntos > mejor.puntos)) mejor = { receta: r, puntos };
  }
  return mejor?.receta ?? null;
}

/* --- Frases ------------------------------------------------------------- */

function comoSeLlamaElDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'hoy';
  if (fecha === addDays(hoy, 1)) return 'mañana';
  if (fecha === addDays(hoy, -1)) return 'ayer';
  return `el ${fecha.slice(8, 10)}`;
}

/** Respuesta a "¿qué comemos?". */
export function fraseQueComemos(data: AppData, fecha: string, slot: Slot, hoy: string): string {
  const cuando = comoSeLlamaElDia(fecha, hoy);
  const momento = slot === 'comida' ? 'comer' : 'cenar';
  const entradas = entriesFor(data.plan, fecha, slot);

  if (entradas.length === 0) {
    return `No hay nada planificado para ${momento} ${cuando}.`;
  }

  const compartida = entradas.length === 1 && entradas[0].people.length === data.people.length;
  if (compartida) {
    const e = entradas[0];
    const receta = e.recipeId ? data.recipes.find((r) => r.id === e.recipeId) : undefined;
    const tiempo = receta?.minutes ? ` Son ${receta.minutes} minutos.` : '';
    const sobras = e.leftoverOf ? ' Son las sobras.' : '';
    return `${cuando === 'hoy' ? 'Hoy' : cuando[0].toUpperCase() + cuando.slice(1)} toca ${entryLabel(data, e)}.${tiempo}${sobras}`;
  }

  const partes = entradas.map((e) => {
    const quien = e.people.map((id) => data.people.find((p) => p.id === id)?.name ?? 'alguien').join(' y ');
    return `${quien}, ${entryLabel(data, e)}`;
  });
  return `Para ${momento} ${cuando}: ${partes.join('. Y ')}.`;
}

/** Respuesta a "¿qué lleva X?". */
export function fraseIngredientes(receta: Recipe): string {
  const principales = receta.ingredients.filter((i) => !i.basico);
  if (principales.length === 0) return `${receta.name} no tiene ingredientes apuntados.`;
  const lista = principales.map((i) => i.name);
  const ultimo = lista.pop();
  const texto = lista.length ? `${lista.join(', ')} y ${ultimo}` : ultimo;
  return `${receta.name} lleva ${texto}.`;
}

/** Un paso de la receta, y si quedan más. */
export function frasePaso(receta: Recipe, indice: number): { texto: string; hayMas: boolean } {
  const pasos = receta.steps.split('\n').map((p) => p.trim()).filter(Boolean);
  if (pasos.length === 0) {
    return { texto: `${receta.name} no tiene los pasos apuntados.`, hayMas: false };
  }
  if (indice >= pasos.length) {
    return { texto: 'Ya está, no hay más pasos.', hayMas: false };
  }
  const hayMas = indice < pasos.length - 1;
  const cola = hayMas ? ' Di siguiente cuando quieras.' : ' Y con eso ya está.';
  return { texto: `Paso ${indice + 1}. ${pasos[indice]}.${cola}`, hayMas };
}

/** Confirmación al apuntar algo en la compra. */
export function fraseAnadido(producto: string): string {
  return `Apuntado: ${producto}.`;
}

/** Confirmación al decir que alguien come fuera. */
export function fraseComeFuera(
  data: AppData,
  personaId: PersonId | null,
  fecha: string,
  slot: Slot,
  hoy: string,
): string {
  const cuando = comoSeLlamaElDia(fecha, hoy);
  const momento = slot === 'comida' ? 'comer' : 'cenar';
  if (!personaId) {
    return `Hecho, ${cuando} no hay que ${momento} en casa.`;
  }
  const quien = data.people.find((p) => p.id === personaId)?.name ?? 'esa persona';
  const otros = data.people.filter((p) => p.id !== personaId).map((p) => p.name);
  const resto = otros.length === 1 ? ` Solo cocinas para ${otros[0]}.` : '';
  return `Hecho, ${quien} no ${momento === 'comer' ? 'come' : 'cena'} en casa ${cuando}.${resto}`;
}

/* --- Comprobaciones de la peticion de Amazon ----------------------------- */

const CERT_HOST = 's3.amazonaws.com';
const CERT_RUTA = '/echo.api/';
/** Amazon exige rechazar peticiones de mas de 150 s: frena los reenvios. */
const TOLERANCIA_MS = 150_000;

/**
 * La URL del certificado es la primera barrera contra una peticion falsa, y la
 * mas importante: solo Amazon puede poner ficheros en esa ruta de su bucket.
 * Vive aqui, y no junto al resto de la verificacion, para poder probarla sin
 * arrastrar el modulo de criptografia de Node.
 */
export function urlCertificadoValida(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      u.hostname.toLowerCase() === CERT_HOST &&
      (u.port === '' || u.port === '443') &&
      // El parseo ya colapsa los "/../" con los que se podria escapar de la ruta.
      u.pathname.startsWith(CERT_RUTA)
    );
  } catch {
    return false;
  }
}

/** Una peticion vieja se rechaza: es lo que frena reenviar una capturada. */
export function marcaDeTiempoValida(timestamp: string | undefined, ahora = Date.now()): boolean {
  if (!timestamp) return false;
  const t = Date.parse(timestamp);
  if (Number.isNaN(t)) return false;
  return Math.abs(ahora - t) <= TOLERANCIA_MS;
}
