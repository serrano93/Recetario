import type { Person, PersonId } from '../types';

/** Etiqueta de color con el nombre de una persona. */
export function PersonChip({ person }: { person: Person }) {
  return (
    <span className="chip chip-person" style={{ ['--chip-color' as string]: person.color }}>
      <span className="dot" style={{ ['--chip-color' as string]: person.color }} />
      {person.name}
    </span>
  );
}

/**
 * Selector de para quien es una comida o a quien afecta un plan.
 *
 * Con los dos seleccionados es algo compartido; con uno solo, individual.
 * Se permite dejarlo vacio cuando `allowEmpty` (en planes = "a los dos").
 */
export function PersonPicker({
  people,
  value,
  onChange,
  allowEmpty = false,
}: {
  people: Person[];
  value: PersonId[];
  onChange: (next: PersonId[]) => void;
  allowEmpty?: boolean;
}) {
  const toggle = (id: PersonId) => {
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    if (next.length === 0 && !allowEmpty) return;
    // Mantenemos el orden original de `people` para que la UI no baile.
    onChange(people.filter((p) => next.includes(p.id)).map((p) => p.id));
  };

  return (
    <div className="row row-wrap">
      {people.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            className="chip chip-toggle"
            aria-pressed={on}
            onClick={() => toggle(p.id)}
            style={on ? { background: p.color, borderColor: p.color, color: '#fff' } : undefined}
          >
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
