import { useMemo, useState } from 'react';
import type { AppData, PersonId, PlanEntry, Slot } from '../types.js';
import { Sheet } from './Sheet.js';
import { PersonPicker } from './PersonPicker.js';
import { IconClock, IconTrash } from './icons.js';
import { formatLong } from '../lib/dates.js';
import { normalize } from '../lib/ingredients.js';
import { nextFreeSlots } from '../lib/plan.js';
import { newId } from '../lib/validate.js';

/**
 * Alta y edicion de una comida del calendario: para quien es, y que se come
 * (una receta del recetario o texto libre tipo "sobras").
 */
export function MealSheet({
  data,
  date,
  slot,
  entry,
  defaultPeople,
  onSave,
  onDelete,
  onClose,
}: {
  data: AppData;
  date: string;
  slot: Slot;
  /** Si viene, estamos editando; si no, creando. */
  entry?: PlanEntry;
  defaultPeople: PersonId[];
  /** `sobras` son entradas extra a crear cuando se cocina la tanda entera. */
  onSave: (entry: PlanEntry, sobras: PlanEntry[]) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [people, setPeople] = useState<PersonId[]>(
    entry?.people ?? (defaultPeople.length ? defaultPeople : data.people.map((p) => p.id)),
  );
  const [recipeId, setRecipeId] = useState<string | undefined>(entry?.recipeId);
  const [text, setText] = useState(entry?.text ?? '');
  const [q, setQ] = useState('');

  const recetas = useMemo(() => {
    const nq = normalize(q);
    return data.recipes
      .filter((r) => (nq ? normalize(`${r.name} ${r.tags.join(' ')}`).includes(nq) : true))
      .sort((a, b) => {
        // Primero las que encajan con el momento del dia, luego favoritas.
        const fitA = a.fits.length === 0 || a.fits.includes(slot) ? 0 : 1;
        const fitB = b.fits.length === 0 || b.fits.includes(slot) ? 0 : 1;
        if (fitA !== fitB) return fitA - fitB;
        if (!!b.favorite !== !!a.favorite) return b.favorite ? 1 : -1;
        return a.name.localeCompare(b.name, 'es');
      });
  }, [data.recipes, q, slot]);

  const puedeGuardar = people.length > 0 && (recipeId !== undefined || text.trim() !== '');

  const receta = recipeId ? data.recipes.find((r) => r.id === recipeId) : undefined;

  // Cuantas comidas mas dan de si las raciones que sobran de la tanda entera.
  const comidasDeSobras =
    receta && people.length > 0
      ? Math.max(0, Math.floor((receta.servings - people.length) / people.length))
      : 0;
  // Las sobras de otra comida no vuelven a generar sobras.
  const puedeTanda = comidasDeSobras > 0 && !entry?.leftoverOf;

  const [batch, setBatch] = useState(entry?.batch ?? false);
  const [crearSobras, setCrearSobras] = useState(true);

  const guardar = () => {
    if (!puedeGuardar) return;
    const id = entry?.id ?? newId('e');
    const principal: PlanEntry = {
      id,
      date,
      slot,
      people,
      recipeId,
      text: recipeId ? undefined : text.trim(),
      done: entry?.done,
      batch: puedeTanda && batch ? true : undefined,
      leftoverOf: entry?.leftoverOf,
    };

    const sobras: PlanEntry[] = [];
    if (puedeTanda && batch && crearSobras && !entry) {
      const huecos = nextFreeSlots(data.plan, date, slot, comidasDeSobras);
      for (const hueco of huecos) {
        sobras.push({
          id: newId('e'),
          date: hueco.date,
          slot: hueco.slot,
          people,
          recipeId,
          leftoverOf: id,
        });
      }
    }

    onSave(principal, sobras);
    onClose();
  };

  return (
    <Sheet
      title={`${slot === 'comida' ? 'Comida' : 'Cena'} · ${formatLong(date)}`}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <button
              className="btn btn-danger"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <IconTrash /> Quitar
            </button>
          )}
          <div className="grow" />
          <button className="btn btn-primary" onClick={guardar} disabled={!puedeGuardar}>
            {entry ? 'Guardar' : 'Añadir'}
          </button>
        </>
      }
    >
      <div className="field">
        <label>¿Para quién?</label>
        <PersonPicker people={data.people} value={people} onChange={setPeople} />
        <p className="tiny muted">
          Con los dos marcados es una comida compartida. Marca solo a uno para ponerle algo distinto.
        </p>
      </div>

      {puedeTanda && (
        <div className="field">
          <label>Cantidad</label>
          <div className="segmented">
            <button type="button" aria-pressed={!batch} onClick={() => setBatch(false)}>
              Justo para {people.length}
            </button>
            <button type="button" aria-pressed={batch} onClick={() => setBatch(true)}>
              Tanda entera ({receta!.servings})
            </button>
          </div>
          <p className="tiny muted">
            {batch
              ? `Se compran los ingredientes completos de la receta y sobran ${comidasDeSobras} ${
                  comidasDeSobras === 1 ? 'comida' : 'comidas'
                }.`
              : `Se compra la parte proporcional para ${people.length}.`}
          </p>
          {batch && !entry && (
            <button
              type="button"
              className="chip chip-toggle"
              aria-pressed={crearSobras}
              onClick={() => setCrearSobras((v) => !v)}
              style={{ alignSelf: 'flex-start' }}
            >
              {crearSobras ? '✓ ' : ''}Planificar las sobras
            </button>
          )}
        </div>
      )}

      <div className="field">
        <label>Algo suelto, sin receta</label>
        <input
          className="input"
          placeholder="Sobras, pizza congelada, cena fuera..."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) setRecipeId(undefined);
          }}
        />
      </div>

      <div className="field">
        <label>O elige una receta</label>
        <input
          className="input"
          placeholder="Buscar en el recetario..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card list">
        {recetas.length === 0 && <p className="empty">No hay recetas que encajen.</p>}
        {recetas.map((r) => {
          const on = recipeId === r.id;
          return (
            <button
              key={r.id}
              className="recipe-card"
              onClick={() => {
                setRecipeId(on ? undefined : r.id);
                if (!on) setText('');
              }}
              style={on ? { background: 'var(--accent-soft)' } : undefined}
            >
              <div className="grow">
                <div className="recipe-title">{r.name}</div>
                <div className="row row-wrap tiny muted" style={{ gap: 6, marginTop: 3 }}>
                  {r.minutes && (
                    <span className="row" style={{ gap: 3 }}>
                      <IconClock /> {r.minutes} min
                    </span>
                  )}
                  <span>{r.servings} raciones</span>
                  {r.tags.slice(0, 2).map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              {on && <span className="chip">elegida</span>}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
