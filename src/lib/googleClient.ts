import { getClient } from './supabase.js';

/**
 * Llamadas a las funciones de `api/google/` desde el navegador.
 *
 * Todas van firmadas con el token de sesion de Supabase en la cabecera
 * Authorization: los endpoints lo verifican antes de tocar ningun calendario.
 */

async function cabeceras(): Promise<HeadersInit> {
  const client = await getClient();
  const { data } = (await client?.auth.getSession()) ?? { data: { session: null } };
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function pedir<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(ruta, { ...init, headers: await cabeceras() });

  // Sin backend (dev, preview) el catch-all de la SPA devuelve el index.html
  // con un 200 tan tranquilo. Si no se comprueba el tipo, ese HTML se cuela
  // como si fuera una respuesta buena y revienta mas adelante.
  const tipo = res.headers.get('content-type') ?? '';
  if (!tipo.includes('application/json')) {
    throw new Error('El servidor no ha respondido (¿funciones desplegadas?).');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Error ${res.status}`);
  return json as T;
}

export interface EstadoGoogle {
  configurado: boolean;
  conectados: string[];
}

export async function estadoGoogle(): Promise<EstadoGoogle> {
  const r = await pedir<Partial<EstadoGoogle>>('/api/google/estado');
  // Se normaliza en vez de confiar: un `conectados` que no sea array haria
  // caer toda la pantalla de ajustes al recorrerlo.
  return {
    configurado: r.configurado === true,
    conectados: Array.isArray(r.conectados) ? r.conectados : [],
  };
}

/** Devuelve la URL de consentimiento; el navegador tiene que ir a ella. */
export async function conectarGoogle(personId: string): Promise<string> {
  const { url } = await pedir<{ url: string }>('/api/google/auth', {
    method: 'POST',
    body: JSON.stringify({ personId }),
  });
  return url;
}

export function desconectarGoogle(personId: string): Promise<{ ok: true }> {
  return pedir('/api/google/desconectar', {
    method: 'POST',
    body: JSON.stringify({ personId }),
  });
}

export interface ResultadoSync {
  ok: true;
  desde?: string;
  hasta?: string;
  aviso?: string;
  /** Personas cuyo permiso caduco: hay que volver a conectarlas. */
  caducados?: string[];
  resumen?: { persona: string; importados: number; creados: number; actualizados: number; borrados: number }[];
}

export function sincronizarGoogle(): Promise<ResultadoSync> {
  return pedir<ResultadoSync>('/api/google/sync', { method: 'POST' });
}
