import { useMemo, useState } from 'react';
import type { Slot } from '../types.js';
import { SLOTS } from '../types.js';
import { Sheet } from './Sheet.js';
import { porCategoria } from '../lib/alimentos.js';
import type { Borrador, Seleccion } from '../lib/constructor.js';
import {
  APETITOS,
  PREPARACIONES,
  REPARTO_POR_DEFECTO,
  construirReceta,
  nombreSugerido,
  seleccionInicial,
} from '../lib/constructor.js';
import { macrosDeReceta, redondearAporte } from '../lib/nutricion.js';
import { formatQty, normalize } from '../lib/ingredients.js';

/**
 * Constructor de recetas.
 *
 * Eliges qué quieres comer y él pone las cantidades, los pasos y las calorías.
 * No guarda nada por su cuenta: lo que produce se abre en el editor de recetas
 * de siempre, para poder retocarlo antes de guardar. Asi el constructor puede
 * equivocarse sin consecuencias.
 */

const nombres = (cat: Parameters<typeof porCategoria>[0]) => porCategoria(cat).map((a) => a.nombre);

function Selector({
  titulo,
  ayuda,
  opciones,
  valor,
  onChange,
  multiple = true,
  buscador = false,
}: {
  titulo: string;
  ayuda?: string;
  opciones: string[];
  valor: string[];
  onChange: (v: string[]) => void;
  multiple?: boolean;
  buscador?: boolean;
}) {
  const [q, setQ] = useState('');

  const alternar = (op: string) => {
    if (!multiple) {
      onChange(valor.includes(op) ? [] : [op]);
      return;
    }
    onChange(valor.includes(op) ? valor.filter((x) => x !== op) : [...valor, op]);
  };

  // Lo ya elegido no se esconde nunca al filtrar: si no, parece que se ha
  // perdido la selección al escribir en el buscador.
  const nq = normalize(q);
  const visibles = nq ? opciones.filter((o) => normalize(o).includes(nq) || valor.includes(o)) : opciones;

  return (
    <div className="field">
      <label>
        {titulo}
        {valor.length > 0 && <span className="muted"> · {valor.length}</span>}
      </label>
      {buscador && (
        <input
          className="input input-sm"
          placeholder="Filtrar..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}
      <div className="chip-grid">
        {visibles.map((op) => (
          <button
            key={op}
            type="button"
            className="chip chip-toggle"
            aria-pressed={valor.includes(op)}
            onClick={() => alternar(op)}
          >
            {op}
          </button>
        ))}
      </div>
      {ayuda && <p className="tiny muted">{ayuda}</p>}
    </div>
  );
}

/** Barra que enseña cómo queda repartido el plato. */
function BarraPlato({ reparto }: { reparto: Seleccion['reparto'] }) {
  const suma = reparto.proteina + reparto.verdura + reparto.hidrato;
  if (suma <= 0) return null;
  const partes = [
    { k: 'proteina', pct: reparto.proteina, label: 'Proteína' },
    { k: 'verdura', pct: reparto.verdura, label: 'Verduras' },
    { k: 'hidrato', pct: reparto.hidrato, label: 'Hidratos' },
  ].filter((p) => p.pct > 0);

  return (
    <div className="plato-barra" aria-hidden="true">
      {partes.map((p) => (
        <div key={p.k} className={`plato-parte plato-${p.k}`} style={{ flexGrow: p.pct }}>
          {Math.round((p.pct / suma) * 100)}%
        </div>
      ))}
    </div>
  );
}

export function RecipeBuilder({
  onCrear,
  onClose,
}: {
  onCrear: (borrador: Borrador) => void;
  onClose: () => void;
}) {
  const [sel, setSel] = useState<Seleccion>(seleccionInicial('comida', 2));
  const [avanzado, setAvanzado] = useState(false);

  const set = <K extends keyof Seleccion>(k: K, v: Seleccion[K]) =>
    setSel((prev) => ({ ...prev, [k]: v }));

  /** Al cambiar de comida a cena, el reparto por defecto cambia con ella. */
  const cambiarSlot = (slot: Slot) =>
    setSel((prev) => {
      const eraPorDefecto =
        prev.reparto.proteina === REPARTO_POR_DEFECTO[prev.slot].proteina &&
        prev.reparto.verdura === REPARTO_POR_DEFECTO[prev.slot].verdura &&
        prev.reparto.hidrato === REPARTO_POR_DEFECTO[prev.slot].hidrato;
      return {
        ...prev,
        slot,
        // Si lo habían tocado a mano, se respeta.
        reparto: eraPorDefecto ? { ...REPARTO_POR_DEFECTO[slot] } : prev.reparto,
      };
    });

  const borrador = useMemo(() => construirReceta(sel), [sel]);
  const nutricion = useMemo(() => macrosDeReceta({ ...borrador, id: 'preview' }), [borrador]);
  const hayAlgo = sel.proteinas.length + sel.verduras.length + sel.hidratos.length > 0;
  const porRacion = redondearAporte(nutricion.porRacion);

  const setPct = (k: keyof Seleccion['reparto'], v: string) => {
    const n = Number(v.replace(',', '.'));
    set('reparto', { ...sel.reparto, [k]: Number.isFinite(n) && n >= 0 ? n : 0 });
  };

  return (
    <Sheet
      title="Constructor de recetas"
      onClose={onClose}
      footer={
        <>
          {hayAlgo && (
            <div className="tiny muted">
              <strong>{porRacion.kcal}</strong> kcal/ración
            </div>
          )}
          <div className="grow" />
          <button className="btn btn-primary" disabled={!hayAlgo} onClick={() => onCrear(borrador)}>
            Continuar
          </button>
        </>
      }
    >
      <div className="segmented">
        {SLOTS.map((s) => (
          <button key={s} aria-pressed={sel.slot === s} onClick={() => cambiarSlot(s)}>
            {s === 'comida' ? 'Comida' : 'Cena'}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div className="field">
          <label>¿Para cuántos?</label>
          <div className="segmented">
            {[1, 2].map((n) => (
              <button key={n} aria-pressed={sel.comensales === n} onClick={() => set('comensales', n)}>
                {n === 1 ? '1 persona' : '2 personas'}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Hambre</label>
          <div className="segmented">
            {APETITOS.map((a) => (
              <button key={a.id} aria-pressed={sel.apetito === a.id} onClick={() => set('apetito', a.id)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="field">
        <label>Reparto del plato</label>
        <BarraPlato reparto={sel.reparto} />
        <button
          className="btn btn-ghost btn-sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setAvanzado((v) => !v)}
        >
          {avanzado ? 'Ocultar' : 'Ajustar porcentajes'}
        </button>
        {avanzado && (
          <>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              {([
                ['proteina', 'Proteína'],
                ['verdura', 'Verduras'],
                ['hidrato', 'Hidratos'],
              ] as const).map(([k, label]) => (
                <div key={k} className="field grow" style={{ margin: 0 }}>
                  <label className="tiny">{label}</label>
                  <input
                    className="input input-sm"
                    inputMode="numeric"
                    value={String(sel.reparto[k])}
                    onChange={(e) => setPct(k, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: 'flex-start', marginTop: 6 }}
              onClick={() => set('reparto', { ...REPARTO_POR_DEFECTO[sel.slot] })}
            >
              Volver al reparto de {sel.slot}
            </button>
            <p className="tiny muted">
              No hace falta que sumen 100: se usa la proporción entre los tres. El reparto es sobre
              la comida ya hecha, y las cantidades se dan en crudo.
            </p>
          </>
        )}
      </div>

      <Selector
        titulo="Proteína"
        opciones={nombres('proteina')}
        valor={sel.proteinas}
        onChange={(v) => set('proteinas', v)}
      />
      <Selector
        titulo="Verduras"
        opciones={nombres('verdura')}
        valor={sel.verduras}
        onChange={(v) => set('verduras', v)}
        buscador
      />
      <Selector
        titulo="Hidratos"
        opciones={nombres('hidrato')}
        valor={sel.hidratos}
        onChange={(v) => set('hidratos', v)}
      />

      <div className="field">
        <label>Preparación</label>
        <div className="chip-grid">
          {PREPARACIONES.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip chip-toggle"
              aria-pressed={sel.preparacion === p.id}
              onClick={() => set('preparacion', p.id)}
            >
              {p.nombre}
            </button>
          ))}
        </div>
        <p className="tiny muted">Decide los pasos y el aceite que lleva.</p>
      </div>

      <Selector
        titulo="Salsas"
        ayuda="Van con ración fija, no entran en el reparto del plato."
        opciones={nombres('salsa')}
        valor={sel.salsas}
        onChange={(v) => set('salsas', v)}
        buscador
      />
      <Selector
        titulo="Extras"
        opciones={nombres('extra')}
        valor={sel.extras}
        onChange={(v) => set('extras', v)}
        buscador
      />
      <Selector
        titulo="Especias y aliños"
        ayuda="No van a la lista de la compra: se da por hecho que están en casa."
        opciones={nombres('aliño')}
        valor={sel.alinos}
        onChange={(v) => set('alinos', v)}
        buscador
      />

      {hayAlgo && (
        <div className="card resumen">
          <div className="section-title">{nombreSugerido(sel) || 'Tu receta'}</div>
          <table className="tabla-macros">
            <tbody>
              {nutricion.detalle.map((d, i) => (
                <tr key={`${d.ingrediente.name}-${i}`}>
                  <td>{d.ingrediente.name}</td>
                  <td className="num">
                    {d.ingrediente.qty
                      ? formatQty(d.ingrediente.qty, d.ingrediente.unit ?? 'ud')
                      : 'al gusto'}
                  </td>
                  <td className="num muted">
                    {d.aporte && d.aporte.kcal > 0 ? `${Math.round(d.aporte.kcal)} kcal` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="macro-fila">
            {[
              { label: 'kcal', v: porRacion.kcal, u: '' },
              { label: 'Proteína', v: porRacion.prot, u: 'g' },
              { label: 'Hidratos', v: porRacion.hc, u: 'g' },
              { label: 'Grasa', v: porRacion.grasa, u: 'g' },
            ].map((m) => (
              <div key={m.label} className="macro-caja">
                <strong>
                  {m.v}
                  {m.u}
                </strong>
                <span className="tiny muted">{m.label}</span>
              </div>
            ))}
          </div>
          <p className="tiny muted">
            Por ración, y aproximado. {sel.comensales === 2 ? 'La receta sale para dos.' : 'La receta sale para uno.'}
            {nutricion.sinDatos.length > 0 && ` Sin datos de: ${nutricion.sinDatos.join(', ')}.`}
          </p>
        </div>
      )}
    </Sheet>
  );
}
