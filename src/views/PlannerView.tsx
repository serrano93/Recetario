import { useMemo, useState } from 'react';
import type { PlanEntry, PlanEvent, Slot } from '../types';
import { SLOTS } from '../types';
import { useStore } from '../store';
import { dayName, dayNumber, monthName, rangeFrom, today } from '../lib/dates';
import { blockedIn, coveredIn, dinersFor, entriesFor, entryLabel, eventsOn } from '../lib/plan';
import { MealSheet } from '../components/MealSheet';
import { EventSheet } from '../components/EventSheet';
import { IconCheck, IconPlane, IconPlus } from '../components/icons';

type MealTarget =
  | { mode: 'new'; date: string; slot: Slot; people: string[] }
  | { mode: 'edit'; date: string; slot: Slot; entry: PlanEntry };

/**
 * Calendario rodante: siempre 7 dias empezando hoy, en vez de semanas fijas de
 * lunes a domingo. Encaja mejor con un horario flexible.
 */
export function PlannerView() {
  const { data, update } = useStore();
  const [dias, setDias] = useState(7);
  const [meal, setMeal] = useState<MealTarget | null>(null);
  const [evento, setEvento] = useState<{ ev?: PlanEvent; from: string } | null>(null);

  const hoy = today();
  const fechas = useMemo(() => rangeFrom(hoy, dias), [hoy, dias]);

  const guardarComida = (entry: PlanEntry) =>
    update((prev) => ({
      ...prev,
      plan: prev.plan.some((e) => e.id === entry.id)
        ? prev.plan.map((e) => (e.id === entry.id ? entry : e))
        : [...prev.plan, entry],
    }));

  const borrarComida = (id: string) =>
    update((prev) => ({ ...prev, plan: prev.plan.filter((e) => e.id !== id) }));

  const alternarHecho = (id: string) =>
    update((prev) => ({
      ...prev,
      plan: prev.plan.map((e) => (e.id === id ? { ...e, done: !e.done } : e)),
    }));

  const guardarEvento = (ev: PlanEvent) =>
    update((prev) => ({
      ...prev,
      events: prev.events.some((x) => x.id === ev.id)
        ? prev.events.map((x) => (x.id === ev.id ? ev : x))
        : [...prev.events, ev],
    }));

  const borrarEvento = (id: string) =>
    update((prev) => ({ ...prev, events: prev.events.filter((e) => e.id !== id) }));

  const persona = (id: string) => data.people.find((p) => p.id === id);

  return (
    <div className="view">
      <div className="section-title">
        <span>Próximos {dias} días</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setEvento({ from: hoy })}>
          <IconPlus size={15} /> Plan
        </button>
      </div>

      {fechas.map((fecha) => {
        const planes = eventsOn(data.events, fecha);
        const esHoy = fecha === hoy;

        return (
          <section key={fecha} className={`day${esHoy ? ' day-today' : ''}`}>
            <header className="day-head">
              <span className="name">{esHoy ? 'Hoy' : dayName(fecha)}</span>
              <span className="num">
                {dayNumber(fecha)} {monthName(fecha).slice(0, 3)}
              </span>
            </header>

            {planes.map((ev) => (
              <button
                key={ev.id}
                className="event-pill"
                style={{ width: '100%', border: 0, borderBottom: '1px solid var(--border)' }}
                onClick={() => setEvento({ ev, from: fecha })}
              >
                <IconPlane />
                <span className="grow" style={{ textAlign: 'left' }}>
                  {ev.title}
                </span>
                {ev.people.map((pid) => {
                  const p = persona(pid);
                  return p ? (
                    <span key={pid} className="dot" style={{ ['--chip-color' as string]: p.color }} />
                  ) : null;
                })}
              </button>
            ))}

            {SLOTS.map((slot) => {
              const entries = entriesFor(data.plan, fecha, slot);
              const comensales = dinersFor(data, fecha, slot);
              const bloqueados = blockedIn(data.events, fecha, slot);
              const cubiertos = coveredIn(entries);
              const faltan = comensales.filter((id) => !cubiertos.has(id));

              return (
                <div key={slot} className="slot">
                  <div className="slot-head">
                    <span className="slot-label">{slot}</span>
                    {comensales.length > 0 && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setMeal({
                            mode: 'new',
                            date: fecha,
                            slot,
                            people: faltan.length ? faltan : comensales,
                          })
                        }
                      >
                        <IconPlus size={14} /> Añadir
                      </button>
                    )}
                  </div>

                  {entries.map((entry) => {
                    const compartida = entry.people.length === data.people.length;
                    return (
                      <div key={entry.id} className={`meal${entry.done ? ' meal-done' : ''}`}>
                        <button
                          className="meal-check"
                          aria-pressed={!!entry.done}
                          aria-label="Marcar como hecho"
                          onClick={() => alternarHecho(entry.id)}
                        >
                          {entry.done && <IconCheck />}
                        </button>
                        <button
                          className="grow"
                          style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }}
                          onClick={() => setMeal({ mode: 'edit', date: fecha, slot, entry })}
                        >
                          <div className="meal-name">{entryLabel(data, entry)}</div>
                          {!compartida && (
                            <div className="row row-wrap" style={{ gap: 4, marginTop: 4 }}>
                              {entry.people.map((pid) => {
                                const p = persona(pid);
                                return p ? (
                                  <span
                                    key={pid}
                                    className="chip chip-person"
                                    style={{ ['--chip-color' as string]: p.color }}
                                  >
                                    {p.name}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}

                  {[...bloqueados.entries()].map(([pid, ev]) => {
                    const p = persona(pid);
                    return (
                      <p key={pid} className="tiny muted" style={{ margin: '2px 0 0' }}>
                        {p?.name ?? 'Alguien'} no come en casa · {ev.title}
                      </p>
                    );
                  })}

                  {entries.length === 0 && comensales.length === 0 && bloqueados.size === 0 && (
                    <p className="tiny muted" style={{ margin: 0 }}>
                      Nadie come en casa.
                    </p>
                  )}

                  {entries.length === 0 && comensales.length > 0 && (
                    <p className="tiny muted" style={{ margin: 0 }}>
                      Sin planificar.
                    </p>
                  )}

                  {entries.length > 0 && faltan.length > 0 && (
                    <p className="tiny muted" style={{ margin: '4px 0 0' }}>
                      Falta {faltan.map((id) => persona(id)?.name ?? '?').join(' y ')}.
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}

      <button className="btn btn-block" onClick={() => setDias((d) => d + 7)}>
        Ver 7 días más
      </button>

      {meal && (
        <MealSheet
          data={data}
          date={meal.date}
          slot={meal.slot}
          entry={meal.mode === 'edit' ? meal.entry : undefined}
          defaultPeople={meal.mode === 'new' ? meal.people : meal.entry.people}
          onSave={guardarComida}
          onDelete={meal.mode === 'edit' ? () => borrarComida(meal.entry.id) : undefined}
          onClose={() => setMeal(null)}
        />
      )}

      {evento && (
        <EventSheet
          data={data}
          event={evento.ev}
          defaultFrom={evento.from}
          onSave={guardarEvento}
          onDelete={evento.ev ? () => borrarEvento(evento.ev!.id) : undefined}
          onClose={() => setEvento(null)}
        />
      )}
    </div>
  );
}
