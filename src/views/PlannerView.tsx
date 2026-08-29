import { useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PlanEntry, PlanEvent, Slot } from '../types.js';
import { SLOTS } from '../types.js';
import { useStore } from '../store.js';
import { dayName, dayNumber, friendlyDate, monthName, rangeFrom, today } from '../lib/dates.js';
import {
  blockedIn,
  comidasPendientes,
  coveredIn,
  dinersFor,
  entriesFor,
  entryLabel,
  eventsOn,
  reubicar,
} from '../lib/plan.js';
import { conLapidas, sellar } from '../lib/merge.js';
import { MealSheet } from '../components/MealSheet.js';
import { EventSheet } from '../components/EventSheet.js';
import { IconCheck, IconGrip, IconPlane, IconPlus, IconTrash } from '../components/icons.js';

type MealTarget =
  | { mode: 'new'; date: string; slot: Slot; people: string[] }
  | { mode: 'edit'; date: string; slot: Slot; entry: PlanEntry };

/** Qué se está arrastrando y dónde está el dedo/ratón ahora mismo. */
type DragState = { id: string; x: number; y: number } | null;

/**
 * Calendario rodante: siempre 7 dias empezando hoy, en vez de semanas fijas de
 * lunes a domingo. Encaja mejor con un horario flexible.
 */
