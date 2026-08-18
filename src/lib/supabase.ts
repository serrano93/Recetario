import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { AppData } from '../types';

/**
 * Capa de sincronizacion opcional.
 *
 * Sin variables de entorno la app funciona igual, guardando solo en este
 * navegador. Al configurar Supabase, los datos pasan a vivir en una unica fila
 * compartida y ambos moviles ven lo mismo casi al instante.
 *
 * La libreria se carga con `import()` dinamico: si no hay Supabase configurado
 * el navegador no llega a descargarla nunca.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(url && anonKey);

/** Todo el recetario vive en una sola fila; el id lo comparten los dos. */
const TABLE = 'recetario';
export const ROW_ID = 'main';

let clientPromise: Promise<SupabaseClient> | null = null;

/** Cliente perezoso: se instancia (y se descarga) la primera vez que hace falta. */
export function getClient(): Promise<SupabaseClient | null> {
  if (!supabaseEnabled) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } }),
  );
  return clientPromise;
}

export interface RemoteRow {
  data: AppData;
  updated_at: string;
}

export async function fetchRemote(): Promise<RemoteRow | null> {
  const client = await getClient();
  if (!client) return null;
  const { data, error } = await client
    .from(TABLE)
    .select('data, updated_at')
    .eq('id', ROW_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as unknown as RemoteRow;
}

export async function pushRemote(payload: AppData): Promise<void> {
  const client = await getClient();
  if (!client) return;
  const { error } = await client
    .from(TABLE)
    .upsert({ id: ROW_ID, data: payload, updated_at: payload.updatedAt }, { onConflict: 'id' });
  if (error) throw error;
}

/** Escucha cambios de la otra persona. Devuelve la funcion para desuscribirse. */
export function subscribeRemote(onChange: (row: RemoteRow) => void): () => void {
  let cancelled = false;
  let client: SupabaseClient | null = null;
  let channel: RealtimeChannel | null = null;

  void getClient().then((c) => {
    if (!c || cancelled) return;
    client = c;
    channel = c
      .channel('recetario-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${ROW_ID}` },
        (payload) => {
          const row = payload.new as unknown as RemoteRow | undefined;
          if (row?.data) onChange(row);
        },
      )
      .subscribe();
  });

  return () => {
    cancelled = true;
    if (client && channel) void client.removeChannel(channel);
  };
}

/* --- Sesion ------------------------------------------------------------- */

export async function currentEmail(): Promise<string | null> {
  const client = await getClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user.email ?? null;
}

/** Avisa de logins y logouts. Devuelve la funcion para dejar de escuchar. */
export function onAuthChange(cb: (email: string | null) => void): () => void {
  let cancelled = false;
  let unsubscribe = () => {};
  void getClient().then((client) => {
    if (!client || cancelled) return;
    const { data } = client.auth.onAuthStateChange((_evt, session) => {
      cb(session?.user.email ?? null);
    });
    unsubscribe = () => data.subscription.unsubscribe();
  });
  return () => {
    cancelled = true;
    unsubscribe();
  };
}

/** Envia el enlace magico de acceso. Devuelve el mensaje de error, si lo hay. */
export async function sendMagicLink(email: string): Promise<string | null> {
  const client = await getClient();
  if (!client) return 'Supabase no esta configurado.';
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  return error?.message ?? null;
}

export async function signOut(): Promise<void> {
  const client = await getClient();
  await client?.auth.signOut();
}
