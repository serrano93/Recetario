import { describe, expect, it } from 'vitest';
import { MARCA_PROPIA, googleAPlan, horaLocal, importarEventos, type GoogleEvent } from './calendar.js';

/** Evento con hora, en horario de Madrid como lo devuelve Google. */
function conHora(summary: string, dia: string, desde: string, hasta: string, extra: Partial<GoogleEvent> = {}): GoogleEvent {
  return {
    id: `ev_${summary.replace(/\s/g, '')}_${desde}`,
    summary,
    start: { dateTime: `${dia}T${desde}:00+02:00` },
    end: { dateTime: `${dia}T${hasta}:00+02:00` },
    ...extra,
  };
}

function todoElDia(summary: string, desde: string, hasta: string): GoogleEvent {
  // En Google el fin de un evento de todo el dia es EXCLUSIVO.
  return { id: `ev_${summary.replace(/\s/g, '')}`, summary, start: { date: desde }, end: { date: hasta } };
}

describe('horaLocal', () => {
  it('lee el reloj de pared, no la hora del servidor', () => {
    // Vercel corre en UTC: new Date(...).getHours() daria 12 y romperia todo.
    expect(horaLocal('2026-08-25T14:00:00+02:00')).toBe(14);
    expect(horaLocal('2026-08-25T20:30:00+02:00')).toBe(20.5);
  });
});

describe('googleAPlan', () => {
  it('una comida de trabajo bloquea la comida', () => {
    const out = googleAPlan(conHora('Comida con cliente', '2026-08-25', '14:00', '16:00'), 'javi');
    expect(out?.blocks).toEqual(['comida']);
    expect(out?.people).toEqual(['javi']);
  });

  it('una reunion de por la manana no bloquea nada', () => {
    // Lo importante: la mayoria del calendario no tiene que ver con comer.
    expect(googleAPlan(conHora('Daily', '2026-08-25', '09:30', '10:00'), 'javi')).toBeNull();
  });

  it('un evento de noche bloquea la cena', () => {
    const out = googleAPlan(conHora('Concierto', '2026-08-25', '21:00', '23:30'), 'andrea');
    expect(out?.blocks).toEqual(['cena']);
  });

  it('un evento largo que pisa las dos franjas bloquea las dos', () => {
    const out = googleAPlan(conHora('Boda', '2026-08-25', '13:00', '23:00'), 'javi');
    expect(out?.blocks).toEqual(['cena', 'comida']);
  });

  it('lo marcado como libre no cuenta', () => {
    // "Disponible" en Google significa que sigues estando: no bloquea.
    const ev = conHora('Recordatorio', '2026-08-25', '14:00', '15:00', { transparency: 'transparent' });
    expect(googleAPlan(ev, 'javi')).toBeNull();
  });

  it('un viaje de varios dias bloquea comida y cena, con el fin corregido', () => {
    const out = googleAPlan(todoElDia('Viaje a Bilbao', '2026-08-28', '2026-08-31'), 'andrea');
    expect(out?.blocks).toEqual(['cena', 'comida']);
    expect(out?.from).toBe('2026-08-28');
    // Google dice "hasta el 31" queriendo decir que el ultimo dia es el 30.
    expect(out?.to).toBe('2026-08-30');
  });

  it('un evento de todo el dia sin palabra clave no bloquea nada', () => {
    // Un cumpleanos no impide cenar en casa.
    expect(googleAPlan(todoElDia('Cumple de Marta', '2026-08-28', '2026-08-29'), 'javi')).toBeNull();
  });

  it('las palabras clave mandan sobre el horario', () => {
    // A las 11 no pisa ninguna franja, pero el titulo lo deja claro.
    const out = googleAPlan(conHora('Comer fuera con los del curro', '2026-08-25', '11:00', '12:00'), 'javi');
    expect(out?.blocks).toEqual(['comida']);
  });

  it('ignora los eventos que ha creado la propia app', () => {
    // Sin esto, publicar comidas y leerlas de vuelta seria un bucle.
    const ev = conHora('Lentejas con chorizo', '2026-08-25', '14:00', '15:00', {
      extendedProperties: { private: { [MARCA_PROPIA]: 'e_123' } },
    });
    expect(googleAPlan(ev, 'javi')).toBeNull();
  });

  it('ignora los cancelados', () => {
    const ev = conHora('Comida con cliente', '2026-08-25', '14:00', '16:00', { status: 'cancelled' });
    expect(googleAPlan(ev, 'javi')).toBeNull();
  });

  it('respeta reglas personalizadas', () => {
    const out = googleAPlan(conHora('Pádel', '2026-08-25', '10:00', '11:00'), 'javi', {
      franjaComida: [13, 16],
      franjaCena: [20.5, 23],
      todoElDia: [],
      bloqueaComida: ['pádel'],
      bloqueaCena: [],
    });
    expect(out?.blocks).toEqual(['comida']);
  });
});

describe('importarEventos', () => {
  it('solo devuelve lo que afecta a alguna comida', () => {
    const eventos = [
      conHora('Daily', '2026-08-25', '09:30', '10:00'),
      conHora('Comida con cliente', '2026-08-25', '14:00', '16:00'),
      conHora('Gimnasio', '2026-08-25', '18:00', '19:00'),
    ];
    const out = importarEventos(eventos, 'javi');
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Comida con cliente');
  });

  it('no devuelve los que se han ignorado a mano', () => {
    const ev = conHora('Comida con cliente', '2026-08-25', '14:00', '16:00');
    expect(importarEventos([ev], 'javi', undefined, [ev.id])).toHaveLength(0);
  });
});
