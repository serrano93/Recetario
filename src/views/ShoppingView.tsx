import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { rangeFrom, today } from '../lib/dates';
import { buildShoppingList, formatQty, normalize, parseIngredient } from '../lib/ingredients';
import { IconCheck, IconCopy, IconTrash } from '../components/icons';
import { newId } from '../lib/validate';
import { conLapidas, sellar } from '../lib/merge';

/**
 * Lista de la compra: se calcula sola a partir de lo planificado en los
 * proximos dias, sumando cantidades y descontando lo de la despensa. Encima se
 * pueden anadir cosas sueltas a mano.
 */
export function ShoppingView() {
  const { data, update } = useStore();
  const [dias, setDias] = useState(7);
  const [nuevo, setNuevo] = useState('');
  const [copiado, setCopiado] = useState(false);

  const hoy = today();
  const fechas = useMemo(() => rangeFrom(hoy, dias), [hoy, dias]);
  const lineas = useMemo(() => buildShoppingList(data, fechas), [data, fechas]);

  const comprados = useMemo(() => new Set(data.compradosIds), [data.compradosIds]);
  const pendientes = lineas.filter((l) => !comprados.has(l.key));
  const hechos = lineas.filter((l) => comprados.has(l.key));

  const alternar = (key: string) =>
    update((prev) => ({
      ...prev,
      compradosIds: prev.compradosIds.includes(key)
        ? prev.compradosIds.filter((k) => k !== key)
        : [...prev.compradosIds, key],
    }));

  const anadir = () => {
    const ing = parseIngredient(nuevo);
    if (!ing) return;
    update((prev) => ({
      ...prev,
      compra: [...prev.compra, sellar({ id: newId('c'), name: ing.name, qty: ing.qty, unit: ing.unit })],
      // Si ya estaba tachado de una compra anterior, vuelve a la lista.
      compradosIds: prev.compradosIds.filter((k) => k !== normalize(ing.name)),
    }));
    setNuevo('');
  };

  const quitarManual = (key: string) =>
    update((prev) => {
      const fuera = prev.compra.filter((i) => normalize(i.name) === key).map((i) => i.id);
      return {
        ...prev,
        compra: prev.compra.filter((i) => !fuera.includes(i.id)),
        deleted: conLapidas(prev, fuera),
      };
    });

  const limpiarTachados = () =>
    update((prev) => {
      // Los items sueltos ya comprados desaparecen; los de recetas vuelven solos.
      const fuera = prev.compra.filter((i) => prev.compradosIds.includes(normalize(i.name))).map((i) => i.id);
      return {
        ...prev,
        compradosIds: [],
        compra: prev.compra.filter((i) => !fuera.includes(i.id)),
        deleted: conLapidas(prev, fuera),
      };
    });

  const copiar = async () => {
    const texto = pendientes
      .map((l) => {
        const cant = l.amounts.map((a) => formatQty(a.qty, a.unit)).join(' + ');
        return cant ? `- ${l.name}: ${cant}` : `- ${l.name}`;
      })
      .join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div className="view">
      <div className="segmented">
        {[3, 7, 14].map((n) => (
          <button key={n} aria-pressed={dias === n} onClick={() => setDias(n)}>
            {n} días
          </button>
        ))}
      </div>

      <div className="row">
        <input
          className="input grow"
          placeholder="Añadir suelto: 2 l leche, papel de cocina..."
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') anadir();
          }}
        />
        <button className="btn btn-primary" onClick={anadir} disabled={!nuevo.trim()}>
          Añadir
        </button>
      </div>

      <div className="section-title">
        <span>
          Por comprar · {pendientes.length} {pendientes.length === 1 ? 'cosa' : 'cosas'}
        </span>
        {pendientes.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={copiar}>
            <IconCopy /> {copiado ? 'Copiado' : 'Copiar'}
          </button>
        )}
      </div>

      <div className="card">
        {pendientes.length === 0 && (
          <p className="empty">
            Nada que comprar. Planifica comidas en la pestaña Semana y la lista se llena sola.
          </p>
        )}
        {pendientes.map((l) => (
          <div key={l.key} className="shop-item">
            <button className="meal-check" aria-pressed={false} aria-label="Marcar comprado" onClick={() => alternar(l.key)} />
            <div className="grow">
              <div className="shop-name">
                {l.name}
                {l.amounts.length > 0 && (
                  <span className="muted" style={{ fontWeight: 400 }}>
                    {' · '}
                    {l.amounts.map((a) => formatQty(a.qty, a.unit)).join(' + ')}
                  </span>
                )}
              </div>
              {l.from.length > 0 && <div className="tiny muted">{l.from.join(' · ')}</div>}
              {l.manual && l.from.length === 0 && <div className="tiny muted">añadido a mano</div>}
            </div>
            {l.manual && (
              <button className="btn btn-ghost btn-sm" aria-label="Quitar" onClick={() => quitarManual(l.key)}>
                <IconTrash size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {hechos.length > 0 && (
        <>
          <div className="section-title">
            <span>En el carro · {hechos.length}</span>
            <button className="btn btn-ghost btn-sm" onClick={limpiarTachados}>
              Vaciar
            </button>
          </div>
          <div className="card">
            {hechos.map((l) => (
              <div key={l.key} className="shop-item shop-done">
                <button
                  className="meal-check"
                  aria-pressed
                  aria-label="Desmarcar"
                  onClick={() => alternar(l.key)}
                >
                  <IconCheck />
                </button>
                <div className="grow">
                  <div className="shop-name">{l.name}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="tiny muted">
        No salen sal, aceite ni especias. Puedes cambiar esa lista en la pestaña Datos.
      </p>
    </div>
  );
}
