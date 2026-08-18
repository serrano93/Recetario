import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppData } from './types';
import { seedData } from './lib/seed';
import { sanitize } from './lib/validate';
import {
  currentEmail,
  fetchRemote,
  onAuthChange,
  pushRemote,
  signOut as remoteSignOut,
  subscribeRemote,
  supabaseEnabled,
} from './lib/supabase';

const STORAGE_KEY = 'recetario:v1';

export type SyncState = 'local' | 'cargando' | 'guardando' | 'ok' | 'error' | 'sin-sesion';

interface StoreValue {
  data: AppData;
  /** Aplica un cambio; se persiste solo (local + Supabase si esta configurado). */
  update: (fn: (prev: AppData) => AppData) => void;
  /** Sustituye TODO el recetario (import de JSON editado por una IA). */
  replaceAll: (next: AppData) => void;
  sync: SyncState;
  syncError: string | null;
  /** Email de la sesion de Supabase, si hay. */
  email: string | null;
  signOut: () => Promise<void>;
}

const StoreCtx = createContext<StoreValue | null>(null);

function loadLocal(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedData();
    return sanitize(JSON.parse(raw)).data;
  } catch {
    return seedData();
  }
}

function saveLocal(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Cuota llena o modo privado: seguimos en memoria sin romper nada.
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadLocal);
  const [sync, setSync] = useState<SyncState>(supabaseEnabled ? 'cargando' : 'local');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  /** Datos pendientes de subir, para no perder cambios rapidos seguidos. */
  const pending = useRef<AppData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Evita reenviar a Supabase lo que acaba de llegar de Supabase. */
  const skipPush = useRef(false);

  const flush = useCallback(async () => {
    const payload = pending.current;
    pending.current = null;
    if (!payload || !supabaseEnabled) return;
    setSync('guardando');
    try {
      await pushRemote(payload);
      setSync('ok');
      setSyncError(null);
    } catch (e) {
      setSync('error');
      setSyncError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const commit = useCallback(
    (next: AppData) => {
      const stamped = { ...next, updatedAt: new Date().toISOString() };
      setData(stamped);
      saveLocal(stamped);
      if (!supabaseEnabled || skipPush.current) {
        skipPush.current = false;
        return;
      }
      pending.current = stamped;
      if (timer.current) clearTimeout(timer.current);
      // Agrupamos rafagas de ediciones en una sola escritura.
      timer.current = setTimeout(() => void flush(), 600);
    },
    [flush],
  );

  const update = useCallback(
    (fn: (prev: AppData) => AppData) => {
      setData((prev) => {
        const next = { ...fn(prev), updatedAt: new Date().toISOString() };
        saveLocal(next);
        if (supabaseEnabled) {
          pending.current = next;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void flush(), 600);
        }
        return next;
      });
    },
    [flush],
  );

  const replaceAll = useCallback((next: AppData) => commit(next), [commit]);

  // Sesion de Supabase.
  useEffect(() => {
    if (!supabaseEnabled) return;
    let alive = true;
    void currentEmail().then((mail) => {
      if (!alive) return;
      setEmail(mail);
      if (!mail) setSync('sin-sesion');
    });
    const off = onAuthChange((mail) => {
      setEmail(mail);
      setSync(mail ? 'cargando' : 'sin-sesion');
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  // Carga inicial desde Supabase y escucha de cambios de la otra persona.
  useEffect(() => {
    if (!supabaseEnabled || !email) return;
    let alive = true;

    void (async () => {
      try {
        const row = await fetchRemote();
        if (!alive) return;
        if (!row) {
          // Primera vez: sembramos la fila compartida con lo que haya en local.
          pending.current = data;
          await flush();
        } else {
          const remote = sanitize(row.data).data;
          setData((local) => {
            // Gana el mas reciente; asi no se pisan cambios hechos sin conexion.
            if (remote.updatedAt >= local.updatedAt) {
              saveLocal(remote);
              return remote;
            }
            pending.current = local;
            void flush();
            return local;
          });
          setSync('ok');
        }
      } catch (e) {
        if (!alive) return;
        setSync('error');
        setSyncError(e instanceof Error ? e.message : String(e));
      }
    })();

    const unsub = subscribeRemote((row) => {
      const remote = sanitize(row.data).data;
      setData((local) => {
        if (remote.updatedAt <= local.updatedAt) return local;
        skipPush.current = true;
        saveLocal(remote);
        return remote;
      });
    });

    return () => {
      alive = false;
      unsub();
    };
    // `data` solo se usa para sembrar la fila la primera vez; no queremos
    // reconectar el canal en cada tecleo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, flush]);

  // Al cerrar la pestana, subimos lo que quede pendiente.
  useEffect(() => {
    const onHide = () => {
      if (pending.current) void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [flush]);

  const signOut = useCallback(async () => {
    await remoteSignOut();
  }, []);

  const value = useMemo<StoreValue>(
    () => ({ data, update, replaceAll, sync, syncError, email, signOut }),
    [data, update, replaceAll, sync, syncError, email, signOut],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore fuera de StoreProvider');
  return ctx;
}
