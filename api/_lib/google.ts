import { createHmac, timingSafeEqual } from 'node:crypto';
import type { GoogleEvent } from '../../src/lib/calendar.js';
import { MARCA_PROPIA } from '../../src/lib/calendar.js';

/**
 * Cliente minimo de Google Calendar, a base de `fetch`.
 *
 * Sin `googleapis`: son cuatro llamadas REST y esa libreria pesa decenas de
 * megas, que en una funcion serverless se pagan en tiempo de arranque.
 */

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_SECRET = process.env.APP_SECRET;

export const ZONA = 'Europe/Madrid';
/** Calendario aparte de la version anterior; se excluye al leer por si aun existe. */
export const CALENDARIO = 'Recetario';

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

export function configurado(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && APP_SECRET);
}

export function redirectUri(host: string): string {
  return `https://${host}/api/google/callback`;
}

/* --- Estado firmado del OAuth ------------------------------------------- */

/**
 * El parametro `state` viaja por la barra del navegador, asi que va firmado:
 * si no, cualquiera podria volver del callback diciendo ser otra persona y
 * colar su cuenta de Google en la integracion de Andrea.
 */
export function firmarEstado(payload: object): string {
  if (!APP_SECRET) throw new Error('Falta APP_SECRET.');
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const firma = createHmac('sha256', APP_SECRET).update(cuerpo).digest('base64url');
  return `${cuerpo}.${firma}`;
}

export function verificarEstado<T>(state: string): T | null {
  if (!APP_SECRET) return null;
  const [cuerpo, firma] = state.split('.');
  if (!cuerpo || !firma) return null;
  const esperada = createHmac('sha256', APP_SECRET).update(cuerpo).digest('base64url');
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(cuerpo, 'base64url').toString()) as T;
  } catch {
    return null;
  }
}

/* --- OAuth --------------------------------------------------------------- */

export function urlDeConsentimiento(host: string, state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: redirectUri(host),
    response_type: 'code',
    scope: SCOPES,
    // Sin estos dos Google no devuelve refresh_token en reconexiones.
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID!, client_secret: CLIENT_SECRET!, ...body }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

export async function canjearCodigo(code: string, host: string) {
  return tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri(host) });
}

/**
 * Se lanza cuando el refresh token ya no vale y hay que volver a conectar.
 *
 * Pasa sobre todo si la app se quedo en estado "Prueba" en Google: ahi los
 * permisos caducan a los 7 dias. Merece un error propio porque la solucion no
 * es reintentar, es que una persona vuelva a dar permiso.
 */
export class PermisoCaducado extends Error {
  constructor(public personId?: string) {
    super('El permiso de Google ha caducado o se ha revocado. Hay que volver a conectar.');
    this.name = 'PermisoCaducado';
  }
}

/** Los access token duran una hora; se pide uno nuevo en cada sincronizacion. */
export async function accessToken(refreshToken: string): Promise<string> {
  let json: Record<string, unknown>;
  try {
    json = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
  } catch (e) {
    // Google contesta invalid_grant tanto si caduco como si se revoco.
    if (String(e).includes('invalid_grant')) throw new PermisoCaducado();
    throw e;
  }
  const token = json.access_token;
  if (typeof token !== 'string') throw new Error('Google no devolvio access_token.');
  return token;
}

/* --- Calendar ------------------------------------------------------------ */

async function api(token: string, ruta: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(`Calendar ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

/** Lista los calendarios del usuario. */
export async function listarCalendarios(token: string): Promise<{ id: string; summary: string }[]> {
  const json = (await api(token, '/users/me/calendarList?maxResults=250')) as {
    items?: { id: string; summary: string }[];
  };
  return json.items ?? [];
}

/**
 * Id del calendario donde se publican las comidas: el principal de la cuenta.
 * "primary" es el alias que Google entiende para el calendario principal del
 * usuario, asi que no hace falta crear ni buscar ningun calendario aparte.
 */
export function calendarioPropio(): string {
  return 'primary';
}

export async function listarEventos(
  token: string,
  calendarId: string,
  desde: string,
  hasta: string,
): Promise<GoogleEvent[]> {
  const p = new URLSearchParams({
    timeMin: `${desde}T00:00:00Z`,
    timeMax: `${hasta}T23:59:59Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    // Pedir la zona explicitamente es lo que hace que la hora que llega sea la
    // de Madrid y no UTC; `horaLocal()` lee el reloj de pared de esa cadena.
    timeZone: ZONA,
  });
  const json = (await api(token, `/calendars/${encodeURIComponent(calendarId)}/events?${p}`)) as {
    items?: GoogleEvent[];
  };
  return json.items ?? [];
}

export interface EventoAPublicar {
  /** Id de la comida en el Recetario; viaja en el evento para reconocerlo. */
  recetarioId: string;
  titulo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  descripcion?: string;
}

function cuerpoEvento(ev: EventoAPublicar) {
  return {
    summary: ev.titulo,
    description: ev.descripcion,
    start: { dateTime: `${ev.fecha}T${ev.horaInicio}:00`, timeZone: ZONA },
    end: { dateTime: `${ev.fecha}T${ev.horaFin}:00`, timeZone: ZONA },
    // La marca que evita el bucle: si este evento se leyera, se reconoce
    // como propio y se descarta.
    extendedProperties: { private: { [MARCA_PROPIA]: ev.recetarioId } },
  };
}

export async function crearEvento(token: string, calendarId: string, ev: EventoAPublicar): Promise<string> {
  const json = (await api(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(cuerpoEvento(ev)),
  })) as { id: string };
  return json.id;
}

export async function actualizarEvento(
  token: string,
  calendarId: string,
  eventId: string,
  ev: EventoAPublicar,
): Promise<void> {
  await api(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    body: JSON.stringify(cuerpoEvento(ev)),
  });
}

export async function borrarEvento(token: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await api(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
  } catch (e) {
    // Si ya no esta, el objetivo se ha cumplido igualmente.
    if (!String(e).includes('410') && !String(e).includes('404')) throw e;
  }
}
