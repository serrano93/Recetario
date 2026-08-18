import { useState } from 'react';
import type { ReactNode } from 'react';
import { StoreProvider, useStore } from './store';
import { MealsView } from './views/MealsView';
import { PlannerView } from './views/PlannerView';
import { ShoppingView } from './views/ShoppingView';
import { DataView } from './views/DataView';
import { Login } from './components/Login';
import { IconBook, IconCalendar, IconCart, IconChef, IconData } from './components/icons';
import { supabaseEnabled } from './lib/supabase';

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
