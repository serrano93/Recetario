import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppData } from '../../src/types.js';

/**
 * Acceso a Supabase desde el servidor.
 *
 * Usa la clave `service_role`, que se salta RLS. Solo existe en las variables
 * de entorno de Vercel y NO lleva prefijo VITE_, que es justo lo que la meteria
 * en el bundle publico.
 */

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function admin(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.');
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Comprueba que quien llama tiene sesion de verdad.
 *
 * Sin esto cualquiera que descubra la URL podria disparar sincronizaciones
 * contra vuestro calendario. Devuelve el email, o null si el token no vale.
 */
export async function usuarioDe(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.email ?? data.user.id;
}

export const ROW_ID = 'main';

export async function leerRecetario(): Promise<AppData | null> {
  const { data, error } = await admin()
    .from('recetario')
    .select('data')
    .eq('id', ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return (data?.data as AppData) ?? null;
}

export async function guardarRecetario(next: AppData): Promise<void> {
  const stamped = { ...next, updatedAt: new Date().toISOString() };
  const { error } = await admin()
    .from('recetario')
    .upsert({ id: ROW_ID, data: stamped, updated_at: stamped.updatedAt }, { onConflict: 'id' });
  if (error) throw error;
}

export interface Integracion {
  person_id: string;
  refresh_token: string;
  calendar_id: string | null;
}

export async function leerIntegracion(personId: string): Promise<Integracion | null> {
  const { data, error } = await admin()
    .from('integraciones')
    .select('person_id, refresh_token, calendar_id')
    .eq('person_id', personId)
    .maybeSingle();
  if (error) throw error;
  return (data as Integracion) ?? null;
}

export async function listarIntegraciones(): Promise<Integracion[]> {
  const { data, error } = await admin()
    .from('integraciones')
    .select('person_id, refresh_token, calendar_id');
  if (error) throw error;
  return (data as Integracion[]) ?? [];
}

export async function guardarIntegracion(
  personId: string,
  refreshToken: string,
  calendarId?: string | null,
): Promise<void> {
  const fila: Record<string, unknown> = {
    person_id: personId,
    proveedor: 'google',
    refresh_token: refreshToken,
    actualizado: new Date().toISOString(),
  };
  if (calendarId !== undefined) fila.calendar_id = calendarId;
  const { error } = await admin().from('integraciones').upsert(fila, { onConflict: 'person_id' });
  if (error) throw error;
}

export async function borrarIntegracion(personId: string): Promise<void> {
  const { error } = await admin().from('integraciones').delete().eq('person_id', personId);
  if (error) throw error;
}
