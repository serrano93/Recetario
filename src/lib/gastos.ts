import type { Gasto, PersonId } from '../types.js';

/**
 * Cuentas de la casa (pestana Gastos).
 *
 * La regla de fondo: la cuenta conjunta es de los dos al 50 %, y el dinero de
 * cada uno es suyo. Un gasto crea deuda solo cuando el dinero de uno paga la
 * parte de otro. Por gasto de importe A pagado por P e imputado a I:
 *
 *   P = Javi,  I = los dos      -> Andrea debe a Javi A/2   (el ejemplo del super)
 *   P = Andrea, I = los dos     -> Javi debe a Andrea A/2
 *   P = conjunta, I = los dos   -> nadie debe nada (cada uno puso su mitad)
 *   P = Javi, I = solo Javi     -> nada (su dinero, su gasto)
 *   P = Andrea, I = solo Andrea -> nada
 *   P = Javi, I = solo Andrea   -> Andrea debe a Javi A (el pago un gasto de ella)
 *   P = Andrea, I = solo Javi   -> Javi debe a Andrea A
 *   P = conjunta, I = solo Javi -> Javi debe a Andrea A/2 (uso la mitad de ella)
 *   P = conjunta, I = solo Andrea -> Andrea debe a Javi A/2
 *
 * Formalizado: quien paga "funda" el gasto (100 % si es una persona, 50 % cada
 * uno si es la conjunta). Cada persona debe a quien puso el dinero la parte que
 * se le imputa y que no pago ella. Trabajamos en centimos y redondeamos cada
 * deuda al centimo mas cercano, para que nunca salgan 16,666... euros.
 */

/** Unica moneda: centimos enteros, para no arrastrar errores de coma flotante. */
function aCentimos(euros: number): number {
  return Math.round(euros * 100);
}

function aEuros(centimos: number): number {
  return centimos / 100;
}

export interface Aportes {
  /** Euros puestos por cada persona de su bolsillo. */
  porPersona: Record<PersonId, number>;
  /** Euros pagados desde la cuenta conjunta. */
  conjunta: number;
}

export interface Deuda {
  /** Quien debe. */
  deudor: PersonId;
  /** A quien se lo debe. */
  acreedor: PersonId;
  /** Euros, redondeado a centimos. */
  cantidad: number;
}

export interface ResumenGastos {
  aportes: Aportes;
  /**
   * Deuda neta entre los dos, si la hay: un unico par deudor->acreedor. Las
   * deudas en los dos sentidos se cancelan entre si.
   */
  deuda: Deuda | null;
}

/**
 * Cuanto ha puesto cada uno (y la conjunta) y quien debe a quien.
 * Los ids que no esten en `personas` (gente borrada a mitad de camino) se
 * ignoran a proposito: no pueden deber ni cobrar.
 */
export function resumenGastos(gastos: Gasto[], personas: PersonId[]): ResumenGastos {
  const validos = new Set(personas);
  const aportes: Aportes = { porPersona: {}, conjunta: 0 };
  // Deuda bruta acumulada en centimos, en un solo sentido: [deudor][acreedor].
  const bruta = new Map<string, number>();

  const suma = (deudor: PersonId, acreedor: PersonId, centimos: number) => {
    if (!validos.has(deudor) || !validos.has(acreedor) || deudor === acreedor) return;
    const clave = `${deudor}\u0000${acreedor}`;
    bruta.set(clave, (bruta.get(clave) ?? 0) + centimos);
  };

  for (const g of gastos) {
    if (!Number.isFinite(g.cantidad) || g.cantidad <= 0) continue;
    const centimos = aCentimos(g.cantidad);

    const imputados = g.imputadoA.filter((id) => validos.has(id));
    if (imputados.length === 0) continue;
    // A medias entre los imputados: con dos personas es 1 o 1/2 cada uno.
    const parte = centimos / imputados.length;

    if (g.pagadoPor === 'conjunta') {
      // La conjunta la ponen todos los miembros a partes iguales.
      aportes.conjunta += centimos;
      const miembros = personas.length;
      for (const quien of imputados) {
        // La parte de `quien` sale financiada un poco por cada uno de los
        // demas, y a esos les debe. Con Javi y Andrea, la mitad de su parte.
        for (const otro of personas) {
          if (otro !== quien) suma(quien, otro, Math.round(parte / miembros));
        }
      }
    } else {
      const pagador: PersonId = g.pagadoPor;
      if (!validos.has(pagador)) continue;
      aportes.porPersona[pagador] = (aportes.porPersona[pagador] ?? 0) + centimos;
      for (const quien of imputados) {
        // Su parte entera la pago el otro de su bolsillo.
        if (quien !== pagador) suma(quien, pagador, Math.round(parte));
      }
    }
  }

  // Cancelamos lo que se deben entre si y nos quedamos con un unico sentido.
  const deuda = neta(bruta, personas);
  return {
    aportes: {
      porPersona: Object.fromEntries(
        personas.map((id) => [id, aEuros(aportes.porPersona[id] ?? 0)]),
      ),
      conjunta: aEuros(aportes.conjunta),
    },
    deuda,
  };
}

function neta(bruta: Map<string, number>, personas: PersonId[]): Deuda | null {
  for (let i = 0; i < personas.length; i++) {
    for (let j = i + 1; j < personas.length; j++) {
      const a = personas[i];
      const b = personas[j];
      const ab = bruta.get(`${a}\u0000${b}`) ?? 0;
      const ba = bruta.get(`${b}\u0000${a}`) ?? 0;
      if (ab > ba) return { deudor: a, acreedor: b, cantidad: aEuros(ab - ba) };
      if (ba > ab) return { deudor: b, acreedor: a, cantidad: aEuros(ba - ab) };
    }
  }
  return null;
}

/**
 * El gasto de liquidacion que deja el balance a cero: quien debe paga al otro
 * exactamente lo que debe (o null si ya estan en paz). Al apuntarlo, la deuda
 * nueva cancela la anterior y el balance queda en cero sin tocar el historial.
 */
export function liquidacion(gastos: Gasto[], personas: PersonId[]): Omit<Gasto, 'id' | 'updatedAt'> | null {
  const { deuda } = resumenGastos(gastos, personas);
  if (!deuda) return null;
  return {
    fecha: new Date().toISOString().slice(0, 10),
    concepto: 'Hacer cuentas',
    cantidad: deuda.cantidad,
    pagadoPor: deuda.deudor,
    imputadoA: [deuda.acreedor],
    ajuste: true,
  };
}

/** "50,00 €" en el formato de casa (coma decimal y euro detras). */
export function formatearEuros(cantidad: number): string {
  const texto = (Math.round(cantidad * 100) / 100).toFixed(2).replace('.', ',');
  return `${texto} €`;
}
