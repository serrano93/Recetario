import { useMemo, useState } from 'react';
import type { PlanEntry, Recipe, Slot } from '../types.js';
import { useStore } from '../store.js';
import { normalize } from '../lib/ingredients.js';
import { conLapidas, sellar } from '../lib/merge.js';
import { RecipeSheet } from '../components/RecipeSheet.js';
import { RecipeDetail } from '../components/RecipeDetail.js';
import { IconClock, IconPlus, IconStar } from '../components/icons.js';

type Filtro = 'todo' | Slot | 'favoritas';

/**
 * El repertorio: todo lo que se puede comer o cenar, filtrable.
 * Es el punto de partida para decidir "¿que hacemos hoy?".
 */
export function MealsView() {
  const { data, update } = useStore();
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const [detalle, setDetalle] = useState<Recipe | null>(null);
  const [editando, setEditando] = useState<{ recipe?: Recipe } | null>(null);

  const recetas = useMemo(() => {
    const nq = normalize(q);
    return data.recipes
      .filter((r) => {
        if (nq) {
          const heno = normalize(
            `${r.name} ${r.tags.join(' ')} ${r.ingredients.map((i) => i.name).join(' ')}`,
          );
          if (!heno.includes(nq)) return false;
        }
        if (filtro === 'favoritas') return !!r.favorite;
        if (filtro === 'comida' || filtro === 'cena') {
          return r.fits.length === 0 || r.fits.includes(filtro);
        }
        return true;
      })
      .sort((a, b) => {
        if (!!b.favorite !== !!a.favorite) return b.favorite ? 1 : -1;
        return a.name.localeCompare(b.name, 'es');
      });
  }, [data.recipes, q, filtro]);

  const guardarReceta = (r: Recipe) =>
    update((prev) => ({
      ...prev,
      recipes: prev.recipes.some((x) => x.id === r.id)
        ? prev.recipes.map((x) => (x.id === r.id ? sellar(r) : x))
        : [...prev.recipes, sellar(r)],
    }));

  const borrarReceta = (id: string) =>
    update((prev) => ({
      ...prev,
      recipes: prev.recipes.filter((r) => r.id !== id),
      deleted: conLapidas(prev, [id]),
      // Las comidas ya planificadas se conservan como texto para no vaciar el calendario.
      plan: prev.plan.map((e) =>
        e.recipeId === id
          ? sellar({ ...e, recipeId: undefined, text: prev.recipes.find((r) => r.id === id)?.name })
          : e,
      ),
    }));

  const alternarFavorita = (id: string) =>
    update((prev) => ({
      ...prev,
      recipes: prev.recipes.map((r) => (r.id === id ? sellar({ ...r, favorite: !r.favorite }) : r)),
    }));

  const planificar = (entry: PlanEntry) =>
    update((prev) => ({ ...prev, plan: [...prev.plan, sellar(entry)] }));

  const filtros: { id: Filtro; label: string }[] = [
    { id: 'todo', label: 'Todo' },
    { id: 'comida', label: 'Comidas' },
    { id: 'cena', label: 'Cenas' },
    { id: 'favoritas', label: 'Favoritas' },
  ];

  return (
    <div className="view">
      <input
        className="input"
        placeholder="Buscar por nombre, etiqueta o ingrediente..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="segmented">
        {filtros.map((f) => (
          <button key={f.id} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card list">
        {recetas.length === 0 && (
          <p className="empty">
            {data.recipes.length === 0
              ? 'Aún no hay recetas. Toca el botón + para escribir la primera.'
              : 'Nada coincide con la búsqueda.'}
          </p>
        )}
        {recetas.map((r) => (
          <div key={r.id} className="recipe-card">
            <button
              className="grow"
              style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }}
              onClick={() => setDetalle(r)}
            >
              <div className="recipe-title">{r.name}</div>
              <div className="row row-wrap tiny muted" style={{ gap: 6, marginTop: 3 }}>
                {r.minutes && (
                  <span className="row" style={{ gap: 3 }}>
                    <IconClock /> {r.minutes} min
                  </span>
                )}
                <span>{r.ingredients.length} ingredientes</span>
                {r.tags.slice(0, 2).map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            </button>
            <button
              className="star"
              aria-pressed={!!r.favorite}
              aria-label="Favorita"
              onClick={() => alternarFavorita(r.id)}
            >
              <IconStar filled={!!r.favorite} />
            </button>
          </div>
        ))}
      </div>

      <button className="fab" aria-label="Nueva receta" onClick={() => setEditando({})}>
        <IconPlus size={24} />
      </button>

      {detalle && !editando && (
        <RecipeDetail
          data={data}
          recipe={data.recipes.find((r) => r.id === detalle.id) ?? detalle}
          onEdit={() => setEditando({ recipe: detalle })}
          onToggleFavorite={() => alternarFavorita(detalle.id)}
          onPlan={planificar}
          onClose={() => setDetalle(null)}
        />
      )}

      {editando && (
        <RecipeSheet
          recipe={editando.recipe}
          onSave={guardarReceta}
          onDelete={
            editando.recipe
              ? () => {
                  borrarReceta(editando.recipe!.id);
                  setDetalle(null);
                }
              : undefined
          }
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}
