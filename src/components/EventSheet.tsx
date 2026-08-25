import { useState } from 'react';
import type { AppData, PersonId, PlanEvent, Slot } from '../types.js';
import { SLOTS } from '../types.js';
import { Sheet } from './Sheet.js';
import { PersonPicker } from './PersonPicker.js';
import { IconTrash } from './icons.js';
import { newId } from '../lib/validate.js';

/**
 * Alta y edicion de un plan libre: "Javi come fuera", "Andrea de viaje",
 * "vienen mis padres a cenar"... lo que sea.
 *
 * Si marcas comida o cena, esas personas dejan de contar para cocinar y para la
 * lista de la compra esos dias.
 */
export function EventSheet({
  data,
  event,
  defaultFrom,
  onSave,
  onDelete,
  onClose,
}: {
  data: AppData;
  event?: PlanEvent;
  defaultFrom: string;
  onSave: (ev: PlanEvent) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [people, setPeople] = useState<PersonId[]>(event?.people ?? []);
  const [from, setFrom] = useState(event?.from ?? defaultFrom);
  const [to, setTo] = useState(event?.to ?? defaultFrom);
  const [blocks, setBlocks] = useState<Slot[]>(event?.blocks ?? []);
  const [notes, setNotes] = useState(event?.notes ?? '');

  const toggleSlot = (s: Slot) =>
    setBlocks((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const guardar = () => {
    const t = title.trim();
    if (!t) return;
    const desde = from;
    const hasta = to < from ? from : to;
    onSave({
      id: event?.id ?? newId('ev'),
      title: t,
      people,
      from: desde,
      to: hasta,
      blocks,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <Sheet
      title={event ? 'Editar plan' : 'Nuevo plan'}
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
          <button className="btn btn-primary" onClick={guardar} disabled={!title.trim()}>
            Guardar
          </button>
        </>
      }
    >
      <div className="field">
        <label>¿Qué pasa?</label>
        <input
          className="input"
          placeholder="Javi come fuera, Andrea de viaje, cena con Marta..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </div>

      <div className="field">
        <label>¿A quién afecta?</label>
        <PersonPicker people={data.people} value={people} onChange={setPeople} allowEmpty />
        <p className="tiny muted">Sin nadie marcado, el plan es de los dos.</p>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Desde</label>
          <input
            className="input"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              if (to < e.target.value) setTo(e.target.value);
            }}
          />
        </div>
        <div className="field">
          <label>Hasta</label>
          <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>¿Se salta alguna comida en casa?</label>
        <div className="row">
          {SLOTS.map((s) => (
            <button
              key={s}
              type="button"
              className="chip chip-toggle"
              aria-pressed={blocks.includes(s)}
              onClick={() => toggleSlot(s)}
            >
              {s === 'comida' ? 'Comida' : 'Cena'}
            </button>
          ))}
        </div>
        <p className="tiny muted">
          Lo que marques deja de pedir cocina y no cuenta para la compra. Sin marcar nada, el plan es
          solo una nota en el calendario.
        </p>
      </div>

      <div className="field">
        <label>Notas</label>
        <textarea
          className="textarea"
          style={{ minHeight: 70 }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Sheet>
  );
}
