import { useMemo, useState } from 'react';
import type { AppData, PersonId, PlanEntry, Slot } from '../types';
import { Sheet } from './Sheet';
import { PersonPicker } from './PersonPicker';
import { IconClock, IconTrash } from './icons';
import { formatLong } from '../lib/dates';
import { normalize } from '../lib/ingredients';
import { newId } from '../lib/validate';

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
  onSave: (entry: PlanEntry) => void;
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

  const guardar = () => {
    if (!puedeGuardar) return;
    onSave({
      id: entry?.id ?? newId('e'),
      date,
      slot,
      people,
      recipeId,
      text: recipeId ? undefined : text.trim(),
      done: entry?.done,
    });
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
