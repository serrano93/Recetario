import { useState } from 'react';
import type { AppData, PersonId, PlanEntry, Recipe, Slot } from '../types.js';
import { SLOTS } from '../types.js';
import { Sheet } from './Sheet.js';
import { PersonPicker } from './PersonPicker.js';
import { IconClock, IconEdit, IconStar } from './icons.js';
import { dayName, dayNumber, rangeFrom, today } from '../lib/dates.js';
import { esBasico, formatQty, normalize } from '../lib/ingredients.js';
import { newId } from '../lib/validate.js';

/** Ficha de la receta: que lleva, como se hace y accesos para editar o planificar. */
export function RecipeDetail({
  data,
  recipe,
  onEdit,
  onToggleFavorite,
  onPlan,
  onClose,
}: {
  data: AppData;
  recipe: Recipe;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onPlan: (entry: PlanEntry) => void;
  onClose: () => void;
}) {
  const [planning, setPlanning] = useState(false);

  if (planning) {
    return (
      <QuickPlan
        data={data}
        recipe={recipe}
        onSave={(entry) => {
          onPlan(entry);
          onClose();
        }}
        onClose={() => setPlanning(false)}
      />
    );
  }

  const pasos = recipe.steps.split('\n').filter((s) => s.trim());

  return (
    <Sheet
      title={recipe.name}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onEdit}>
            <IconEdit /> Editar
          </button>
          <div className="grow" />
          <button className="btn btn-primary" onClick={() => setPlanning(true)}>
            Planificar
          </button>
        </>
      }
    >
      <div className="row row-wrap" style={{ gap: 6 }}>
        <button className="star" aria-pressed={!!recipe.favorite} onClick={onToggleFavorite} aria-label="Favorita">
          <IconStar filled={!!recipe.favorite} />
        </button>
        {recipe.minutes && (
          <span className="chip">
            <IconClock /> {recipe.minutes} min
          </span>
        )}
        <span className="chip">{recipe.servings} raciones</span>
        {recipe.fits.map((f) => (
          <span key={f} className="chip">
            {f}
          </span>
        ))}
        {recipe.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>

      <div>
        <div className="section-title" style={{ marginBottom: 6 }}>
          Ingredientes
        </div>
        <div className="card" style={{ padding: '4px 14px' }}>
          {recipe.ingredients.length === 0 && <p className="empty">Sin ingredientes apuntados.</p>}
          {recipe.ingredients.map((ing, i) => {
            const basico = esBasico(ing, data.despensa);
            return (
              <div key={`${normalize(ing.name)}-${i}`} className="ing-line">
                <span className={basico ? 'muted' : undefined}>
                  {ing.name}
                  {basico && <span className="tiny muted"> · ya en casa</span>}
                </span>
                <span className="muted">{ing.qty ? formatQty(ing.qty, ing.unit ?? 'ud') : 'al gusto'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {pasos.length > 0 && (
        <div>
          <div className="section-title" style={{ marginBottom: 6 }}>
            Pasos
          </div>
          <div className="card" style={{ padding: 14 }}>
            <ol className="steps" style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
              {pasos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {recipe.notes && (
        <div>
          <div className="section-title" style={{ marginBottom: 6 }}>
            Notas
          </div>
          <p className="steps card" style={{ padding: 14, margin: 0 }}>
            {recipe.notes}
          </p>
        </div>
      )}
    </Sheet>
  );
}

/** Elegir dia, momento y comensales para meter una receta en el calendario. */
function QuickPlan({
  data,
  recipe,
  onSave,
  onClose,
}: {
  data: AppData;
  recipe: Recipe;
  onSave: (entry: PlanEntry) => void;
  onClose: () => void;
}) {
  const hoy = today();
  const dias = rangeFrom(hoy, 14);
  const [date, setDate] = useState(hoy);
  const [slot, setSlot] = useState<Slot>(recipe.fits.length === 1 ? recipe.fits[0] : 'comida');
  const [people, setPeople] = useState<PersonId[]>(data.people.map((p) => p.id));

  return (
    <Sheet
      title={`Planificar ${recipe.name}`}
      onClose={onClose}
      footer={
        <>
          <div className="grow" />
          <button
            className="btn btn-primary"
            disabled={people.length === 0}
            onClick={() => onSave({ id: newId('e'), date, slot, people, recipeId: recipe.id })}
          >
            Añadir al plan
          </button>
        </>
      }
    >
      <div className="field">
        <label>¿Qué día?</label>
        <div className="row row-wrap">
          {dias.map((d) => (
            <button
              key={d}
              type="button"
              className="chip chip-toggle"
              aria-pressed={d === date}
              onClick={() => setDate(d)}
            >
              {d === hoy ? 'Hoy' : `${dayName(d, true)} ${dayNumber(d)}`}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>¿Comida o cena?</label>
        <div className="segmented">
          {SLOTS.map((s) => (
            <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}>
              {s === 'comida' ? 'Comida' : 'Cena'}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>¿Para quién?</label>
        <PersonPicker people={data.people} value={people} onChange={setPeople} />
        <p className="tiny muted">
          Las cantidades se escalan solas: esta receta es para {recipe.servings}.
        </p>
      </div>
    </Sheet>
  );
}