export function PlannerView() {
  const { data, update } = useStore();
  const [dias, setDias] = useState(7);
  const [meal, setMeal] = useState<MealTarget | null>(null);
  const [evento, setEvento] = useState<{ ev?: PlanEvent; from: string } | null>(null);
  const [drag, setDrag] = useState<DragState>(null);
  /** Clave del destino bajo el puntero: "slot|fecha|slot" o "meal|id". */
  const [sobre, setSobre] = useState<string | null>(null);

  const hoy = today();
  const fechas = useMemo(() => rangeFrom(hoy, dias), [hoy, dias]);
  const pendientes = useMemo(() => comidasPendientes(data.plan, hoy), [data.plan, hoy]);

  const guardarComida = (entry: PlanEntry, sobras: PlanEntry[] = []) =>
    update((prev) => {
      const sellada = sellar(entry);
      const base = prev.plan.some((e) => e.id === entry.id)
        ? prev.plan.map((e) => (e.id === entry.id ? sellada : e))
        : [...prev.plan, sellada];
      return { ...prev, plan: [...base, ...sobras.map(sellar)] };
    });

  const borrarComida = (id: string) =>
    update((prev) => {
      // Al quitar una tanda se van con ella sus sobras: sin la olla no hay tupper.
      const fuera = prev.plan.filter((e) => e.id === id || e.leftoverOf === id).map((e) => e.id);
      return {
        ...prev,
        plan: prev.plan.filter((e) => !fuera.includes(e.id)),
        deleted: conLapidas(prev, fuera),
      };
    });

  const alternarHecho = (id: string) =>
    update((prev) => ({
      ...prev,
      plan: prev.plan.map((e) => (e.id === id ? sellar({ ...e, done: !e.done }) : e)),
    }));

  /** Mueve una comida a otra fecha/hueco; con `beforeId` la reordena en su sitio. */
  const mover = (id: string, date: string, slot: Slot, beforeId?: string) =>
    update((prev) => ({
      ...prev,
      plan: reubicar(prev.plan, id, date, slot, beforeId).map((e) =>
        e.id === id ? sellar(e) : e,
      ),
    }));

  const guardarEvento = (ev: PlanEvent) =>
    update((prev) => ({
      ...prev,
      // Al tocarlo a mano deja de ser de Google: si no, la siguiente
      // sincronizacion machacaria la edicion.
      events: prev.events.some((x) => x.id === ev.id)
        ? prev.events.map((x) => (x.id === ev.id ? sellar({ ...ev, origen: undefined }) : x))
        : [...prev.events, sellar(ev)],
    }));

  const borrarEvento = (id: string) =>
    update((prev) => {
      const ev = prev.events.find((e) => e.id === id);
      // Si venia de Google hay que apuntarlo como ignorado, o vuelve a
      // aparecer en cuanto se sincronice otra vez.
      const ignorados = prev.integraciones?.google?.ignorados ?? [];
      const nuevosIgnorados =
        ev?.origen === 'google' && ev.externalId && !ignorados.includes(ev.externalId)
          ? [...ignorados, ev.externalId]
          : ignorados;
      return {
        ...prev,
        events: prev.events.filter((e) => e.id !== id),
        deleted: conLapidas(prev, [id]),
        integraciones: prev.integraciones?.google
          ? { ...prev.integraciones, google: { ...prev.integraciones.google, ignorados: nuevosIgnorados } }
          : prev.integraciones,
      };
    });

  const persona = (id: string) => data.people.find((p) => p.id === id);

  /* --- Arrastre ------------------------------------------------------ */

  /** Qué destino hay bajo el puntero, para resaltarlo. */
  const sobreDe = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const meal = el.closest('[data-drop-meal]') as HTMLElement | null;
    if (meal) return `meal|${meal.dataset.dropMeal}`;
    const slot = el.closest('[data-drop-slot]') as HTMLElement | null;
    if (slot) return `slot|${slot.dataset.dropSlot}`;
    return null;
  };

  /** Aplica el movimiento segun donde se solto. */
  const soltar = (x: number, y: number, id: string) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return;
    const mealEl = el.closest('[data-drop-meal]') as HTMLElement | null;
    if (mealEl) {
      const targetId = mealEl.dataset.dropMeal!;
      if (targetId === id) return; // sobre si misma: no hacer nada
      const target = data.plan.find((p) => p.id === targetId);
      if (!target) return;
      // Mitad superior = antes, mitad inferior = despues.
      const rect = mealEl.getBoundingClientRect();
      const antes = y < rect.top + rect.height / 2;
      const delSlot = entriesFor(data.plan, target.date, target.slot);
      const idx = delSlot.findIndex((e) => e.id === targetId);
      const beforeId = antes ? targetId : delSlot[idx + 1]?.id;
      mover(id, target.date, target.slot, beforeId);
      return;
    }
    const slotEl = el.closest('[data-drop-slot]') as HTMLElement | null;
    if (slotEl) {
      const [date, slot] = (slotEl.dataset.dropSlot as string).split('|') as [string, Slot];
      const actual = data.plan.find((p) => p.id === id);
      if (actual && (actual.date !== date || actual.slot !== slot)) mover(id, date, slot);
    }
  };

  const gripProps = (id: string) => ({
    className: 'grip',
    'aria-label': 'Arrastrar',
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ id, x: e.clientX, y: e.clientY });
      setSobre(null);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!drag || drag.id !== id) return;
      setDrag({ id, x: e.clientX, y: e.clientY });
      setSobre(sobreDe(e.clientX, e.clientY));
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!drag || drag.id !== id) return;
      soltar(e.clientX, e.clientY, id);
      setDrag(null);
      setSobre(null);
    },
    onPointerCancel: () => {
      if (drag?.id === id) {
        setDrag(null);
        setSobre(null);
      }
    },
  });

  const arrastrada = drag ? data.plan.find((p) => p.id === drag.id) : undefined;

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
                  {ev.origen === 'google' && (
                    <span className="tag" style={{ marginLeft: 6 }}>
                      calendario
                    </span>
                  )}
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
                <div
                  key={slot}
                  className={`slot${sobre === `slot|${fecha}|${slot}` ? ' drop-over' : ''}`}
                  data-drop-slot={`${fecha}|${slot}`}
                >
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
                    const esArrastrada = drag?.id === entry.id;
                    return (
                      <div
                        key={entry.id}
                        className={`meal${entry.done ? ' meal-done' : ''}${
                          esArrastrada ? ' meal-dragging' : ''
                        }${sobre === `meal|${entry.id}` ? ' drop-over' : ''}`}
                        data-drop-meal={entry.id}
                      >
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
                          <div className="meal-name">
                            {entry.leftoverOf && <span className="tag">sobras</span>}{' '}
                            {entryLabel(data, entry)}
                          </div>
                          {entry.batch && (
                            <div className="tiny muted" style={{ marginTop: 2 }}>
                              tanda entera
                            </div>
                          )}
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
                        <button {...gripProps(entry.id)}>
                          <IconGrip />
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

      {pendientes.length > 0 && (
        <section>
          <div className="section-title">
            <span>Pendientes de comer</span>
            <span className="tiny muted">{pendientes.length}</span>
          </div>
          <div className="card" style={{ padding: 10 }}>
            <p className="tiny muted" style={{ margin: '0 4px 8px' }}>
              Planificadas y compradas, pero sin cocinar. Arrástralas a un hueco libre o descártalas.
            </p>
            {pendientes.map((entry) => (
              <div key={entry.id} className="pendiente">
                <button {...gripProps(entry.id)}>
                  <IconGrip />
                </button>
                <button
                  className="meal-check"
                  aria-pressed={false}
                  aria-label="Marcar como hecho"
                  onClick={() => alternarHecho(entry.id)}
                />
                <button
                  className="grow"
                  style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }}
                  onClick={() => setMeal({ mode: 'edit', date: entry.date, slot: entry.slot, entry })}
                >
                  <div className="meal-name">
                    {entry.leftoverOf && <span className="tag">sobras</span>}{' '}
                    {entryLabel(data, entry)}
                  </div>
                  <div className="tiny muted">desde el {friendlyDate(entry.date, hoy)}</div>
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  aria-label="Descartar"
                  onClick={() => borrarComida(entry.id)}
                >
                  <IconTrash size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {drag && arrastrada && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {entryLabel(data, arrastrada)}
        </div>
      )}

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
