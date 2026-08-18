import { useState } from 'react';
import { sendMagicLink } from '../lib/supabase';
import { IconChef } from './icons';

/**
 * Acceso por enlace magico: se escribe el email, llega un correo y con tocarlo
 * quedas dentro para siempre en ese movil. Sin contrasenas que recordar.
 */
export function Login({ onSkip }: { onSkip: () => void }) {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado'>('idle');
  const [error, setError] = useState<string | null>(null);

  const enviar = async () => {
    if (!email.trim()) return;
    setEstado('enviando');
    setError(null);
    const err = await sendMagicLink(email.trim());
    if (err) {
      setError(err);
      setEstado('idle');
    } else {
      setEstado('enviado');
    }
  };

  return (
    <div className="center-screen">
      <div className="card" style={{ padding: 24, maxWidth: 380, width: '100%' }}>
        <div className="row" style={{ marginBottom: 14, color: 'var(--accent)' }}>
          <IconChef size={28} />
          <h1 style={{ fontSize: '1.3rem' }}>Recetario</h1>
        </div>

        {estado === 'enviado' ? (
          <div className="banner banner-ok">
            Te he mandado un enlace a <strong>{email}</strong>. Ábrelo desde este mismo móvil y
            entras directo.
          </div>
        ) : (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>
              Entra con tu email para compartir recetas, calendario y compra con la otra persona.
            </p>
            <div className="stack">
              <input
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void enviar();
                }}
              />
              <button
                className="btn btn-primary btn-block"
                onClick={() => void enviar()}
                disabled={!email.trim() || estado === 'enviando'}
              >
                {estado === 'enviando' ? 'Enviando...' : 'Enviarme el enlace'}
              </button>
              {error && <div className="banner banner-error">{error}</div>}
              <button className="btn btn-ghost btn-block" onClick={onSkip}>
                Usar solo en este móvil
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
