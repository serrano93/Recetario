import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StoreProvider, useStore } from './store.js';
import { MealsView } from './views/MealsView.js';
import { PlannerView } from './views/PlannerView.js';
import { ShoppingView } from './views/ShoppingView.js';
import { DataView } from './views/DataView.js';
import { Login } from './components/Login.js';
import { IconBook, IconCalendar, IconCart, IconChef, IconData } from './components/icons.js';
import { supabaseEnabled } from './lib/supabase.js';
import { sincronizarGoogle } from './lib/googleClient.js';

/** No merece la pena sincronizar mas a menudo que esto al abrir la app. */
const MINUTOS_ENTRE_SYNC = 30;

/**
 * Sincroniza con Google al abrir, si toca.
 *
 * Es el disparo principal: en el plan Hobby de Vercel los cron son de una vez
 * al dia, asi que esperar solo al cron dejaria el calendario desfasado.
 */
function useSyncAlAbrir() {
  const { data, email } = useStore();
  const hecho = useRef(false);

  useEffect(() => {
    if (!email || hecho.current) return;
    const g = data.integraciones?.google;
    if (!g || (!g.leer && !g.escribir)) return;
    const ultima = g.ultimaSync ? Date.parse(g.ultimaSync) : 0;
    if (Date.now() - ultima < MINUTOS_ENTRE_SYNC * 60_000) return;
    hecho.current = true;
    // En silencio: si falla, la app funciona igual y se ve el error al
    // sincronizar a mano desde Datos.
    void sincronizarGoogle().catch(() => {});
  }, [email, data.integraciones?.google]);
}

type Tab = 'disponibles' | 'semana' | 'compra' | 'datos';

const TABS: { id: Tab; label: string; title: string; icon: ReactNode }[] = [
  { id: 'disponibles', label: 'Comidas', title: 'Qué podemos comer', icon: <IconBook /> },
  { id: 'semana', label: 'Semana', title: 'Los próximos días', icon: <IconCalendar /> },
  { id: 'compra', label: 'Compra', title: 'Lista de la compra', icon: <IconCart /> },
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
  const { sync } = useStore();
  useSyncAlAbrir();
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

      <main>
        {tab === 'disponibles' && <MealsView />}
        {tab === 'semana' && <PlannerView />}
        {tab === 'compra' && <ShoppingView />}
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
