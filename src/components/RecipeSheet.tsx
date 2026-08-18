import { useState } from 'react';
import type { Recipe, Slot } from '../types';
import { SLOTS } from '../types';
import { Sheet } from './Sheet';
import { IconTrash } from './icons';
import { ingredientToLine, parseIngredient } from '../lib/ingredients';
import { newId } from '../lib/validate';

/**
 * Editor de receta.
 *
 * Los ingredientes se escriben como texto libre, uno por linea ("500 g pollo"),
 * y se parsean al guardar. Es mucho mas rapido en el movil que un formulario
 * con tres campos por ingrediente.
 */
export function RecipeSheet({
  recipe,
  onSave,
  onDelete,
  onClose,
}: {
  recipe?: Recipe;
  onSave: (r: Recipe) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [servings, setServings] = useState(String(recipe?.servings ?? 2));
  const [minutes, setMinutes] = useState(recipe?.minutes ? String(recipe.minutes) : '');
  const [tags, setTags] = useState(recipe?.tags.join(', ') ?? '');
  const [fits, setFits] = useState<Slot[]>(recipe?.fits ?? []);
  const [ingredients, setIngredients] = useState(
    (recipe?.ingredients ?? []).map(ingredientToLine).join('\n'),
  );
  const [steps, setSteps] = useState(recipe?.steps ?? '');
  const [notes, setNotes] = useState(recipe?.notes ?? '');

  const toggleFit = (s: Slot) =>
    setFits((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const guardar = () => {
    const nombre = name.trim();
    if (!nombre) return;
    const raciones = Number(servings.replace(',', '.'));
    const mins = Number(minutes.replace(',', '.'));
    onSave({
      id: recipe?.id ?? newId('r'),
      name: nombre,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      servings: Number.isFinite(raciones) && raciones > 0 ? raciones : 2,
      minutes: Number.isFinite(mins) && mins > 0 ? mins : undefined,
      fits,
      ingredients: ingredients
        .split('\n')
        .map(parseIngredient)
        .filter((x): x is NonNullable<typeof x> => x !== null),
      steps: steps.trim(),
      notes: notes.trim() || undefined,
      favorite: recipe?.favorite,
    });
    onClose();
  };

  return (
    <Sheet
      title={recipe ? 'Editar receta' : 'Nueva receta'}
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
              <IconTrash /> Borrar
            </button>
          )}
          <div className="grow" />
          <button className="btn btn-primary" onClick={guardar} disabled={!name.trim()}>
            Guardar
          </button>
        </>
      }
    >
      <div className="field">
        <label>Nombre</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lentejas con chorizo"
          autoFocus={!recipe}
        />
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Raciones</label>
          <input
            className="input"
            inputMode="decimal"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Minutos</label>
          <input
            className="input"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="30"
          />
        </div>
      </div>

      <div className="field">
        <label>¿Para comida o cena?</label>
        <div className="row">
          {SLOTS.map((s) => (
            <button
              key={s}
              type="button"
              className="chip chip-toggle"
              aria-pressed={fits.includes(s)}
              onClick={() => toggleFit(s)}
            >
              {s === 'comida' ? 'Comida' : 'Cena'}
            </button>
          ))}
        </div>
        <p className="tiny muted">Sin marcar nada, vale para cualquier momento.</p>
      </div>

      <div className="field">
        <label>Ingredientes principales</label>
        <textarea
          className="textarea"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder={'500 g pechuga de pollo\n2 cebollas\n1 limón'}
          spellCheck={false}
        />
        <p className="tiny muted">
          Uno por línea, con cantidad y unidad si quieres. Las cantidades se escalan solas segun
          cuanta gente coma y se suman en la lista de la compra. No hace falta poner sal, aceite ni
          especias.
        </p>
      </div>

      <div className="field">
        <label>Pasos</label>
        <textarea
          className="textarea"
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          placeholder={'Pochar la cebolla.\nAñadir las lentejas y cubrir de agua.'}
        />
      </div>

      <div className="field">
        <label>Etiquetas</label>
        <input
          className="input"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="rápido, tupper, vegetariano"
        />
      </div>

      <div className="field">
        <label>Notas</label>
        <textarea
          className="textarea"
          style={{ minHeight: 60 }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Sheet>
  );
}
