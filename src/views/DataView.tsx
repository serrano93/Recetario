import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { buildAiPrompt } from '../lib/aiPrompt';
import { parseJsonLoose, sanitize, sanitizePartial } from '../lib/validate';
import { seedData } from '../lib/seed';
import { supabaseEnabled } from '../lib/supabase';
import { describeSnapshot, listSnapshots, timeAgo, type Snapshot } from '../lib/snapshots';
import { IconCopy } from '../components/icons';
import { GoogleSettings } from '../components/GoogleSettings';

/**
 * Puente con cualquier IA: se copia todo el recetario (con instrucciones), se
 * edita en el chat que quieras y se pega de vuelta para sobrescribirlo.
 * Tambien vive aqui la configuracion: nombres, despensa y sesion.
 */
export function DataView() {
  const { data, replaceAll, mergeIn, update, email, signOut, sync, syncError } = useStore();
  const [pegado, setPegado] = useState('');
  const [modo, setModo] = useState<'fusionar' | 'sobrescribir'>('fusionar');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string; detalles?: string[] } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [despensa, setDespensa] = useState(data.despensa.join(', '));
  const [copias, setCopias] = useState<Snapshot[]>(listSnapshots);

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

  const aplicar = () => {
    const parsed = parseJsonLoose(pegado);
    if (!parsed.ok) {
      setAviso({ tipo: 'error', texto: `No he podido leer el JSON: ${parsed.error}` });
      return;
    }

    if (modo === 'fusionar') {
      const ids = new Set(data.people.map((p) => p.id));
      const { patch, warnings, counts } = sanitizePartial(parsed.value, ids);
      const partes = Object.entries(counts).map(([k, n]) => `${n} ${k}`);
      if (partes.length === 0) {
        setAviso({ tipo: 'error', texto: 'No he encontrado nada que fusionar.', detalles: warnings });
        return;
      }
      mergeIn(patch);
      setPegado('');
      if (patch.despensa) setDespensa(patch.despensa.join(', '));
      setCopias(listSnapshots());
      setAviso({ tipo: 'ok', texto: `Fusionado: ${partes.join(', ')}.`, detalles: warnings });
      return;
    }

    const { data: limpio, warnings } = sanitize(parsed.value);
    const resumen = `${limpio.recipes.length} recetas, ${limpio.plan.length} comidas y ${limpio.events.length} planes.`;
    if (!confirm(`Esto reemplaza TODO el recetario por ${resumen}\n\nSe guarda una copia para deshacer.\n\n¿Seguimos?`)) return;
    replaceAll(limpio);
    setPegado('');
    setDespensa(limpio.despensa.join(', '));
    setCopias(listSnapshots());
    setAviso({ tipo: 'ok', texto: `Cargado: ${resumen}`, detalles: warnings });
  };

  const restaurar = (copia: Snapshot) => {
    if (!confirm(`Volver a la copia de ${timeAgo(copia.at)} (${describeSnapshot(copia)})?`)) return;
    replaceAll(copia.data, 'antes de restaurar');
    setDespensa(copia.data.despensa.join(', '));
    setCopias(listSnapshots());
    setAviso({ tipo: 'ok', texto: `Restaurada la copia de ${timeAgo(copia.at)}.` });
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
          Copia el recetario con las instrucciones y pégalo en el chat que uses. Dentro verás un
          hueco marcado <strong>ESCRIBE AQUÍ LO QUE QUIERES</strong>: ahí pones tu petición
          ("planifícame la semana con recetas rápidas", "añade estas recetas"). Luego pega aquí su
          respuesta.
        </p>
        <p className="small muted" style={{ marginTop: 0 }}>
          Si te contesta con un menú en texto en vez de JSON, dile{' '}
          <em>"devuélvemelo solo como bloque JSON"</em> y lo reintenta.
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
        <label>Pegar la respuesta</label>
        <textarea
          className="textarea code"
          placeholder="Pega aquí el JSON que te devuelva la IA..."
          value={pegado}
          onChange={(e) => setPegado(e.target.value)}
          spellCheck={false}
        />
        <div className="segmented">
          <button aria-pressed={modo === 'fusionar'} onClick={() => setModo('fusionar')}>
            Fusionar
          </button>
          <button aria-pressed={modo === 'sobrescribir'} onClick={() => setModo('sobrescribir')}>
            Reemplazar
          </button>
        </div>
        <p className="tiny muted">
          {modo === 'fusionar'
            ? 'Añade y actualiza lo que venga, sin tocar el resto. Acepta trozos sueltos, como solo las recetas nuevas.'
            : 'Reemplaza el recetario entero. Lo que no venga en el JSON se pierde.'}
        </p>
        <button className="btn btn-primary btn-block" onClick={aplicar} disabled={!pegado.trim()}>
          {modo === 'fusionar' ? 'Fusionar con lo que hay' : 'Reemplazar todo el recetario'}
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

      {copias.length > 0 && (
        <>
          <div className="section-title">
            <span>Copias de seguridad</span>
            <button className="btn btn-primary btn-sm" onClick={() => restaurar(copias[0])}>
              Deshacer
            </button>
          </div>
          <div className="card list">
            {copias.map((c) => (
              <div key={c.at} className="list-item">
                <div className="grow">
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{timeAgo(c.at)}</div>
                  <div className="tiny muted">
                    {c.motivo} · {describeSnapshot(c)}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={() => restaurar(c)}>
                  Restaurar
                </button>
              </div>
            ))}
          </div>
          <p className="tiny muted">
            Se guarda una copia antes de cada fusión o sobrescritura. Solo en este móvil: no se
            sincronizan.
          </p>
        </>
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

      <GoogleSettings />

      <div className="section-title">Sincronización</div>
      <div className="card" style={{ padding: 14 }}>
        {supabaseEnabled ? (
          <>
            <p className="small" style={{ marginTop: 0 }}>
              Conectado como <strong>{email?.split('@')[0] ?? 'sin sesión'}</strong>. Los cambios se comparten entre
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
