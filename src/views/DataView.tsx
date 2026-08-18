import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { buildAiPrompt } from '../lib/aiPrompt';
import { parseJsonLoose, sanitize } from '../lib/validate';
import { seedData } from '../lib/seed';
import { supabaseEnabled } from '../lib/supabase';
import { IconCopy } from '../components/icons';

/**
 * Puente con cualquier IA: se copia todo el recetario (con instrucciones), se
 * edita en el chat que quieras y se pega de vuelta para sobrescribirlo.
 * Tambien vive aqui la configuracion: nombres, despensa y sesion.
 */
export function DataView() {
  const { data, replaceAll, update, email, signOut, sync, syncError } = useStore();
  const [pegado, setPegado] = useState('');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string; detalles?: string[] } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [despensa, setDespensa] = useState(data.despensa.join(', '));

  const json = useMemo(() => JSON.stringify(data, null, 2), [data]);

  const copiar = async (texto: string, etiqueta: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(etiqueta);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      setAviso({ tipo: 'error', texto: 'El navegador no ha dejado copiar. Selecciona el texto a mano.' });
    }
  };

  const sobrescribir = () => {
    const parsed = parseJsonLoose(pegado);
    if (!parsed.ok) {
      setAviso({ tipo: 'error', texto: `No he podido leer el JSON: ${parsed.error}` });
      return;
    }
    const { data: limpio, warnings } = sanitize(parsed.value);
    const resumen = `${limpio.recipes.length} recetas, ${limpio.plan.length} comidas y ${limpio.events.length} planes.`;
    if (!confirm(`Esto reemplaza TODO el recetario por ${resumen}\n\n¿Seguimos?`)) return;
    replaceAll(limpio);
    setPegado('');
    setDespensa(limpio.despensa.join(', '));
    setAviso({ tipo: 'ok', texto: `Cargado: ${resumen}`, detalles: warnings });
  };

  const descargar = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recetario-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const guardarDespensa = () =>
    update((prev) => ({
      ...prev,
      despensa: despensa
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }));

  const renombrar = (id: string, name: string) =>
    update((prev) => ({
      ...prev,
      people: prev.people.map((p) => (p.id === id ? { ...p, name } : p)),
    }));

  return (
    <div className="view">
      <div className="section-title">Editar con una IA</div>
      <div className="card" style={{ padding: 14 }}>
        <p className="small muted" style={{ marginTop: 0 }}>
          Copia el recetario con las instrucciones, pégalo en el chat que uses y pídele lo que
          quieras: "planifícame la semana con lo que hay", "añade estas recetas", "haz una semana
          vegetariana". Luego pega aquí su respuesta.
        </p>
        <div className="row row-wrap">
          <button className="btn btn-primary" onClick={() => copiar(buildAiPrompt(data), 'prompt')}>
            <IconCopy /> {copiado === 'prompt' ? 'Copiado' : 'Copiar para la IA'}
          </button>
          <button className="btn" onClick={() => copiar(json, 'json')}>
            {copiado === 'json' ? 'Copiado' : 'Copiar solo el JSON'}
          </button>
          <button className="btn" onClick={descargar}>
            Descargar
          </button>
        </div>
      </div>

      <div className="field">
        <label>Pegar y sobrescribir</label>
        <textarea
          className="textarea code"
          placeholder="Pega aquí el JSON que te devuelva la IA..."
          value={pegado}
          onChange={(e) => setPegado(e.target.value)}
          spellCheck={false}
        />
        <button className="btn btn-primary btn-block" onClick={sobrescribir} disabled={!pegado.trim()}>
          Sobrescribir todo
        </button>
      </div>

      {aviso && (
        <div className={`banner ${aviso.tipo === 'ok' ? 'banner-ok' : 'banner-error'}`}>
          <strong>{aviso.texto}</strong>
          {aviso.detalles && aviso.detalles.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {aviso.detalles.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="section-title">Estado actual</div>
      <div className="card" style={{ padding: 14 }}>
        <p className="small" style={{ margin: 0 }}>
          {data.recipes.length} recetas · {data.plan.length} comidas planificadas ·{' '}
          {data.events.length} planes
        </p>
        <details style={{ marginTop: 10 }}>
          <summary className="small muted" style={{ cursor: 'pointer' }}>
            Ver el JSON
          </summary>
          <textarea className="textarea code" readOnly value={json} style={{ marginTop: 8 }} />
        </details>
      </div>

      <div className="section-title">Nombres</div>
      <div className="card" style={{ padding: 14 }}>
        <div className="stack">
          {data.people.map((p) => (
            <div key={p.id} className="row">
              <span className="dot" style={{ ['--chip-color' as string]: p.color }} />
              <input
                className="input grow"
                value={p.name}
                onChange={(e) => renombrar(p.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="section-title">Despensa</div>
      <div className="card" style={{ padding: 14 }}>
        <p className="small muted" style={{ marginTop: 0 }}>
          Cosas que siempre hay en casa. Nunca aparecen en la lista de la compra.
        </p>
        <textarea
          className="textarea"
          style={{ minHeight: 70 }}
          value={despensa}
          onChange={(e) => setDespensa(e.target.value)}
          onBlur={guardarDespensa}
          spellCheck={false}
        />
        <button className="btn btn-sm" onClick={guardarDespensa} style={{ marginTop: 8 }}>
          Guardar despensa
        </button>
      </div>

      <div className="section-title">Sincronización</div>
      <div className="card" style={{ padding: 14 }}>
        {supabaseEnabled ? (
          <>
            <p className="small" style={{ marginTop: 0 }}>
              Conectado como <strong>{email ?? 'sin sesión'}</strong>. Los cambios se comparten entre
              los dos automáticamente.
            </p>
            {sync === 'error' && syncError && (
              <div className="banner banner-error" style={{ marginBottom: 10 }}>
                Error al sincronizar: {syncError}
              </div>
            )}
            <button className="btn" onClick={() => void signOut()}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            Ahora mismo los datos solo viven en este navegador. Configura Supabase (ver README) para
            compartirlos entre los dos móviles.
          </p>
        )}
      </div>

      <div className="section-title">Zona peligrosa</div>
      <div className="card" style={{ padding: 14 }}>
        <div className="row row-wrap">
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm('¿Empezar de cero con las recetas de ejemplo? Se pierde todo lo demás.')) {
                replaceAll(seedData());
                setAviso({ tipo: 'ok', texto: 'Recetario reiniciado.' });
              }
            }}
          >
            Reiniciar recetario
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm('¿Vaciar el calendario? Las recetas se quedan.')) {
                update((prev) => ({ ...prev, plan: [], events: [] }));
                setAviso({ tipo: 'ok', texto: 'Calendario vaciado.' });
              }
            }}
          >
            Vaciar calendario
          </button>
        </div>
      </div>
    </div>
  );
}
