import { useCallback, useEffect, useState } from 'react';
import type { AjustesGoogle } from '../types.js';
import { useStore } from '../store.js';
import { REGLAS_POR_DEFECTO } from '../lib/calendar.js';
import { conectarGoogle, desconectarGoogle, estadoGoogle, sincronizarGoogle } from '../lib/googleClient.js';
import { timeAgo } from '../lib/snapshots.js';

const POR_DEFECTO: AjustesGoogle = {
  leer: true,
  escribir: false,
  horaComida: '14:00',
  horaCena: '21:00',
  reglas: {
    todoElDia: REGLAS_POR_DEFECTO.todoElDia,
    bloqueaComida: REGLAS_POR_DEFECTO.bloqueaComida,
    bloqueaCena: REGLAS_POR_DEFECTO.bloqueaCena,
  },
  ignorados: [],
};

/**
 * Ajustes de Google Calendar.
 *
 * Aqui no se guarda ni se ve ningun token: los refresh tokens viven en el
 * servidor y esta pantalla solo sabe quien esta conectado y quien no.
 */
export function GoogleSettings() {
  const { data, update } = useStore();
  const ajustes = { ...POR_DEFECTO, ...(data.integraciones?.google ?? {}) };

  const [conectados, setConectados] = useState<string[]>([]);
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const refrescar = useCallback(async () => {
    try {
      const e = await estadoGoogle();
      setConfigurado(e.configurado);
      setConectados(e.conectados);
    } catch {
      // Sin sesion o sin backend: se trata como "no configurado" y ya.
      setConfigurado(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const guardar = (parcial: Partial<AjustesGoogle>) =>
    update((prev) => ({
      ...prev,
      integraciones: { ...prev.integraciones, google: { ...ajustes, ...parcial } },
    }));

  const conectar = async (personId: string) => {
    setOcupado(true);
    setAviso(null);
    try {
      window.location.href = await conectarGoogle(personId);
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
      setOcupado(false);
    }
  };

  const desconectar = async (personId: string, nombre: string) => {
    if (!confirm(`¿Desconectar el calendario de ${nombre}?`)) return;
    setOcupado(true);
    try {
      await desconectarGoogle(personId);
      await refrescar();
      setAviso({ tipo: 'ok', texto: `Calendario de ${nombre} desconectado.` });
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    }
    setOcupado(false);
  };

  const sincronizar = async () => {
    setOcupado(true);
    setAviso(null);
    try {
      const r = await sincronizarGoogle();
      if (r.aviso) {
        setAviso({ tipo: 'ok', texto: r.aviso });
      } else {
        const total = (r.resumen ?? []).reduce(
          (acc, x) => ({
            importados: acc.importados + x.importados,
            publicados: acc.publicados + x.creados + x.actualizados,
          }),
          { importados: 0, publicados: 0 },
        );
        setAviso({
          tipo: 'ok',
          texto: `${total.importados} planes traídos del calendario, ${total.publicados} comidas publicadas.`,
        });
      }
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    }
    setOcupado(false);
  };

  if (configurado === false) {
    return (
      <>
        <div className="section-title">Google Calendar</div>
        <div className="card" style={{ padding: 14 }}>
          <p className="small muted" style={{ margin: 0 }}>
            Sin configurar en el servidor. Hace falta crear unas credenciales en Google Cloud
            Console y añadirlas a Vercel; los pasos están en el README.
          </p>
        </div>
      </>
    );
  }

  const listaReglas = (clave: keyof AjustesGoogle['reglas'], etiqueta: string, ayuda: string) => (
    <div className="field">
      <label>{etiqueta}</label>
      <input
        className="input"
        value={ajustes.reglas[clave].join(', ')}
        onChange={(e) =>
          guardar({
            reglas: {
              ...ajustes.reglas,
              [clave]: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            },
          })
        }
      />
      <p className="tiny muted">{ayuda}</p>
    </div>
  );

  return (
    <>
      <div className="section-title">
        <span>Google Calendar</span>
        {ajustes.ultimaSync && <span className="tiny muted">{timeAgo(ajustes.ultimaSync)}</span>}
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div className="stack">
          {data.people.map((p) => {
            const on = conectados.includes(p.id);
            return (
              <div key={p.id} className="row">
                <span className="dot" style={{ ['--chip-color' as string]: p.color }} />
                <span className="grow" style={{ fontWeight: 600 }}>
                  {p.name}
                </span>
                {on ? (
                  <>
                    <span className="chip">conectado</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={ocupado}
                      onClick={() => void desconectar(p.id, p.name)}
                    >
                      Quitar
                    </button>
                  </>
                ) : (
                  <button className="btn btn-sm" disabled={ocupado} onClick={() => void conectar(p.id)}>
                    Conectar
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {conectados.length > 0 && (
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 12 }}
            disabled={ocupado}
            onClick={() => void sincronizar()}
          >
            {ocupado ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        )}

        {aviso && (
          <div className={`banner ${aviso.tipo === 'ok' ? 'banner-ok' : 'banner-error'}`} style={{ marginTop: 10 }}>
            {aviso.texto}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div className="stack">
          <button
            type="button"
            className="chip chip-toggle"
            aria-pressed={ajustes.leer}
            onClick={() => guardar({ leer: !ajustes.leer })}
            style={{ alignSelf: 'flex-start' }}
          >
            {ajustes.leer ? '✓ ' : ''}Leer del calendario
          </button>
          <p className="tiny muted" style={{ margin: 0 }}>
            Trae de vuestros calendarios quién no come en casa. Solo entran los eventos que pisan la
            hora de comer o que llevan una de las palabras de abajo; el resto se ignora.
          </p>

          <button
            type="button"
            className="chip chip-toggle"
            aria-pressed={ajustes.escribir}
            onClick={() => guardar({ escribir: !ajustes.escribir })}
            style={{ alignSelf: 'flex-start' }}
          >
            {ajustes.escribir ? '✓ ' : ''}Publicar las comidas
          </button>
          <p className="tiny muted" style={{ margin: 0 }}>
            Crea un calendario aparte llamado <strong>Recetario</strong> con las comidas
            planificadas, para poder ocultarlo sin ensuciar el vuestro.
          </p>
        </div>
      </div>

      {ajustes.escribir && (
        <div className="card" style={{ padding: 14 }}>
          <div className="grid-2">
            <div className="field">
              <label>Hora de la comida</label>
              <input
                className="input"
                type="time"
                value={ajustes.horaComida}
                onChange={(e) => guardar({ horaComida: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Hora de la cena</label>
              <input
                className="input"
                type="time"
                value={ajustes.horaCena}
                onChange={(e) => guardar({ horaCena: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {ajustes.leer && (
        <div className="card" style={{ padding: 14 }}>
          {listaReglas('todoElDia', 'Bloquean el día entero', 'Cuidado con palabras vagas: "fuera" haría que "comer fuera" te borrase también la cena.')}
          {listaReglas('bloqueaComida', 'Bloquean la comida', 'Además de cualquier evento que pise de 13:00 a 16:00.')}
          {listaReglas('bloqueaCena', 'Bloquean la cena', 'Además de cualquier evento que pise de 20:30 a 23:00.')}
          {ajustes.ignorados.length > 0 && (
            <button className="btn btn-sm" onClick={() => guardar({ ignorados: [] })}>
              Dejar de ignorar {ajustes.ignorados.length} eventos
            </button>
          )}
        </div>
      )}
    </>
  );
}
