import { useMemo, useState } from 'react';
import { useStore } from '../store.js';
import type { Gasto, PersonId } from '../types.js';
import { today } from '../lib/dates.js';
import { newId } from '../lib/validate.js';
import { conLapidas, sellar } from '../lib/merge.js';
import { formatearEuros, liquidacion, resumenGastos } from '../lib/gastos.js';
import { PersonPicker } from '../components/PersonPicker.js';
import { IconPlus, IconTrash } from '../components/icons.js';

type Pagador = PersonId | 'conjunta';

/** Acepta "12,50" y "12.50"; devuelve euros redondeados al centimo, o null. */
function parseCantidad(texto: string): number | null {
  const n = Number(texto.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function nombreDe(people: { id: PersonId; name: string }[], id: PersonId): string {
  return people.find((p) => p.id === id)?.name ?? id;
}

/**
 * Gastos de la casa: quien paga, a quien se imputa, y el balance de quien debe
 * a quien. Las reglas del dinero viven en `src/lib/gastos.ts` y tienen tests;
 * esta vista solo las pinta.
 */
export function GastosView() {
  const { data, update } = useStore();
  const [concepto, setConcepto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [fecha, setFecha] = useState(today());
  const [pagador, setPagador] = useState<Pagador>('conjunta');
  const [imputados, setImputados] = useState<PersonId[]>(() => data.people.map((p) => p.id));

  const personas = data.people;
  const ids = useMemo(() => personas.map((p) => p.id), [personas]);
  const gastos = data.gastos ?? [];

  const resumen = useMemo(() => resumenGastos(gastos, ids), [gastos, ids]);
  const ordenados = useMemo(
    () =>
      [...gastos].sort(
        (a, b) => b.fecha.localeCompare(a.fecha) || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
      ),
    [gastos],
  );

  const aportes = resumen.aportes;
  const hayAportes =
    aportes.conjunta > 0 || personas.some((p) => (aportes.porPersona[p.id] ?? 0) > 0);

  const deuda = resumen.deuda;
  const fraseBalance = deuda
    ? `${nombreDe(personas, deuda.deudor)} debe ${formatearEuros(deuda.cantidad)} a ${nombreDe(personas, deuda.acreedor)}`
    : 'Estáis en paz';

  const descImputacion = (g: Gasto) => {
    const nombres = g.imputadoA.map((id) => nombreDe(personas, id));
    return nombres.length >= personas.length ? 'para los dos' : `para ${nombres.join(' y ')}`;
  };

  const descPagador = (g: Gasto) =>
    g.pagadoPor === 'conjunta' ? 'de la conjunta' : `pagó ${nombreDe(personas, g.pagadoPor)}`;

  const anadir = () => {
    const importe = parseCantidad(cantidad);
    const nombre = concepto.trim();
    if (!importe || !nombre || imputados.length === 0) return;
    const gasto: Gasto = {
      id: newId('g'),
      fecha,
      concepto: nombre,
      cantidad: importe,
      pagadoPor: pagador,
      imputadoA: imputados,
    };
    update((prev) => ({ ...prev, gastos: [...(prev.gastos ?? []), sellar(gasto)] }));
    setConcepto('');
    setCantidad('');
    setPagador('conjunta');
    setImputados(personas.map((p) => p.id));
  };

  const quitar = (g: Gasto) => {
    if (!confirm(`¿Quitar "${g.concepto}" (${formatearEuros(g.cantidad)})?`)) return;
    update((prev) => ({
      ...prev,
      gastos: (prev.gastos ?? []).filter((x) => x.id !== g.id),
      deleted: conLapidas(prev, [g.id]),
    }));
  };

  const hacerCuentas = () => {
    const ajuste = liquidacion(gastos, ids);
    if (!ajuste) return;
    const deudor = nombreDe(personas, ajuste.pagadoPor as PersonId);
    const acreedor = nombreDe(personas, ajuste.imputadoA[0]);
    const mensaje = `${deudor} paga ${formatearEuros(ajuste.cantidad)} a ${acreedor} y el balance vuelve a cero.\n\nSe apunta en el historial y se puede quitar luego si no hace falta.`;
    if (!confirm(mensaje)) return;
    update((prev) => ({
      ...prev,
      gastos: [...(prev.gastos ?? []), sellar({ ...ajuste, id: newId('g') })],
    }));
  };

  return (
    <div className="view">
      <div className="card" style={{ padding: 14 }}>
        <div className="row row-wrap" style={{ alignItems: 'center', gap: 8 }}>
          <span className="grow" style={{ fontWeight: 700, fontSize: '1.02rem' }}>
            {fraseBalance}
          </span>
          {deuda && (
            <button className="btn btn-primary btn-sm" onClick={hacerCuentas}>
              Hacer cuentas
            </button>
          )}
        </div>
        {hayAportes && (
          <div className="row row-wrap" style={{ gap: 6, marginTop: 8 }}>
            {personas.map((p) => {
              const puesto = aportes.porPersona[p.id] ?? 0;
              if (puesto <= 0) return null;
              return (
                <span key={p.id} className="chip chip-person" style={{ ['--chip-color' as string]: p.color }}>
                  <span className="dot" style={{ ['--chip-color' as string]: p.color }} />
                  {p.name} ha puesto {formatearEuros(puesto)}
                </span>
              );
            })}
            {aportes.conjunta > 0 && (
              <span className="chip">
                De la conjunta {formatearEuros(aportes.conjunta)}
              </span>
            )}
          </div>
        )}
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>
          De la conjunta se paga al 50 %. Si alguien paga de su bolsillo un gasto de los dos, el
          otro le debe la mitad.
        </p>
      </div>

      <div className="section-title">Apuntar un gasto</div>
      <div className="card" style={{ padding: 14 }}>
        <div className="stack">
          <div className="row">
            <input
              className="input grow"
              placeholder="Concepto: la compra del súper, cena fuera..."
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
            <input
              className="input"
              style={{ width: 96, textAlign: 'right' }}
              placeholder="0,00"
              inputMode="decimal"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') anadir();
              }}
            />
            <input
              className="input"
              style={{ width: 142 }}
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              aria-label="Fecha del gasto"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>¿Quién puso el dinero?</label>
            <div className="row row-wrap">
              {personas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip chip-toggle"
                  aria-pressed={pagador === p.id}
                  onClick={() => setPagador(p.id)}
                  style={
                    pagador === p.id
                      ? { background: p.color, borderColor: p.color, color: '#fff' }
                      : undefined
                  }
                >
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                className="chip chip-toggle"
                aria-pressed={pagador === 'conjunta'}
                onClick={() => setPagador('conjunta')}
                style={pagador === 'conjunta' ? { background: 'var(--muted)', borderColor: 'var(--muted)', color: '#fff' } : undefined}
              >
                Conjunta
              </button>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>¿De quién es el gasto?</label>
            <PersonPicker people={personas} value={imputados} onChange={setImputados} />
            <p className="tiny muted" style={{ margin: '6px 0 0' }}>
              Con los dos marcados es compartido a medias; con uno solo, es solo suyo.
            </p>
          </div>
        </div>
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 10 }}
          onClick={anadir}
          disabled={!concepto.trim() || parseCantidad(cantidad) === null || imputados.length === 0}
        >
          <IconPlus /> Apuntar gasto
        </button>
      </div>

      <div className="section-title">
        <span>
          Historial · {gastos.length} {gastos.length === 1 ? 'gasto' : 'gastos'}
        </span>
      </div>

      {gastos.length === 0 && (
        <div className="card">
          <p className="empty">
            Nada apuntado todavía. Cada gasto de la casa que paguéis, aquí.
          </p>
        </div>
      )}

      {ordenados.length > 0 && (
        <div className="card list">
          {ordenados.map((g) => (
            <div key={g.id} className="list-item" style={{ alignItems: 'center' }}>
              <div className="grow">
                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  {g.concepto}
                  {g.ajuste && (
                    <span className="tiny muted" style={{ marginLeft: 6 }}>
                      liquidación
                    </span>
                  )}
                </div>
                <div className="tiny muted">
                  {g.fecha} · {descPagador(g)} · {descImputacion(g)}
                </div>
              </div>
              <span style={{ fontWeight: 700, marginRight: 10 }}>{formatearEuros(g.cantidad)}</span>
              <button
                className="btn btn-ghost btn-sm"
                aria-label={`Quitar ${g.concepto}`}
                onClick={() => quitar(g)}
              >
                <IconTrash size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
