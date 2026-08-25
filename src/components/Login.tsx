import { useState } from 'react';
import { signIn } from '../lib/supabase.js';
import { IconChef } from './icons.js';

/** Recuerda quien entro la ultima vez en este movil, para no teclearlo cada dia. */
const ULTIMO_NOMBRE = 'recetario:ultimo-nombre';

/**
 * Acceso con nombre y contraseña. No se pide email: cada nombre se traduce por
 * dentro a una cuenta interna de Supabase.
 */
export function Login({ onSkip }: { onSkip: () => void }) {
  const [nombre, setNombre] = useState(() => localStorage.getItem(ULTIMO_NOMBRE) ?? '');
  const [password, setPassword] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeEntrar = nombre.trim() !== '' && password !== '' && !entrando;

  const entrar = async () => {
    if (!puedeEntrar) return;
    setEntrando(true);
    setError(null);
    const err = await signIn(nombre, password);
    if (err) {
      setError(err);
      setEntrando(false);
    } else {
      try {
        localStorage.setItem(ULTIMO_NOMBRE, nombre.trim());
      } catch {
        // Modo privado: no pasa nada, solo habra que teclearlo la proxima vez.
      }
    }
  };

  return (
    <div className="center-screen">
      <form
        className="card"
        style={{ padding: 24, maxWidth: 380, width: '100%' }}
        onSubmit={(e) => {
          e.preventDefault();
          void entrar();
        }}
      >
        <div className="row" style={{ marginBottom: 14, color: 'var(--accent)' }}>
          <IconChef size={28} />
          <h1 style={{ fontSize: '1.3rem' }}>Recetario</h1>
        </div>

        <p className="small muted" style={{ marginTop: 0 }}>
          Entra para compartir recetas, calendario y compra con la otra persona.
        </p>

        <div className="stack">
          <div className="field">
            <label htmlFor="nombre">Quién eres</label>
            <input
              id="nombre"
              className="input"
              autoComplete="username"
              autoCapitalize="words"
              placeholder="Andrea o Javier"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={!puedeEntrar}>
            {entrando ? 'Entrando...' : 'Entrar'}
          </button>

          {error && <div className="banner banner-error">{error}</div>}

          <button className="btn btn-ghost btn-block" type="button" onClick={onSkip}>
            Usar solo en este móvil
          </button>
        </div>
      </form>
    </div>
  );
}
