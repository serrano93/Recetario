import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StoreProvider, useStore } from './store.js';
import { MealsView } from './views/MealsView.js';
import { PlannerView } from './views/PlannerView.js';
import { ShoppingView } from './views/ShoppingView.js';
import { GastosView } from './views/GastosView.js';
import { DataView } from './views/DataView.js';
import { Login } from './components/Login.js';
import { IconBook, IconCalendar, IconCart, IconChef, IconData, IconWallet } from './components/icons.js';
import { supabaseEnabled } from './lib/supabase.js';
import { sincronizarGoogle } from './lib/googleClient.js';

/** No merece la pena sincronizar mas a menudo que esto al abrir la app. */
const MINUTOS_ENTRE_SYNC = 30;

/**
 * Sincroniza con Google al abrir, si toca.
 *
 * Es el disparo principal: en el plan Hobby de Vercel los cron son de una vez
 * al dia, asi que esperar solo al cron dejaria el calendario desfasado.
 *
 * Devuelve las personas cuyo permiso ha caducado. Con la app de Google en
 * estado "Prueba" eso pasa cada 7 dias, asi que enterarse no puede depender de
 * que a alguien se le ocurra entrar en la pestana Datos.
 */
function useSyncAlAbrir(): string[] {
  const { data, email } = useStore();
  const hecho = useRef(false);
  const [caducados, setCaducados] = useState<string[]>([]);

  useEffect(() => {
    if (!email || hecho.current) return;
    const g = data.integraciones?.google;
    if (!g || (!g.leer && !g.escribir)) return;
    const ultima = g.ultimaSync ? Date.parse(g.ultimaSync) : 0;
    if (Date.now() - ultima < MINUTOS_ENTRE_SYNC * 60_000) return;
    hecho.current = true;
    // Si falla por otra cosa, en silencio: la app funciona igual y el error se
    // ve al sincronizar a mano.
    void sincronizarGoogle()
      .then((r) => setCaducados(r.caducados ?? []))
      .catch(() => {});
  }, [email, data.integraciones?.google]);

  return caducados;
}

type Tab = 'disponibles' | 'semana' | 'compra' | 'gastos' | 'datos';

const TABS: { id: Tab; label: string; title: string; icon: ReactNode }[] = [
  { id: 'disponibles', label: 'Comidas', title: 'Qué podemos comer', icon: <IconBook /> },
  { id: 'semana', label: 'Semana', title: 'Los próximos días', icon: <IconCalendar /> },
  { id: 'compra', label: 'Compra', title: 'Lista de la compra', icon: <IconCart /> },
  { id: 'gastos', label: 'Gastos', title: 'Las cuentas de la casa', icon: <IconWallet /> },
  { id: 'datos', label: 'Datos', title: 'Datos y ajustes', icon: <IconData /> },
];

function SyncBadge() {
  const { sync } = useStore();
  const texto: Record<typeof sync, string | null> = {
    local: null,
    cargando: 'cargando',
    guardando: 'guardando',
    ok: 'en sync',
    error: 'sin sync',
    'sin-sesion': 'local',
  };
  const label = texto[sync];
  if (!label) return null;
  const color =
    sync === 'ok' ? 'var(--green)' : sync === 'error' ? 'var(--danger)' : 'var(--muted)';
  return (
    <span className="sync-badge">
      <span className="dot" style={{ ['--chip-color' as string]: color }} />
      {label}
    </span>
  );
}

function Shell() {
  const { sync, data } = useStore();
  const caducados = useSyncAlAbrir();
  const [tab, setTab] = useState<Tab>('semana');
  const [saltarLogin, setSaltarLogin] = useState(false);

  if (supabaseEnabled && sync === 'sin-sesion' && !saltarLogin) {
    return <Login onSkip={() => setSaltarLogin(true)} />;
  }

  const actual = TABS.find((t) => t.id === tab)!;

  return (
    <div className="app">
      <header className="topbar">
        <span style={{ color: 'var(--accent)', display: 'flex' }}>
          <IconChef size={20} />
        </span>
        <h1>{actual.title}</h1>
        <SyncBadge />
      </header>

      {caducados.length > 0 && tab !== 'datos' && (
        <div className="banner banner-error row" style={{ margin: '12px 16px 0', gap: 10 }}>
          <span className="grow">
            El permiso de Google de{' '}
            <strong>
              {caducados.map((id) => data.people.find((p) => p.id === id)?.name ?? id).join(' y ')}
            </strong>{' '}
            ha caducado.
          </span>
          <button className="btn btn-sm" onClick={() => setTab('datos')}>
            Reconectar
          </button>
        </div>
      )}

      <main>
        {tab === 'disponibles' && <MealsView />}
        {tab === 'semana' && <PlannerView />}
        {tab === 'compra' && <ShoppingView />}
        {tab === 'gastos' && <GastosView />}
        {tab === 'datos' && <DataView />}
      </main>

      <nav className="nav" style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}>
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id} onClick={() => setTab(t.id)}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
